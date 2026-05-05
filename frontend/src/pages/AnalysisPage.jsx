import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../utils/api";
import MonthNav from "../components/MonthNav";
import {
  AlertTriangle, RefreshCw, Lightbulb, ArrowRight,
  TrendingUp, TrendingDown, Info, ShoppingBag, PiggyBank, CreditCard
} from "lucide-react";
import {
  fmt,
  currentMonth,
  monthLabel,
} from "../utils/categories";

function Hero({ level, riskFactor }) {
  const stressClass = `stress-${(level || "Low").toLowerCase()}`;
  
  return (
    <div className={`hero-narrative ${stressClass}`} style={{ boxShadow: 'none', border: 'none', background: 'transparent', padding: '6rem 2rem' }}>
      <div className="hero-bg">
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
      </div>
      <h1 className="hero-title" style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>
        Your stress is <span style={{ color: 'var(--color-primary-dark)' }}>{level || "..."}</span>
      </h1>
      <p className="hero-subtext" style={{ fontSize: '18px' }}>
        {riskFactor 
          ? `Driven mainly by ${riskFactor.toLowerCase()}`
          : "Analyzing your financial heartbeat..."}
      </p>
    </div>
  );
}

function FluidMeter({ score, level }) {
  const rotation = (score / 100) * 360;
  
  return (
    <div className="highlight-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '4rem', background: 'linear-gradient(135deg, #f0f3ff, #f8faff)' }}>
      <div className="fluid-meter" style={{ width: '180px', height: '180px' }}>
        <div className="fluid-ring" style={{ borderOpacity: 0.1 }} />
        <div className="fluid-fill" style={{ "--rotation": `${rotation}deg`, borderTopColor: 'var(--color-primary-dark)' }} />
        <div className="stress-value">
          <span className="stress-num" style={{ fontSize: '3rem' }}>{Math.round(score || 0)}</span>
          <span className="stress-label" style={{ fontSize: '12px' }}>SCORE</span>
        </div>
      </div>
      <div style={{ maxWidth: '300px' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Status: {level}</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.6 }}>
          Your score indicates a {level?.toLowerCase()} level of financial pressure. See our detailed breakdown below.
        </p>
      </div>
    </div>
  );
}

function NarrativeBlock({ children, delay = 0 }) {
  const [active, setActive] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  return (
    <div className={`reveal-block ${active ? "active" : ""}`} style={{ fontSize: '20px', marginBottom: '2rem' }}>
      {children}
    </div>
  );
}

function SmartSuggestion({ suggestion }) {
  const getIcon = (text) => {
    if (text.includes("save") || text.includes("savings")) return <PiggyBank size={24} />;
    if (text.includes("spend") || text.includes("expense") || text.includes("dining")) return <ShoppingBag size={24} />;
    return <CreditCard size={24} />;
  };

  return (
    <div className="section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '32px' }}>
      <div style={{ display: "flex", gap: "24px" }}>
        <div style={{ color: "var(--color-primary-dark)", background: 'var(--surface2)', padding: '16px', borderRadius: '16px', height: 'fit-content' }}>
          {getIcon(suggestion.text)}
        </div>
        <div>
          <h3 style={{ marginBottom: "8px", fontSize: "1.2rem" }}>Action Item</h3>
          <p style={{ fontSize: "16px", color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: '16px' }}>
            {suggestion.text}
          </p>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Impact: {suggestion.impact || "Medium"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const loc = useLocation();
  const [month, setMonth] = useState(loc.state?.month || currentMonth());
  const [analysis, setAnalysis] = useState(null);
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [sR] = await Promise.all([
        api.get(`/expenses/summary?month=${month}`),
      ]);
      setSummary(sR.data || null);
      
      try {
        const aR = await api.get(`/analysis/${month}`);
        setAnalysis(aR.data || null);
      } catch { setAnalysis(null); }
    } catch (e) { console.error("Analysis load error:", e); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const runAnalysis = async () => {
    if (!summary?.totalExpenses && !summary?.totalIncome) {
      return setError("Start tracking your expenses to see your financial insights.");
    }
    setError("");
    setRunning(true);
    try {
      const { data } = await api.post("/analysis/run", { month });
      setAnalysis(data);
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  const hasData = summary?.totalExpenses > 0 || summary?.totalIncome > 0;
  const ml = analysis?.ml;
  const sugs = analysis?.suggestions || [];
  const risks = ml?.topRiskFactors || [];
  const positives = ml?.topPositiveFactors || [];

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Your Story.</h1>
          <p className="story-subtitle">An in-depth look at your financial health for {monthLabel(month)}.</p>
        </div>
        <MonthNav month={month} onChange={(m) => { setMonth(m); setAnalysis(null); }} />
      </header>

      {!analysis && !running && (
        <div style={{ padding: '8rem 2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: "2.5rem", marginBottom: "1rem", fontFamily: 'var(--serif)' }}>Ready to reveal your story?</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "18px", marginBottom: "2.5rem", maxWidth: '500px', margin: '0 auto 2.5rem' }}>We will analyze your tracked data to guide your financial well-being.</p>
          <button className="btn btn-gradient" onClick={runAnalysis} disabled={!hasData} style={{ padding: '16px 40px', fontSize: '18px' }}>
            {hasData ? "Start Analysis" : "No Data to Analyze"}
          </button>
          {error && <div className="ferr">{error}</div>}
        </div>
      )}

      {running && (
        <div style={{ padding: '8rem 2rem', textAlign: 'center' }}>
          <RefreshCw size={64} className="spin" style={{ color: "var(--color-primary)", marginBottom: "2.5rem" }} />
          <h2 style={{ fontSize: "2.5rem", marginBottom: "1rem", fontFamily: 'var(--serif)' }}>Weaving your story...</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "18px" }}>Our advisor is looking through your tracked entries.</p>
        </div>
      )}

      {analysis && !running && (
        <div>
          <div className="story-hero">
            <span className="story-hero-val" style={{ color: ml?.ensembleLevel === 'High' ? 'var(--red)' : ml?.ensembleLevel === 'Medium' ? 'var(--amber)' : 'var(--green)' }}>
              Stress is {ml?.ensembleLevel}
            </span>
            <p className="story-hero-label">
              Based on your financial activity in {monthLabel(month)}.
            </p>
          </div>

          <div className="story-split" style={{ alignItems: 'flex-start' }}>
            <div className="story-narrative">
              <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '2rem' }}>The Breakdown</h2>
              <p>
                This month, you spent <strong className="text-blue">{fmt(analysis.snapshot?.totalExpenses || 0)}</strong> against an income of <strong className="text-green">{fmt(analysis.snapshot?.totalIncome || 0)}</strong>.
              </p>
              {risks.length > 0 && (
                <p>
                  Your stress is primarily affected by <span className="text-red">{risks.slice(0, 2).join(" and ")}</span>.
                  {analysis.snapshot?.overBudgetAmount > 0 && (
                    <> This includes <strong className="text-red">{fmt(analysis.snapshot.overBudgetAmount)}</strong> spent beyond your planned budget targets.</>
                  )}
                </p>
              )}
              {positives.length > 0 && (
                <p>
                  On the bright side, <span className="text-green">{positives[0]}</span> is helping keep your stress in check.
                </p>
              )}
              <p>
                Overall, you are in a <strong>{ml?.ensembleLevel === 'Low' ? 'healthy' : ml?.ensembleLevel === 'Medium' ? 'cautionary' : 'challenging'}</strong> financial position.
              </p>
            </div>
            <div className="story-hero" style={{ background: 'var(--surface2)', padding: '4rem 2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Stress Score</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '5rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
                  {Math.round(ml?.ensembleScore || 0)}
                </div>
                <div style={{ marginTop: '1rem', fontWeight: 600, color: ml?.ensembleLevel === 'High' ? 'var(--red)' : 'var(--green)' }}>
                  {ml?.ensembleLevel} Tension
                </div>
              </div>
            </div>
          </div>

          <div className="divider" />

          {sugs.length > 0 && (
            <section style={{ marginBottom: '6rem' }}>
              <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '3rem' }}>Action Items</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {sugs.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    <div style={{ background: 'var(--color-accent)', padding: '16px', borderRadius: '16px' }}>
                      <Lightbulb size={24} color="var(--color-primary-dark)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Suggestion</h3>
                      <p className="story-narrative" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{s.text}</p>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Potential Impact: {s.impact || "Medium"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ textAlign: "center", marginTop: "6rem", paddingBottom: '4rem' }}>
            <button className="btn btn-ghost" onClick={runAnalysis} style={{ border: 'none', color: 'var(--color-text-secondary)' }}>
              <RefreshCw size={14} /> Refresh Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

