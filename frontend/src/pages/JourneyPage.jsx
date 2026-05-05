import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid 
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Award, Zap, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
import { fmt, monthLabel } from '../utils/categories';

export default function JourneyPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/analysis')
      .then(res => {
        // Sort ascending for the chart
        const sorted = [...res.data].sort((a, b) => a.month.localeCompare(b.month));
        setHistory(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  
  const diff = previous ? latest.ml.ensembleScore - previous.ml.ensembleScore : 0;
  const isImproving = diff < 0;

  const chartData = history.map(h => ({
    name: monthLabel(h.month).split(' ')[0],
    score: Math.round(h.ml.ensembleScore),
    gap: h.snapshot.savingsGap,
    fullMonth: monthLabel(h.month)
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="soft-tooltip" style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
          <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>{d.fullMonth}</p>
          <p style={{ fontSize: '14px', color: 'var(--color-primary-dark)' }}>Stress Score: {d.score}</p>
          <p style={{ fontSize: '12px', color: d.gap >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {d.gap >= 0 ? 'Surplus: ' : 'Deficit: '}{fmt(Math.abs(d.gap))}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Your Journey.</h1>
          <p className="story-subtitle">Tracing your path toward financial peace.</p>
        </div>
      </header>

      {loading ? (
        <div className="spin-full"><div className="spin" /></div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '8rem 2rem' }}>
          <Calendar size={64} style={{ color: 'var(--color-border)', marginBottom: '2rem' }} />
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '1rem' }}>The story is just beginning.</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '3rem' }}>Complete your first monthly analysis to start tracking your progress.</p>
          <button className="btn btn-primary" onClick={() => navigate('/analyse')}>Run Analysis</button>
        </div>
      ) : (
        <div>
          <div className="story-split" style={{ gridTemplateColumns: '1.5fr 1fr', gap: '4rem', marginBottom: '6rem' }}>
            <div className="highlight-panel" style={{ height: '400px', padding: '3rem 2rem 1rem' }}>
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem' }}>Stress Score Over Time</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--color-primary)' }}>● Score</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="story-narrative" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ background: isImproving ? 'var(--color-accent)' : 'var(--surface2)', padding: '2.5rem', borderRadius: '32px' }}>
                {isImproving ? (
                  <TrendingDown size={48} color="var(--green)" style={{ marginBottom: '1.5rem' }} />
                ) : (
                  <TrendingUp size={48} color="var(--red)" style={{ marginBottom: '1.5rem' }} />
                )}
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontFamily: 'var(--serif)' }}>
                  {isImproving ? "You're finding your flow." : "A temporary peak."}
                </h2>
                <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                  {isImproving 
                    ? `Your stress score dropped by ${Math.abs(Math.round(diff))} points since last month. You're effectively building financial resilience.` 
                    : history.length > 1 
                      ? `Your stress increased slightly this month. Don't worry—identifying these trends is the first step toward correction.`
                      : "We've started tracking your trends. Keep using FinStress to see how your management improves over time."}
                </p>
              </div>
            </div>
          </div>

          <div className="divider" />

          <section style={{ marginBottom: '6rem' }}>
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '3rem' }}>Milestones</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
              {history.slice().reverse().map((h, i) => (
                <div key={h.month} className="highlight-panel fade-in" style={{ animationDelay: `${i * 0.1}s`, padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>{monthLabel(h.month)}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Monthly Milestone</span>
                    </div>
                    <div style={{ 
                      background: h.ml.ensembleLevel === 'Low' ? 'var(--green)' : h.ml.ensembleLevel === 'Medium' ? 'var(--amber)' : 'var(--red)',
                      color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 800
                    }}>
                      {h.ml.ensembleLevel.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Score</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.round(h.ml.ensembleScore)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Gap</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: h.snapshot.savingsGap >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {h.snapshot.savingsGap >= 0 ? '+' : ''}{Math.round(h.snapshot.savingsGap / 1000)}k
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '8px 0', fontSize: '13px' }} onClick={() => navigate('/analyse', { state: { month: h.month } })}>
                    Review Details →
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="highlight-panel" style={{ background: 'var(--color-primary-dark)', color: 'white', padding: '4rem', textAlign: 'center', borderRadius: '40px' }}>
            <ShieldCheck size={48} style={{ marginBottom: '2rem', opacity: 0.8 }} />
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2.5rem', marginBottom: '1.5rem' }}>The goal is resilience, not perfection.</h2>
            <p style={{ maxWidth: '600px', margin: '0 auto 3rem', opacity: 0.9, lineHeight: 1.6 }}>
              Fluctuations are a natural part of any financial journey. By consistently tracking your story, you're gaining the data needed to weather any storm.
            </p>
            <button className="btn btn-primary" style={{ background: 'white', color: 'var(--color-primary-dark)' }} onClick={() => navigate('/tracker')}>
              Continue Tracking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
