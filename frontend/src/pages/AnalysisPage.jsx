import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import api from "../utils/api";
import MonthNav from "../components/MonthNav";
import {
  AlertTriangle, CheckCircle, XCircle,
  FlaskConical, Search, PieChart as PieIcon, BarChart2,
  TrendingUp, Lightbulb, RefreshCw,
} from "lucide-react";
import {
  CATEGORIES,
  CAT_MAP,
  fmt,
  currentMonth,
  STRESS_COLOR,
  STRESS_BG,
  monthLabel,
} from "../utils/categories";

// ── Stress ring ───────────────────────────────────────────────────────────────
function Ring({ score, level, label, size = 130 }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const color = STRESS_COLOR(level);
  const bg = STRESS_BG(level);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bg}
          strokeWidth={size * 0.075}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.075}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - (score || 0) / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontFamily="DM Serif Display,serif"
          fontSize={size * 0.25}
          fill={color}
        >
          {Math.round(score || 0)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + size * 0.13}
          textAnchor="middle"
          fontFamily="DM Sans,sans-serif"
          fontSize={size * 0.088}
          fill={color}
        >
          {level || "—"}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ── SHAP bar ──────────────────────────────────────────────────────────────────
function ShapBar({ item, max }) {
  const w = (Math.abs(item.shap_value) / (max || 1)) * 50;
  return (
    <div className="shap-row">
      <div className="shap-label" title={item.display_name}>
        {item.display_name}
      </div>
      <div className="shap-track">
        <div
          className={`shap-fill ${item.shap_value > 0 ? "pos" : "neg"}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <div
        className="shap-val"
        style={{ color: item.shap_value > 0 ? "var(--red)" : "var(--green)" }}
      >
        {item.shap_value > 0 ? "+" : ""}
        {item.shap_value.toFixed(2)}
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const loc = useLocation();
  const [month, setMonth] = useState(loc.state?.month || currentMonth());
  const [analysis, setAnalysis] = useState(null);
  const [summary, setSummary] = useState(null);
  const [budget, setBudget] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("score");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [sR, bR, hR] = await Promise.all([
        api.get(`/expenses/summary?month=${month}`),
        api.get(`/budget?month=${month}`),
        api.get("/analysis"),
      ]);
      setSummary(sR.data || null);
      setBudget(bR.data || null);
      setHistory(Array.isArray(hR.data) ? hR.data : []);
      // try load existing analysis for this month
      try {
        const aR = await api.get(`/analysis/${month}`);
        setAnalysis(aR.data || null);
      } catch {
        setAnalysis(null);
      }
    } catch (e) {
      console.error("Analysis load error:", e);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = async () => {
    if (!summary?.totalExpenses && !summary?.totalIncome) {
      return setError(
        "No expense data found for this month. Add entries in the Tracker first.",
      );
    }
    setError("");
    setRunning(true);
    try {
      const { data } = await api.post("/analysis/run", { month });
      setAnalysis(data);
      setTab("score");
      // refresh history
      const hR = await api.get("/analysis");
      setHistory(Array.isArray(hR.data) ? hR.data : []);
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  const ml = analysis?.ml;
  const snap = analysis?.snapshot;
  const sugs = analysis?.suggestions || [];
  const shapMax = ml?.shapValues?.length
    ? Math.max(...ml.shapValues.map((s) => Math.abs(s.shap_value)), 0.01)
    : 1;

  // Spending donut data
  const pieData = CATEGORIES.filter((c) => c.type === "expense")
    .map((c) => ({
      name: c.label,
      icon: c.icon,
      color: c.color,
      value: Math.round(
        snap?.byCategory?.[c.id] || summary?.byCategory?.[c.id] || 0,
      ),
    }))
    .filter((d) => d.value > 0);

  // Budget vs actual bar data
  const budgetData = CATEGORIES.filter((c) => c.type === "expense")
    .map((c) => ({
      name: c.label,
      Spent: Math.round(
        snap?.byCategory?.[c.id] || summary?.byCategory?.[c.id] || 0,
      ),
      Budget: Math.round(budget?.targets?.[c.id] || 0),
    }))
    .filter((d) => d.Spent > 0 || d.Budget > 0);

  // Trend data
  const trendData = [...(Array.isArray(history) ? history : [])]
    .reverse()
    .map((a) => ({
      month: a.month || "",
      label: a.month?.slice(5) || "",
      score: Math.round(a.ml?.ensembleScore || 0),
      level: a.ml?.ensembleLevel || "Low",
      gap: Math.round(a.snapshot?.savingsGap || 0),
    }));

  const hasData = summary?.totalExpenses > 0 || summary?.totalIncome > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: "1.9rem",
            marginBottom: ".2rem",
          }}
        >
          Financial{" "}
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>
            Analysis
          </span>
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>
          Built from your real expense data — not estimates.
        </p>
      </div>

      <MonthNav
        month={month}
        onChange={(m) => {
          setMonth(m);
          setAnalysis(null);
        }}
      />

      {/* Data preview card */}
      <div className="card card-sm" style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
              fontSize: 13,
            }}
          >
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}
              >
                Income tracked
              </div>
              <strong style={{ color: "var(--green)", fontSize: 16 }}>
                {fmt(summary?.totalIncome || 0)}
              </strong>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}
              >
                Expenses tracked
              </div>
              <strong style={{ fontSize: 16 }}>
                {fmt(summary?.totalExpenses || 0)}
              </strong>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 11, marginBottom: 2 }}
              >
                Net
              </div>
              <strong
                style={{
                  fontSize: 16,
                  color:
                    (summary?.savingsGap || 0) < 0
                      ? "var(--red)"
                      : "var(--green)",
                }}
              >
                {(summary?.savingsGap || 0) >= 0 ? "+" : ""}
                {fmt(summary?.savingsGap || 0)}
              </strong>
            </div>
            {analysis && (
              <div>
                <div
                  style={{
                    color: "var(--text3)",
                    fontSize: 11,
                    marginBottom: 2,
                  }}
                >
                  Last run
                </div>
                <strong style={{ fontSize: 13 }}>
                  {new Date(analysis.createdAt).toLocaleDateString()}
                </strong>
              </div>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={running || !hasData}
            style={{ padding: "11px 28px", fontSize: 15 }}
          >
            {running
              ? <><RefreshCw size={15} strokeWidth={2} style={{ animation: "spin .8s linear infinite" }} /> Analysing…</>
              : analysis
                ? <><RefreshCw size={15} strokeWidth={2} /> Re-run Analysis</>
                : <><FlaskConical size={15} strokeWidth={1.8} /> Run Analysis</>}
          </button>
        </div>
        {!hasData && (
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={13} strokeWidth={2} color="var(--amber)" />
            No data for {monthLabel(month)}.{" "}
            <a href="/tracker" style={{ color: "var(--accent)" }}>Add expenses in the Tracker →</a>
          </div>
        )}
        {error && (
          <div className="ferr" style={{ marginTop: 8, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>
            <XCircle size={14} strokeWidth={2} /> {error}
          </div>
        )}
      </div>

      {/* No analysis yet */}
      {!analysis && !running && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "3rem 2rem" }}
        >
          <FlaskConical size={48} strokeWidth={1.2} style={{ margin: "0 auto 1rem", display: "block", color: "var(--text3)" }} />
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: "1.5rem",
              marginBottom: ".5rem",
            }}
          >
            Ready to analyse
          </h2>
          <p
            style={{
              color: "var(--text2)",
              fontSize: 14,
              maxWidth: 420,
              margin: "0 auto 1.5rem",
            }}
          >
            Click "Run Analysis" to compute your stress score from your tracked
            expenses using the FT-Transformer + XGBoost ensemble model with SHAP
            explanations.
          </p>
          {hasData && (
            <button className="btn btn-primary" onClick={runAnalysis}>
              <FlaskConical size={15} strokeWidth={1.8} /> Run Analysis now
            </button>
          )}
        </div>
      )}

      {running && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spin" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text2)", fontSize: 14 }}>
            Running FT-Transformer + XGBoost + SHAP…
          </p>
        </div>
      )}

      {/* Results */}
      {analysis && !running && (
        <>
          {/* Tabs */}
          <div className="card">
            <div className="tabs">
              {[
                ["score",       <><TrendingUp  size={13} strokeWidth={1.8}/> Stress Score</>],
                ["shap",        <><Search      size={13} strokeWidth={1.8}/> SHAP</>],
                ["spending",    <><PieIcon     size={13} strokeWidth={1.8}/> Spending</>],
                ["budget",      <><BarChart2   size={13} strokeWidth={1.8}/> vs Budget</>],
                ["trends",      <><TrendingUp  size={13} strokeWidth={1.8}/> Trends</>],
                ["suggestions", <><Lightbulb  size={13} strokeWidth={1.8}/> Tips ({sugs.length})</>],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={`tab ${tab === k ? "active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* ── SCORE TAB ── */}
            {tab === "score" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-around",
                    flexWrap: "wrap",
                    gap: "1rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <Ring
                    score={ml?.ftStressScore}
                    level={ml?.ftStressLevel}
                    label="FT-Transformer"
                    size={140}
                  />
                  <Ring
                    score={ml?.xgbStressScore}
                    level={ml?.xgbStressLevel}
                    label="XGBoost"
                    size={140}
                  />
                  <Ring
                    score={ml?.ensembleScore}
                    level={ml?.ensembleLevel}
                    label="Ensemble (final)"
                    size={160}
                  />
                </div>

                {/* XGB probabilities */}
                <div
                  style={{
                    background: "var(--surface2)",
                    borderRadius: 10,
                    padding: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text3)",
                      textTransform: "uppercase",
                      letterSpacing: ".3px",
                      marginBottom: 10,
                    }}
                  >
                    XGBoost class probabilities
                  </div>
                  {[
                    ["Low", ml?.xgbProbLow, "var(--green)"],
                    ["Medium", ml?.xgbProbMedium, "var(--amber)"],
                    ["High", ml?.xgbProbHigh, "var(--red)"],
                  ].map(([l, p, c]) => (
                    <div
                      key={l}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ width: 52, color: "var(--text2)" }}>
                        {l}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "var(--border)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.round((p || 0) * 100)}%`,
                            background: c,
                            borderRadius: 4,
                            transition: "width .6s",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: 38,
                          textAlign: "right",
                          fontWeight: 600,
                          color: c,
                        }}
                      >
                        {Math.round((p || 0) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* Snapshot metrics */}
                <div className="mg">
                  {[
                    ["Income", fmt(snap?.totalIncome || 0), "this month", ""],
                    [
                      "Expenses",
                      fmt(snap?.totalExpenses || 0),
                      `${Math.round((snap?.expenseRatio || 0) * 100)}% of income`,
                      "",
                    ],
                    [
                      "Net",
                      `${(snap?.savingsGap || 0) >= 0 ? "+" : "-"}${fmt(snap?.savingsGap || 0)}`,
                      (snap?.savingsGap || 0) < 0 ? "deficit" : "surplus",
                      (snap?.savingsGap || 0) < 0 ? "danger" : "good",
                    ],
                    [
                      "Essential",
                      fmt(snap?.essentialSpend || 0),
                      "housing/food/study",
                      "",
                    ],
                    [
                      "Discretionary",
                      fmt(snap?.discretionarySpend || 0),
                      `${Math.round((snap?.discretionaryRatio || 0) * 100)}% of income`,
                      (snap?.discretionaryRatio || 0) > 0.3 ? "danger" : "",
                    ],
                    [
                      "Stress",
                      `${Math.round(ml?.ensembleScore || 0)}/100`,
                      ml?.ensembleLevel,
                      ml?.ensembleLevel === "High"
                        ? "danger"
                        : ml?.ensembleLevel === "Low"
                          ? "good"
                          : "warn",
                    ],
                  ].map(([l, v, s, cls]) => (
                    <div key={l} className={`mc ${cls}`}>
                      <div className="ml">{l}</div>
                      <div className="mv">{v}</div>
                      <div className="ms">{s}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── SHAP TAB ── */}
            {tab === "shap" && (
              <>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    marginBottom: "1rem",
                    lineHeight: 1.7,
                    background: "var(--surface2)",
                    padding: "12px 14px",
                    borderRadius: 8,
                  }}
                >
                  <strong>How to read this:</strong> SHAP shows exactly what
                  drove your stress score of{" "}
                  <strong>{Math.round(ml?.ensembleScore || 0)}</strong>.
                  <span style={{ color: "var(--red)", fontWeight: 500 }}>
                    {" "}
                    Red bars push it higher
                  </span>
                  ,
                  <span style={{ color: "var(--green)", fontWeight: 500 }}>
                    {" "}
                    green bars pull it lower
                  </span>
                  . Base value:{" "}
                  <strong>{ml?.shapBaseValue?.toFixed(1) || "—"}</strong>.
                </div>

                {ml?.shapValues?.length > 0 ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        fontSize: 11,
                        color: "var(--text3)",
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ width: 190 }}>Feature</span>
                      <span style={{ flex: 1, textAlign: "center" }}>
                        ← reduces stress &nbsp;|&nbsp; increases stress →
                      </span>
                      <span style={{ width: 48, textAlign: "right" }}>
                        SHAP
                      </span>
                    </div>
                    {ml.shapValues.slice(0, 12).map((item, i) => (
                      <ShapBar key={i} item={item} max={shapMax} />
                    ))}
                  </>
                ) : (
                  <div style={{ padding: "1.5rem", background: "var(--surface2)", borderRadius: 8, fontSize: 13, color: "var(--text2)", display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={14} strokeWidth={2} color="var(--amber)" />
                    SHAP values not available — run{" "}
                    <code>python ml/train.py</code> to enable the ML service.
                    Using rule-based fallback score.
                  </div>
                )}

                <div
                  style={{
                    marginTop: "1.25rem",
                    padding: "1rem",
                    background: "var(--surface2)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}
                  >
                    Top factors at a glance
                  </div>
                  <div
                    style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} /> Increasing your stress
                      </div>
                      {ml?.topRiskFactors?.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: "var(--red)",
                            marginBottom: 3,
                          }}
                        >
                          • {f}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} /> Reducing your stress
                      </div>
                      {ml?.topPositiveFactors?.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: "var(--green)",
                            marginBottom: 3,
                          }}
                        >
                          • {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── SPENDING TAB ── */}
            {tab === "spending" && (
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <ResponsiveContainer
                  width="55%"
                  height={280}
                  style={{ minWidth: 220 }}
                >
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                    >
                      {pieData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmt(v)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {pieData.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: e.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, color: "var(--text2)" }}>
                        {e.icon} {e.name}
                      </span>
                      <span style={{ fontWeight: 600 }}>{fmt(e.value)}</span>
                      <span style={{ color: "var(--text3)", fontSize: 11 }}>
                        {snap?.totalExpenses > 0
                          ? Math.round((e.value / snap.totalExpenses) * 100) +
                            "%"
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── BUDGET TAB ── */}
            {tab === "budget" &&
              (budgetData.some((d) => d.Budget > 0) ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(
                    budgetData.filter((d) => d.Spent > 0 || d.Budget > 0)
                      .length *
                      45 +
                      60,
                    200,
                  )}
                >
                  <BarChart
                    data={budgetData.filter((d) => d.Spent > 0 || d.Budget > 0)}
                    layout="vertical"
                    margin={{ left: 80, right: 20 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v) => fmt(v)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="Spent"
                      fill="var(--accent)"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="Budget"
                      fill="var(--text3)"
                      opacity={0.4}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "var(--text2)",
                    fontSize: 13,
                  }}
                >
                  No budget targets set yet.{" "}
                  <a href="/budget" style={{ color: "var(--accent)" }}>
                    Set budgets →
                  </a>
                </div>
              ))}

            {/* ── TRENDS TAB ── */}
            {tab === "trends" &&
              (trendData.length > 1 ? (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text3)",
                      marginBottom: 12,
                    }}
                  >
                    Stress score over past {trendData.length} months
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData}>
                      <XAxis
                        dataKey="label"
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
                        dot={({ cx, cy, payload }) => (
                          <circle
                            key={cx}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={STRESS_COLOR(payload.level)}
                            stroke="none"
                          />
                        )}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 11,
                      color: "var(--text3)",
                      marginTop: 8,
                    }}
                  >
                    <span style={{ color: "var(--green)" }}>
                      — Low (&lt;33)
                    </span>
                    <span style={{ color: "var(--amber)" }}>
                      — Medium (33–66)
                    </span>
                    <span style={{ color: "var(--red)" }}>— High (&gt;66)</span>
                  </div>

                  {/* Monthly history table */}
                  <div style={{ marginTop: "1.5rem" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text3)",
                        textTransform: "uppercase",
                        letterSpacing: ".3px",
                        marginBottom: 8,
                      }}
                    >
                      Monthly breakdown
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {trendData
                        .slice()
                        .reverse()
                        .map((d) => (
                          <div
                            key={d.month}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "8px 12px",
                              background: "var(--surface2)",
                              borderRadius: 8,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ width: 60, color: "var(--text3)" }}>
                              {d.month}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  height: 6,
                                  background: "var(--border)",
                                  borderRadius: 3,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${d.score}%`,
                                    background: STRESS_COLOR(d.level),
                                    borderRadius: 3,
                                  }}
                                />
                              </div>
                            </div>
                            <span className={`badge ${d.level}`}>
                              {d.score}/100
                            </span>
                            <span
                              style={{
                                color:
                                  d.gap < 0 ? "var(--red)" : "var(--green)",
                                fontWeight: 500,
                              }}
                            >
                              {d.gap >= 0 ? "+" : ""}
                              {fmt(d.gap)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "var(--text2)",
                    fontSize: 13,
                  }}
                >
                  Run analysis for multiple months to see trends here.
                </div>
              ))}

            {/* ── SUGGESTIONS TAB ── */}
            {tab === "suggestions" &&
              sugs.map((s, i) => (
                <div key={i} className={`sug ${s.severity}`}>
                  <div className="sug-icon">
                    {s.severity === "danger"
                      ? <XCircle    size={18} strokeWidth={1.8} color="var(--red)" />
                      : s.severity === "warn"
                        ? <AlertTriangle size={18} strokeWidth={1.8} color="var(--amber)" />
                        : <CheckCircle  size={18} strokeWidth={1.8} color="var(--green)" />}
                  </div>
                  <div>
                    <div className="sug-title">{s.title}</div>
                    <div className="sug-text">{s.text}</div>
                    {s.potential > 0 && (
                      <span className="sug-save">
                        Save up to {fmt(s.potential)}/mo
                      </span>
                    )}
                  </div>
                </div>
              ))}

          </div>
        </>
      )}
    </div>
  );
}
