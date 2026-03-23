import React, { useEffect, useState, useCallback } from "react";
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

  useEffect(() => {
    load();
  }, [load]);

  const latestAnalysis = analyses[0] || null;
  const first = user?.name?.split(" ")[0] || "there";

  const catSpend = CATEGORIES.filter((c) => c.type === "expense")
    .map((c) => ({
      name: c.label,
      icon: c.icon,
      color: c.color,
      spent: Math.round(summary?.byCategory?.[c.id] || 0),
      budget: Math.round(budget?.targets?.[c.id] || 0),
    }))
    .filter((c) => c.spent > 0 || c.budget > 0);

  const totalIncome = summary?.totalIncome || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const savingsGap = summary?.savingsGap ?? totalIncome - totalExpenses;

  const dailyAccum = (Array.isArray(daily) ? daily : []).reduce((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1].cumulative : 0;
    acc.push({
      date: d.date.slice(5),
      daily: d.total,
      cumulative: prev + d.total,
    });
    return acc;
  }, []);

  const trendData = [...analyses].reverse().map((a) => ({
    month: a.month?.slice(5) || "",
    score: Math.round(a.ml?.ensembleScore || 0),
    level: a.ml?.ensembleLevel || "Low",
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: "2rem",
            lineHeight: 1.2,
            marginBottom: ".3rem",
          }}
        >
          Hey,{" "}
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>
            {first}
          </span>{" "}
          👋
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>
          Here's your spending snapshot for the month.
        </p>
      </div>

      <MonthNav month={month} onChange={setMonth} />

      {loading ? (
        <div className="spin-full">
          <div className="spin" />
        </div>
      ) : (
        <>
          {/* Key metrics */}
          <div className="mg-4">
            {[
              ["Income & Aid", fmt(totalIncome), "Total received", ""],
              [
                "Spent",
                fmt(totalExpenses),
                `${totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0}% of income`,
                "",
              ],
              [
                "Surplus",
                (savingsGap >= 0 ? "+" : "-") + fmt(savingsGap),
                savingsGap < 0 ? "Overspending" : "Positive buffer",
                savingsGap < 0 ? "danger" : "good",
              ],
              [
                "Entries",
                summary?.byCategory
                  ? Object.values(summary.byCategory).length
                  : 0,
                "categories tracked",
                "",
              ],
            ].map(([l, v, s, cls]) => (
              <div key={l} className={`mc ${cls}`}>
                <div className="ml">{l}</div>
                <div className="mv">{v}</div>
                <div className="ms">{s}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => navigate("/tracker", { state: { month } })}
            >
              ➕ Add expense
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/analyse", { state: { month } })}
            >
              🔬 Run analysis
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate("/budget", { state: { month } })}
            >
              🎯 Set budget
            </button>
          </div>

          {/* Budget vs actual bars */}
          {catSpend.length > 0 && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">🎯</div>Budget vs actual
              </div>
              {catSpend.map((c) => {
                const pct =
                  c.budget > 0 ? Math.min(c.spent / c.budget, 1.5) : null;
                const over = c.budget > 0 && c.spent > c.budget;
                const color = over
                  ? "var(--red)"
                  : pct > 0.8
                    ? "var(--amber)"
                    : c.color;
                return (
                  <div key={c.name} className="bbar-wrap">
                    <div className="bbar-top">
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span>{c.icon}</span>
                        <span style={{ fontSize: 13 }}>{c.name}</span>
                      </span>
                      <span style={{ fontSize: 12 }}>
                        <strong style={{ color }}>{fmt(c.spent)}</strong>
                        {c.budget > 0 && (
                          <span style={{ color: "var(--text3)" }}>
                            {" "}
                            / {fmt(c.budget)}
                          </span>
                        )}
                        {over && (
                          <span
                            style={{ color: "var(--red)", fontWeight: 600 }}
                          >
                            {" "}
                            ↑ over
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      className="bbar-track"
                      style={{ background: "var(--surface2)" }}
                    >
                      {c.budget > 0 ? (
                        <div
                          className="bbar-fill"
                          style={{
                            width: `${Math.min(pct * 100, 100)}%`,
                            background: color,
                          }}
                        />
                      ) : (
                        <div
                          className="bbar-fill"
                          style={{
                            width: "100%",
                            background: c.color,
                            opacity: 0.35,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {catSpend.every((c) => c.budget === 0) && (
                <div
                  style={{ fontSize: 13, color: "var(--text3)", marginTop: 8 }}
                >
                  No budgets set yet.{" "}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate("/budget")}
                  >
                    Set budgets →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Daily spend chart */}
          {dailyAccum.length > 0 && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">📅</div>Daily spending
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyAccum} margin={{ left: 0, right: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--text3)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text3)" }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(v) => [`$${v}`, "Spent"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="daily" radius={[4, 4, 0, 0]}>
                    {dailyAccum.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.daily > 100 ? "var(--accent)" : "var(--accent-l)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stress trend */}
          {trendData.length > 1 && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">📈</div>Stress score trend
                {latestAnalysis && (
                  <span
                    className={`badge ${latestAnalysis.ml?.ensembleLevel}`}
                    style={{ marginLeft: "auto" }}
                  >
                    Latest: {Math.round(latestAnalysis.ml?.ensembleScore)}/100
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--text3)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--text3)" }}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, _, p) => [
                      `${v}/100 (${p.payload.level})`,
                      "Stress",
                    ]}
                  />
                  <ReferenceLine
                    y={33}
                    stroke="var(--green)"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                  />
                  <ReferenceLine
                    y={66}
                    stroke="var(--amber)"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--accent)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  fontSize: 11,
                  color: "var(--text3)",
                  marginTop: 6,
                }}
              >
                <span style={{ color: "var(--green)" }}>— Low (&lt;33)</span>
                <span style={{ color: "var(--amber)" }}>— Medium (33–66)</span>
                <span style={{ color: "var(--red)" }}>— High (&gt;66)</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!summary?.byCategory && (
            <div
              className="card"
              style={{ textAlign: "center", padding: "3rem 2rem" }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
              <h2
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.5rem",
                  marginBottom: ".5rem",
                }}
              >
                No expenses yet
              </h2>
              <p
                style={{
                  color: "var(--text2)",
                  fontSize: 14,
                  marginBottom: "1.5rem",
                }}
              >
                Start logging your daily expenses to get your personalised
                financial stress analysis.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/tracker")}
              >
                Start tracking →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
