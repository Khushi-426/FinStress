import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import MonthNav from '../components/MonthNav';
import { EXPENSE_CATS, fmt, currentMonth } from '../utils/categories';

export default function BudgetPage() {
  const loc = useLocation();
  const [month,   setMonth]   = useState(loc.state?.month || currentMonth());
  const [targets, setTargets] = useState({});
  const [income,  setIncome]  = useState('');
  const [aid,     setAid]     = useState('');
  const [summary, setSummary] = useState(null);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);

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

  const save = async () => {
    await api.put('/budget', { month, targets, monthlyIncome: +income||0, financialAid: +aid||0 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const totalBudget   = Object.values(targets).reduce((s,v)=>s+(+v||0),0);
  const totalActual   = summary?.totalExpenses || 0;
  const totalIncome   = (+income||0) + (+aid||0);
  const remainBudget  = totalIncome - totalBudget;

  return (
    <div>
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontFamily:'var(--serif)',fontSize:'1.9rem',marginBottom:'.2rem'}}>
          Monthly <span style={{color:'var(--accent)',fontStyle:'italic'}}>Budget</span>
        </h1>
        <p style={{color:'var(--text2)',fontSize:14}}>Set your income and spending targets. The tracker and analysis use these for comparison.</p>
      </div>

      <MonthNav month={month} onChange={setMonth}/>

      {loading ? <div className="spin-full"><div className="spin"/></div> : (<>

        {/* Income section */}
        <div className="card">
          <div className="card-title"><div className="card-icon">💰</div>Income & financial aid</div>
          <div className="grid2">
            <div className="fg">
              <label>Monthly income ($)</label>
              <div className="ipre"><span className="sym">$</span>
                <input type="number" value={income} onChange={e=>setIncome(e.target.value)} placeholder="0" min="0"/>
              </div>
            </div>
            <div className="fg">
              <label>Financial aid ($)</label>
              <div className="ipre"><span className="sym">$</span>
                <input type="number" value={aid} onChange={e=>setAid(e.target.value)} placeholder="0" min="0"/>
              </div>
            </div>
          </div>
          {totalIncome > 0 && (
            <div style={{marginTop:10,padding:'9px 13px',background:'var(--surface2)',borderRadius:8,fontSize:13,color:'var(--text2)'}}>
              Total monthly income: <strong style={{color:'var(--text)'}}>{fmt(totalIncome)}</strong>
              {remainBudget < 0
                ? <span style={{color:'var(--red)',marginLeft:12}}>⚠️ Budget exceeds income by {fmt(Math.abs(remainBudget))}</span>
                : <span style={{color:'var(--green)',marginLeft:12}}>✅ {fmt(remainBudget)} unallocated</span>
              }
            </div>
          )}
        </div>

        {/* Category budgets */}
        <div className="card">
          <div className="card-title"><div className="card-icon">🎯</div>Category spending targets</div>
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {EXPENSE_CATS.map(cat => {
              const target = targets[cat.id] || 0;
              const actual = Math.round(summary?.byCategory?.[cat.id] || 0);
              const over   = target > 0 && actual > target;
              const pct    = target > 0 ? Math.min(actual / target, 1.5) : 0;
              const barColor = over ? 'var(--red)' : pct > 0.8 ? 'var(--amber)' : cat.color;

              return (
                <div key={cat.id}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{fontSize:20,width:28}}>{cat.icon}</span>
                    <span style={{fontSize:14,fontWeight:500,flex:1}}>{cat.label}</span>
                    <div className="ipre" style={{width:130}}>
                      <span className="sym">$</span>
                      <input type="number" value={targets[cat.id]||''} onChange={set(cat.id)} placeholder="No limit" min="0"
                        style={{paddingLeft:22,fontSize:13}}/>
                    </div>
                  </div>
                  {(actual > 0 || target > 0) && (
                    <div style={{paddingLeft:38}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)',marginBottom:3}}>
                        <span>Spent: <strong style={{color:over?'var(--red)':'var(--text)'}}>{fmt(actual)}</strong></span>
                        {target > 0 && <span>{over?'⚠️ over by '+fmt(actual-target):`${fmt(target-actual)} remaining`}</span>}
                      </div>
                      {target > 0 && (
                        <div className="bbar-track">
                          <div className="bbar-fill" style={{width:`${Math.min(pct*100,100)}%`,background:barColor}}/>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals summary */}
          <div style={{marginTop:'1.5rem',padding:'12px 14px',background:'var(--surface2)',borderRadius:10,display:'flex',gap:'2rem',flexWrap:'wrap',fontSize:13}}>
            <div><div style={{color:'var(--text3)',fontSize:11,marginBottom:2}}>Total budgeted</div><strong style={{fontSize:16}}>{fmt(totalBudget)}</strong></div>
            <div><div style={{color:'var(--text3)',fontSize:11,marginBottom:2}}>Total spent</div><strong style={{fontSize:16,color:totalActual>totalBudget&&totalBudget>0?'var(--red)':'var(--text)'}}>{fmt(totalActual)}</strong></div>
            {totalIncome > 0 && <div><div style={{color:'var(--text3)',fontSize:11,marginBottom:2}}>Unallocated</div><strong style={{fontSize:16,color:remainBudget<0?'var(--red)':'var(--green)'}}>{fmt(remainBudget)}</strong></div>}
          </div>
        </div>

        {/* Save button */}
        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          {saved && <div style={{display:'flex',alignItems:'center',color:'var(--green)',fontSize:14,gap:6}}>✅ Saved!</div>}
          <button className="btn btn-primary" onClick={save} style={{padding:'11px 28px'}}>
            💾 Save budget
          </button>
        </div>
      </>)}
    </div>
  );
}
