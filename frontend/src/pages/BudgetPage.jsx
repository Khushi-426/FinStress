import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import MonthNav from '../components/MonthNav';
import { getMergedExpenseCats, fmt, currentMonth } from '../utils/categories';
import { useAuth } from '../context/AuthContext';
import { Plus, Tag, Trash2 } from 'lucide-react';

export default function BudgetPage() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const [month,   setMonth]   = useState(loc.state?.month || currentMonth());
  const [targets, setTargets] = useState({});
  const [income,  setIncome]  = useState('');
  const [aid,     setAid]     = useState('');
  const [summary, setSummary] = useState(null);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCat,  setNewCat]  = useState({ label: '', icon: '📦' });
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bR, sR] = await Promise.all([
        api.get(`/budget?month=${month}`),
        api.get(`/expenses/summary?month=${month}`),
      ]);
      setTargets(bR.data.targets || {});
      setIncome(bR.data.monthlyIncome || '');
      setAid(bR.data.financialAid || '');
      setSummary(sR.data);
    } catch {}
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); setSaved(false); }, [load]);

  const set = k => e => setTargets(t => ({ ...t, [k]: +e.target.value || 0 }));

  const addCategory = async () => {
    if (!newCat.label) return;
    const cat = {
      id: newCat.label.toLowerCase().replace(/\s+/g, '_'),
      label: newCat.label,
      icon: newCat.icon,
      type: 'expense',
      color: '#90a4ae'
    };
    try {
      await api.post('/auth/categories', { category: cat });
      await refresh();
      setNewCat({ label: '', icon: '📦' });
      setShowAdd(false);
    } catch (e) { alert(e.message); }
  };

  const deleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category? All related budget targets will be reset.')) return;
    try {
      await api.delete(`/auth/categories/${catId}`);
      await refresh();
      const newTargets = { ...targets };
      delete newTargets[catId];
      setTargets(newTargets);
    } catch (e) { alert(e.message); }
  };

  const save = async () => {
    await api.put('/budget', { month, targets, monthlyIncome: +income||0, financialAid: +aid||0 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const expenseCats = getMergedExpenseCats(user?.customCategories || [])
    .filter(c => !(user?.hiddenCategories || []).includes(c.id));

  const totalBudget   = Object.values(targets).reduce((s,v)=>s+(+v||0),0);
  const totalActual   = summary?.totalExpenses || 0;
  const totalIncome   = (+income||0) + (+aid||0);
  const remainBudget  = totalIncome - totalBudget;

  const mainInsight = remainBudget < 0 
    ? `Your budget exceeds your income by ${fmt(Math.abs(remainBudget))}` 
    : `You have ${fmt(remainBudget)} unallocated in your plan`;

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Monthly Plan.</h1>
          <p className="story-subtitle">Design your spending strategy for the month.</p>
        </div>
        <MonthNav month={month} onChange={setMonth}/>
      </header>

      {loading ? <div className="spin-full"><div className="spin"/></div> : (
        <div>
          <div className="story-hero">
            <span className="story-hero-val" style={{ color: remainBudget < 0 ? 'var(--red)' : 'var(--green)' }}>{mainInsight}</span>
            <p className="story-hero-label">
              Total Budgeted: <strong className="text-blue">{fmt(totalBudget)}</strong> | Total Income: <strong className="text-green">{fmt(totalIncome)}</strong>
            </p>
          </div>

          <section style={{ marginBottom: '6rem' }}>
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '3rem' }}>Income & Aid</h2>
            <div className="story-split">
              <div className="story-narrative">
                <p>
                  Your plan begins with your total available funds. 
                  We include your <strong>base income</strong> and any <strong>financial aid</strong> you expect to receive.
                </p>
                <p>
                  Setting an accurate income is crucial for our AI to determine your true financial stress level.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="fg">
                  <label>Monthly Income</label>
                  <div className="soft-input-wrap">
                    <span className="soft-input-prefix">₹</span>
                    <input type="number" value={income} onChange={e=>setIncome(e.target.value)} placeholder="0" min="0" />
                  </div>
                </div>
                <div className="fg">
                  <label>Financial Aid</label>
                  <div className="soft-input-wrap">
                    <span className="soft-input-prefix">₹</span>
                    <input type="number" value={aid} onChange={e=>setAid(e.target.value)} placeholder="0" min="0" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="divider" />

          <section style={{ marginBottom: '6rem' }}>
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '3rem' }}>Spending Targets</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
              <div className="story-narrative" style={{ margin: 0 }}>
                <p>
                  Assign your limits for each category. We'll compare your actual spending against these targets in real-time.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {(user?.hiddenCategories?.length > 0) && (
                  <button className="btn btn-ghost" onClick={async () => {
                    for (const catId of user.hiddenCategories) {
                      await api.post('/auth/categories/restore', { catId });
                    }
                    await refresh();
                  }}>
                    Restore Hidden
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setShowAdd(!showAdd)}>
                  <Plus size={16} /> Add Custom Category
                </button>
              </div>
            </div>

            {showAdd && (
              <div className="fade-in highlight-panel" style={{ marginBottom: '4rem', padding: '2.5rem', background: 'var(--color-secondary)', borderRadius: '24px', border: '1px solid var(--color-primary)' }}>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>New Category</h3>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
                  <div className="fg" style={{ flex: 1 }}>
                    <label>What should we call it?</label>
                    <input type="text" value={newCat.label} onChange={e => setNewCat(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Subscriptions" />
                  </div>
                  <div className="fg" style={{ width: '100px' }}>
                    <label>Icon/Emoji</label>
                    <input type="text" value={newCat.icon} onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: '1.5rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={addCategory} style={{ padding: '12px 32px' }}>Create Category</button>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{display:'flex',flexDirection:'column',gap:'3.5rem'}}>
              {expenseCats.map(cat => {
                const target = targets[cat.id] || 0;
                const actual = Math.round(summary?.byCategory?.[cat.id] || 0);
                const over   = target > 0 && actual > target;
                const pct    = target > 0 ? Math.min(actual / target, 1.5) : 0;
                const barColor = over ? 'var(--red)' : pct > 0.8 ? 'var(--amber)' : cat.color;

                return (
                  <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '5rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
                        <span style={{fontSize:32}}>{cat.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{fontSize:18,fontWeight:600}}>{cat.label}</span>
                              <button 
                                className="btn btn-xs btn-ghost" 
                                style={{ color: 'var(--red)', border: 'none', padding: '4px', opacity: 0.85 }}
                                onClick={() => deleteCategory(cat.id)}
                                title="Remove category from budget"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {actual > 0 && (
                              <span style={{ fontSize: 14, color: over ? 'var(--red)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                                {fmt(actual)} spent
                              </span>
                            )}
                          </div>
                          {target > 0 && (
                            <div style={{ height: "6px", background: "var(--surface2)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ height: "100%", background: barColor, width: `${Math.min(pct*100, 100)}%`, transition: "width 0.6s ease" }} />
                            </div>
                          )}
                          {target > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              {over ? `\u2191 ${fmt(actual-target)} over limit` : `${fmt(target-actual)} remaining`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="fg" style={{ marginTop: '4px' }}>
                      <label>Target Amount</label>
                      <div className="soft-input-wrap">
                        <span className="soft-input-prefix">₹</span>
                        <input type="number" value={targets[cat.id] === undefined ? '' : targets[cat.id]} onChange={set(cat.id)} placeholder="0" min="0"/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <footer style={{ display:'flex', justifyContent:'center', alignItems: 'center', gap: '2rem', marginTop: '6rem', paddingBottom: '6rem' }}>
            {saved && <div className="text-green" style={{fontSize:16}}>Saved successfully.</div>}
            <button className="btn btn-gradient" onClick={save} style={{padding:'18px 60px', fontSize: '18px'}}>
              Update My Plan
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}


