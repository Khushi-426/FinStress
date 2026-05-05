import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Plus,
} from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import MonthNav from "../components/MonthNav";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import {
  fmt,
  currentMonth,
} from "../utils/categories";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [sumR, dayR, anaR, budR] = await Promise.all([
        api.get(`/expenses/summary?month=${month}`),
        api.get(`/expenses/daily?month=${month}`),
        api.get("/analysis"),
        api.get(`/budget?month=${month}`),
      ]);
      setSummary(sumR.data || null);
      setDaily(Array.isArray(dayR.data) ? dayR.data : []);
      setAnalyses(Array.isArray(anaR.data) ? anaR.data : []);
      setBudget(budR.data?._id ? budR.data : null);
    } catch (e) {
      console.error("Dashboard load error:", e);
      setErr(e.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const latestAnalysis = analyses[0] || null;
  const first = user?.name?.split(" ")[0] || "there";

  const plannedIn   = (budget?.monthlyIncome || 0) + (budget?.financialAid || 0);
  const trackedIn   = summary?.totalIncome || 0;
  const totalIncome = plannedIn + trackedIn;
  const totalExpenses = summary?.totalExpenses  || 0;
  const savingsGap    = totalIncome - totalExpenses;
  const spendPct      = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  const dailyAccum = (Array.isArray(daily) ? daily : []).reduce((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1].cumulative : 0;
    acc.push({ date: d.date.slice(5), daily: d.total, cumulative: prev + d.total });
    return acc;
  }, []);

  const mainInsight = savingsGap < 0 
    ? "You are overspending this month" 
    : spendPct > 80 
      ? "Your spending is nearing its limit" 
      : "Your finances are balanced and healthy";

  const insightColor = savingsGap < 0 ? "var(--red)" : spendPct > 80 ? "var(--amber)" : "var(--green)";

  const CustomTooltip = React.memo(({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{
          background: "var(--color-surface)",
          padding: "10px 15px",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-md)"
        }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)" }}>{payload[0].payload.date}</p>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--color-primary)" }}>{fmt(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  });

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Hi, {first}.</h1>
          <p className="story-subtitle">Here is the story of your money this month.</p>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      {loading ? (
        <LoadingState message="Fetching your financial snapshot..." />
      ) : err ? (
        <ErrorState error={err} onRetry={load} />
      ) : (
        <div>
          
          <div className="story-hero">
            <span className="story-hero-val" style={{ color: insightColor }}>{mainInsight}</span>
            <p className="story-hero-label">
              You've spent <strong className={savingsGap < 0 ? 'text-red' : 'text-blue'}>{fmt(totalExpenses)}</strong> against an income of <strong className="text-green">{fmt(totalIncome)}</strong>.
            </p>
          </div>

          <div className="story-narrative" style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p>
              Your current balance stands at <strong className={savingsGap < 0 ? 'text-red' : 'text-green'}>{fmt(savingsGap)}</strong>. 
              {savingsGap < 0 
                ? " This deficit might increase your financial stress if not managed carefully." 
                : " This buffer helps keep your financial stress levels in check."}
            </p>
          </div>

          <div className="divider" />

          <section style={{ marginBottom: '6rem' }}>
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '3rem' }}>Spending Pattern</h2>
            <div className="story-split">
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyAccum} margin={{ left: 0, right: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="daily" radius={[6, 6, 0, 0]}>
                      {dailyAccum.map((d, i) => (
                        <Cell key={i} fill={d.daily > (totalExpenses / 30) * 1.5 ? "var(--color-primary)" : "var(--color-secondary)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="story-narrative">
                <p>
                  Your daily expenses fluctuate, with some days showing higher activity than others. 
                  Average daily spend is around <strong>{fmt(Math.round(totalExpenses / 30))}</strong>.
                </p>
                <p>
                  Consistent tracking allows us to predict potential stress points before they happen.
                </p>
                <button className="btn btn-gradient" onClick={() => navigate("/tracker")}>
                  View all transactions →
                </button>
              </div>
            </div>
          </section>

          <div className="divider" />

          <section style={{ marginBottom: '6rem' }}>
            <div className="story-split" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
              <div className="story-narrative">
                <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>Stress Analysis</h2>
                <p>
                  Our AI advisor currently rates your financial stress as <strong style={{ color: insightColor }}>{latestAnalysis?.ml?.ensembleLevel || "Unknown"}</strong>.
                </p>
                <p>
                  This is calculated based on your debt-to-income ratio, spending volatility, and category-wise overages.
                </p>
                <button className="btn btn-ghost" onClick={() => navigate("/analyse")}>
                  Deep Dive Analysis
                </button>
              </div>
              <div className="story-hero" style={{ background: 'var(--surface2)', padding: '3rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Latest Score</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '5rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
                    {latestAnalysis ? Math.round(latestAnalysis.ml?.ensembleScore) : "—"}
                  </div>
                  <div style={{ marginTop: '1rem', fontWeight: 600, color: insightColor }}>{latestAnalysis?.ml?.ensembleLevel} Stress</div>
                </div>
              </div>
            </div>
          </section>

          <footer style={{ textAlign: 'center', paddingBottom: '4rem' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '2rem' }}>Ready to log a new expense?</p>
            <button className="btn btn-gradient" style={{ padding: '16px 40px', fontSize: '16px' }} onClick={() => navigate("/tracker")}>
              <Plus size={18} /> Add New Entry
            </button>
          </footer>

        </div>
      )}
    </div>
  );
}


