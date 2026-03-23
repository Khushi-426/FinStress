import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Cell,
} from "recharts";
import { gsap } from "gsap";
import {
  CalendarDays,
  TrendingUp,
  Target,
  Plus,
  FlaskConical,
  Zap,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import MonthNav from "../components/MonthNav";
import {
  CATEGORIES,
  CAT_MAP,
  fmt,
  currentMonth,
  STRESS_COLOR,
  STRESS_BG,
} from "../utils/categories";

/* ─── layout constants ─────────────────────────────────────── */
const S = {
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
    gap: "1.25rem",
    alignItems: "start",
    marginBottom: "1.25rem",
  },
  sideStack: { display: "flex", flexDirection: "column", gap: "1.1rem" },
  heading: {
    fontFamily: "var(--serif)",
    fontSize: "clamp(2rem, 4vw, 3rem)",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    marginBottom: "0.35rem",
  },
  headingAccent: { color: "var(--accent)", fontStyle: "italic" },
  sub: { color: "var(--text2)", fontSize: "clamp(13px, 1vw, 14px)", marginBottom: 0 },
  sideMetric: { display: "flex", flexDirection: "column", gap: "0.65rem" },
  sideLabel: {
    fontSize: 11, fontWeight: 500, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.4px",
  },
  sideValue: {
    fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)",
    fontWeight: 600, lineHeight: 1, fontFamily: "var(--sans)",
  },
};

/* ─── small reusable card-icon wrapper ─────────────────────── */
function CardIcon({ children }) {
  return <div className="card-icon">{children}</div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [budget, setBudget] = useState(null);
  const [daily, setDaily] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(true);

  /* GSAP refs */
  const headRef   = useRef(null);
  const cardsRef  = useRef(null);
  const heroRef   = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumR, budR, dayR, anaR] = await Promise.all([
        api.get(`/expenses/summary?month=${month}`),
        api.get(`/budget?month=${month}`),
        api.get(`/expenses/daily?month=${month}`),
        api.get("/analysis"),
      ]);
      setSummary(sumR.data || null);
      setBudget(budR.data || null);
      setDaily(Array.isArray(dayR.data) ? dayR.data : []);
      setAnalyses(Array.isArray(anaR.data) ? anaR.data : []);
      setDataReady(true);
    } catch (e) {
      console.error("Dashboard load error:", e);
      setDataReady(true);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  /* ── GSAP: header + hero grid entrance on data ready ── */
  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(headRef.current,
        { y: -18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
      );
      if (heroRef.current) {
        const cards = heroRef.current.querySelectorAll(".card, .mc");
        gsap.fromTo(cards,
          { y: 22, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 0.45,
            ease: "power2.out",
            stagger: 0.06,
            delay: 0.1,
          }
        );
      }
    });
    return () => ctx.revert();
  }, [loading]);

  const latestAnalysis = analyses[0] || null;
  const first = user?.name?.split(" ")[0] || "there";

  const catSpend = CATEGORIES.filter((c) => c.type === "expense")
    .map((c) => ({
      name: c.label,
      icon: c.icon,
      color: c.color,
      spent:  Math.round(summary?.byCategory?.[c.id] || 0),
      budget: Math.round(budget?.targets?.[c.id]     || 0),
    }))
    .filter((c) => c.spent > 0 || c.budget > 0);

  const totalIncome   = summary?.totalIncome   || 0;
  const totalExpenses = summary?.totalExpenses  || 0;
  const savingsGap    = summary?.savingsGap ?? totalIncome - totalExpenses;

  const dailyAccum = (Array.isArray(daily) ? daily : []).reduce((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1].cumulative : 0;
    acc.push({ date: d.date.slice(5), daily: d.total, cumulative: prev + d.total });
    return acc;
  }, []);

  const trendData = [...analyses].reverse().map((a) => ({
    month: a.month?.slice(5) || "",
    score: Math.round(a.ml?.ensembleScore || 0),
    level: a.ml?.ensembleLevel || "Low",
  }));

  const spendPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  /* shared tooltip style */
  const tooltipStyle = {
    fontSize: 12, borderRadius: 10,
    background: "var(--surface-glass)",
    backdropFilter: "blur(12px)",
    border: "1px solid var(--border-glass)",
    boxShadow: "var(--shadow-md)",
  };

  return (
    <div className="fade-up">

      {/* ── Header ──────────────────────────────────── */}
      <div ref={headRef} style={{ marginBottom: "1.5rem" }}>
        <h1 style={S.heading}>
          Hey, <span style={S.headingAccent}>{first}</span>
        </h1>
        <p style={S.sub}>Your financial snapshot for the month.</p>
      </div>

      <MonthNav month={month} onChange={setMonth} />

      {loading ? (
        <div className="spin-full"><div className="spin" /></div>
      ) : (
        <div ref={heroRef}>
          {/* ═══════════════════════════════════════════════════
              ASYMMETRIC HERO GRID  2fr | 1fr
              ═══════════════════════════════════════════════════ */}
          <div style={S.heroGrid}>

            {/* ── LEFT: charts ─────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

              {/* Daily spending — hero chart */}
              {dailyAccum.length > 0 ? (
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">
                    <CardIcon><CalendarDays size={15} strokeWidth={1.8} /></CardIcon>
                    Daily spending
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)" }}>{month}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={dailyAccum} margin={{ left: 0, right: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text3)" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => [`$${v}`, "Spent"]} contentStyle={tooltipStyle} />
                      <Bar dataKey="daily" radius={[5, 5, 0, 0]}>
                        {dailyAccum.map((d, i) => (
                          <Cell key={i} fill={d.daily > 100 ? "var(--accent)" : "var(--accent-l)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="card" style={{ marginBottom: 0, textAlign: "center", padding: "3rem 2rem" }}>
                  <FileText size={40} strokeWidth={1.2} style={{ margin: "0 auto 1rem", color: "var(--text3)" }} />
                  <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: ".5rem" }}>No expenses yet</h2>
                  <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: "1.5rem" }}>
                    Start logging your daily expenses to get your personalised financial stress analysis.
                  </p>
                  <button className="btn btn-primary" onClick={() => navigate("/tracker")}>
                    Start tracking
                  </button>
                </div>
              )}

              {/* Stress trend */}
              {trendData.length > 1 && (
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">
                    <CardIcon><TrendingUp size={15} strokeWidth={1.8} /></CardIcon>
                    Stress score trend
                    {latestAnalysis && (
                      <span className={`badge ${latestAnalysis.ml?.ensembleLevel}`} style={{ marginLeft: "auto" }}>
                        Latest: {Math.round(latestAnalysis.ml?.ensembleScore)}/100
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text3)" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text3)" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, _, p) => [`${v}/100 (${p.payload.level})`, "Stress"]} />
                      <ReferenceLine y={33} stroke="var(--green)" strokeDasharray="4 2" strokeWidth={1} />
                      <ReferenceLine y={66} stroke="var(--amber)" strokeDasharray="4 2" strokeWidth={1} />
                      <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2.5}
                        dot={{ fill: "var(--accent)", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
                    <span style={{ color: "var(--green)" }}>— Low (&lt;33)</span>
                    <span style={{ color: "var(--amber)" }}>— Medium (33–66)</span>
                    <span style={{ color: "var(--red)" }}>— High (&gt;66)</span>
                  </div>
                </div>
              )}

              {/* Budget vs actual */}
              {catSpend.length > 0 && (
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">
                    <CardIcon><Target size={15} strokeWidth={1.8} /></CardIcon>
                    Budget vs actual
                  </div>
                  {catSpend.map((c) => {
                    const pct   = c.budget > 0 ? Math.min(c.spent / c.budget, 1.5) : null;
                    const over  = c.budget > 0 && c.spent > c.budget;
                    const color = over ? "var(--red)" : pct > 0.8 ? "var(--amber)" : c.color;
                    return (
                      <div key={c.name} className="bbar-wrap">
                        <div className="bbar-top">
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 13 }}>{c.name}</span>
                          </span>
                          <span style={{ fontSize: 12 }}>
                            <strong style={{ color }}>{fmt(c.spent)}</strong>
                            {c.budget > 0 && <span style={{ color: "var(--text3)" }}> / {fmt(c.budget)}</span>}
                            {over && <span style={{ color: "var(--red)", fontWeight: 600 }}> ↑ over</span>}
                          </span>
                        </div>
                        <div className="bbar-track" style={{ background: "var(--surface2)" }}>
                          {c.budget > 0 ? (
                            <div className="bbar-fill" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
                          ) : (
                            <div className="bbar-fill" style={{ width: "100%", background: c.color, opacity: 0.35 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {catSpend.every((c) => c.budget === 0) && (
                    <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 8 }}>
                      No budgets set yet.{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/budget")}>
                        Set budgets →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT: metric cards + actions ────────────── */}
            <div style={S.sideStack}>

              {/* Income */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={S.sideMetric}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={S.sideLabel}>Income & Aid</div>
                    <ArrowUpRight size={14} color="var(--green)" strokeWidth={2} />
                  </div>
                  <div style={{ ...S.sideValue, color: "var(--green)" }}>{fmt(totalIncome)}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Total received</div>
                </div>
              </div>

              {/* Spent */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={S.sideMetric}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={S.sideLabel}>Spent</div>
                    <ArrowDownRight size={14} color={spendPct > 90 ? "var(--red)" : "var(--text3)"} strokeWidth={2} />
                  </div>
                  <div style={{ ...S.sideValue, color: spendPct > 90 ? "var(--red)" : "var(--text)" }}>
                    {fmt(totalExpenses)}
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden", marginTop: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(spendPct, 100)}%`,
                      background: spendPct > 90 ? "var(--red)" : spendPct > 70 ? "var(--amber)" : "var(--accent)",
                      transition: "width .6s cubic-bezier(.4,0,.2,1)",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{spendPct}% of income</div>
                </div>
              </div>

              {/* Surplus */}
              <div className="card" style={{
                marginBottom: 0,
                background: savingsGap < 0 ? "rgba(192,57,43,0.06)" : "rgba(58,125,68,0.06)",
              }}>
                <div style={S.sideMetric}>
                  <div style={S.sideLabel}>Surplus</div>
                  <div style={{ ...S.sideValue, color: savingsGap < 0 ? "var(--red)" : "var(--green)" }}>
                    {(savingsGap >= 0 ? "+" : "−") + fmt(Math.abs(savingsGap))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: savingsGap < 0 ? "var(--red)" : "var(--green)" }}>
                    {savingsGap < 0
                      ? <><ArrowDownRight size={11} strokeWidth={2.2} /> Overspending</>
                      : <><ArrowUpRight size={11} strokeWidth={2.2} /> Positive buffer</>
                    }
                  </div>
                </div>
              </div>

              {/* Categories tracked */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={S.sideMetric}>
                  <div style={S.sideLabel}>Categories tracked</div>
                  <div style={S.sideValue}>
                    {summary?.byCategory ? Object.values(summary.byCategory).length : 0}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>expense entries</div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title" style={{ marginBottom: "0.85rem" }}>
                  <CardIcon><Zap size={15} strokeWidth={1.8} /></CardIcon>
                  Quick actions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/tracker", { state: { month } })}>
                    <Plus size={15} strokeWidth={2.2} /> Add expense
                  </button>
                  <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/analyse", { state: { month } })}>
                    <FlaskConical size={15} strokeWidth={1.8} /> Run analysis
                  </button>
                  <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/budget", { state: { month } })}>
                    <Target size={15} strokeWidth={1.8} /> Set budget
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Empty state */}
          {!summary?.byCategory && dailyAccum.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
              <FileText size={44} strokeWidth={1.2} style={{ margin: "0 auto 1rem", color: "var(--text3)" }} />
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: ".5rem" }}>No expenses yet</h2>
              <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: "1.5rem" }}>
                Start logging your daily expenses to get your personalised financial stress analysis.
              </p>
              <button className="btn btn-primary" onClick={() => navigate("/tracker")}>Start tracking</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
