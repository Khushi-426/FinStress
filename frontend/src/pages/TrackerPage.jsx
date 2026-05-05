import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Pencil, Trash2, Repeat, Inbox, Plus, List, DollarSign, AlertTriangle, Download, Save } from 'lucide-react';
import api from '../utils/api';
import MonthNav    from '../components/MonthNav';
import ExpenseModal from '../components/ExpenseModal';
import LoadingState from '../components/LoadingState';
import ErrorState   from '../components/ErrorState';
import DOMPurify    from 'dompurify';
import { getMergedExpenseCats, getMergedCategories, fmt, currentMonth } from '../utils/categories';
import { useAuth } from '../context/AuthContext';

const groupByDate = (items) => {
  const groups = {};
  items.forEach(e => {
    const d = e.date?.slice(0,10) || 'Unknown';
    if (!groups[d]) groups[d] = [];
    groups[d].push(e);
  });
  return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a));
};

const fmtDay = (d) => {
  const date = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(12,0,0,0);
  const yest  = new Date(today); yest.setDate(yest.getDate()-1);
  if (date.toDateString()===today.toDateString()) return 'Today';
  if (date.toDateString()===yest.toDateString())  return 'Yesterday';
  return date.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
};

export default function TrackerPage() {
  const { user } = useAuth();
  const loc = useLocation();
  const [month,    setMonth]    = useState(loc.state?.month || currentMonth());
  const [items,    setItems]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [budget,   setBudget]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [editing,  setEditing]  = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [err,      setErr]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [eR, sR, bR] = await Promise.all([
        api.get(`/expenses?month=${month}&limit=500`),
        api.get(`/expenses/summary?month=${month}`),
        api.get(`/budget?month=${month}`),
      ]);
      setItems(eR.data.items || eR.data); // Handle both old and paginated response
      setSummary(sR.data);
      setBudget(bR.data._id ? bR.data : null);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    try {
      let resp;
      if (editing?._id) {
        resp = await api.patch(`/expenses/${editing._id}`, form);
        setItems(prev => prev.map(e => e._id===editing._id ? resp.data : e));
      } else {
        resp = await api.post('/expenses', form);
        setItems(prev => [resp.data, ...prev]);
      }
      
      if (resp.data.alert) {
        alert(resp.data.alert.message);
      }

      const sR = await api.get(`/expenses/summary?month=${month}`);
      setSummary(sR.data);
    } catch(e) { alert(e.message); }
    setShowModal(false);
    setEditing(null);
  };

  const handleExport = async () => {
    try {
      const resp = await api.get(`/expenses/export?month=${month}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `finstress-${month}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) { alert('Export failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await api.delete(`/expenses/${id}`);
    setItems(prev => prev.filter(e=>e._id!==id));
    const sR = await api.get(`/expenses/summary?month=${month}`);
    setSummary(sR.data);
  };

  const filtered = filter==='all' ? items
    : filter==='income'  ? items.filter(e=>e.type==='income'||e.category==='financial_aid')
    : filter==='recurring' ? items.filter(e=>e.isRecurring)
    : items.filter(e=>e.category===filter);

  const groups = groupByDate(filtered);
  const plannedIn = (budget?.monthlyIncome || 0) + (budget?.financialAid || 0);
  const trackedIn = summary?.totalIncome || 0;
  const totalIn  = plannedIn + trackedIn;
  const totalOut = summary?.totalExpenses || 0;
  const gap      = totalIn - totalOut;

  const expenseCats = getMergedExpenseCats(user?.customCategories || []);
  // Enforcement: All categories must have a target (can be 0) to be considered "complete"
  const isBudgetComplete = budget && budget.targets && expenseCats.every(c => (c.id in budget.targets));

  const mainInsight = gap < 0 
    ? `Deficit Warning: ${fmt(Math.abs(gap))} over your plan` 
    : `Financial Buffer: ${fmt(gap)} saved`;

  const insightDescription = gap < 0
    ? `Warning: Your current spending has exceeded your planned income for this month by ${fmt(Math.abs(gap))}. This deficit directly contributes to higher financial stress. We recommend reviewing your high-cost categories to bridge this gap.`
    : `Good News: You are successfully living within your means. You have a surplus of ${fmt(gap)} which reduces your overall financial tension and builds your resilience for future months.`;

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Your Spending.</h1>
          <p className="story-subtitle">The timeline of your financial activities.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <button className="btn btn-ghost" style={{ padding: '12px 20px' }} onClick={handleExport}>
            <Download size={16} /> Export
          </button>
          <MonthNav month={month} onChange={setMonth}/>
          <button 
            className={`btn ${budget ? 'btn-gradient' : 'btn-ghost'}`} 
            style={{ padding: '12px 24px' }} 
            onClick={()=>{
              if (!isBudgetComplete) {
                alert("Please complete all categories in your budget for this month first!");
                return;
              }
              setEditing(null);
              setShowModal(true);
            }}
          >
            <Plus size={18} /> New Entry
          </button>
        </div>
      </header>

      <div className="story-hero">
        <span className="story-hero-val" style={{ color: gap < 0 ? 'var(--red)' : 'var(--green)' }}>{mainInsight}</span>
        <p className="story-hero-label">
          Tracked across <strong className="text-blue">{items.length}</strong> transactions.
        </p>
      </div>

      <div className="story-narrative" style={{ textAlign: 'center', marginBottom: '4rem', maxWidth: '800px', margin: '0 auto 4rem' }}>
        <p>
          {insightDescription}
        </p>
      </div>

      <div className="divider" />

      <section style={{ marginBottom: '4rem' }}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:'3rem', justifyContent: 'center'}}>
          {[
            {id:'all',      label:'All',       Icon: List        },
            {id:'income',   label:'Income',    Icon: DollarSign  },
            {id:'recurring',label:'Recurring', Icon: Repeat      },
          ].map(c=>(
            <button key={c.id} className={`btn btn-sm ${filter===c.id?'btn-gradient':'btn-ghost'}`}
              onClick={()=>setFilter(c.id)}
              style={{ padding: '10px 20px', borderRadius: '20px' }}>
              {c.Icon && <c.Icon size={14} style={{marginRight:8}} />}
              {c.label}
            </button>
          ))}
        </div>

        {loading ? <LoadingState message="Fetching your transactions..." /> : err ? <ErrorState error={err} onRetry={load} /> : (
          !isBudgetComplete ? (
            <div style={{textAlign:'center',padding:'8rem 0', background: 'var(--surface2)', borderRadius: '32px', border: '2px dashed var(--color-border)'}}>
              <AlertTriangle size={64} strokeWidth={1} style={{margin:'0 auto 2rem',color:'var(--red)', opacity: 0.8}}/>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2.5rem', marginBottom: '1rem' }}>One quick setup needed.</h2>
              <p style={{color:'var(--color-text-secondary)',fontSize:18,marginBottom:'1rem', maxWidth: '550px', margin: '0 auto 1rem'}}>
                To provide accurate stress analysis, you must assign a spending target to **every category** in your budget before tracking expenses.
              </p>
              
              <div style={{maxWidth:'400px', margin:'0 auto 3rem', padding:'1.5rem', background:'var(--color-surface)', borderRadius:'16px', textAlign:'left', border:'1px solid var(--color-border)'}}>
                <strong style={{fontSize:'14px', color:'var(--color-text-primary)'}}>Missing targets for:</strong>
                <ul style={{listStyle:'none', paddingLeft:0, marginTop:'0.75rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  {expenseCats.filter(c => !(c.id in (budget?.targets || {}))).map(c => (
                    <li key={c.id} style={{fontSize:'13px', color:'var(--red)'}}>✗ {c.label}</li>
                  ))}
                </ul>
              </div>

              <button 
                className="btn btn-gradient" 
                style={{ padding: '16px 48px', fontSize: '18px' }} 
                onClick={() => window.location.href = '/budget'}
              >
                Complete All Budget Targets
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div style={{textAlign:'center',padding:'8rem 0'}}>
              <Inbox size={64} strokeWidth={1} style={{margin:'0 auto 2rem',color:'var(--color-text-secondary)', opacity: 0.5}}/>
              <p style={{color:'var(--color-text-secondary)',fontSize:18,marginBottom:'2rem'}}>
                No transactions found for this period.
              </p>
              <button className="btn btn-gradient" style={{ padding: '14px 32px' }} onClick={()=>{setEditing(null);setShowModal(true);}}>Add Entry</button>
            </div>
          ) : (
            <div className="timeline">
              {groups.map(([date, exps]) => {
                const dayTotal = exps.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
                const dayIncome = exps.filter(e=>e.type==='income'||e.category==='financial_aid').reduce((s,e)=>s+e.amount,0);
                return (
                  <div key={date} style={{ marginBottom: '4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', whiteSpace: 'nowrap' }}>{fmtDay(date)}</h3>
                      <div className="divider" style={{ flex: 1, margin: 0, opacity: 0.3 }} />
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '14px', fontWeight: 700 }}>
                        {dayIncome > 0 && <span className="text-green">+{fmt(dayIncome)}</span>}
                        {dayTotal > 0 && <span className="text-blue">-{fmt(dayTotal)}</span>}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {exps.map(e => {
                        const allCats = getMergedCategories(user?.customCategories);
                        const cat = allCats.find(c => c.id === e.category) || { icon: '📦', label: e.category, color:'#90a4ae' };
                        const isInc = e.type==='income'||e.category==='financial_aid';
                        return (
                          <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ fontSize: '24px', background: (cat.color || '#90a4ae')+'15', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {cat.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{cat.label}</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isInc ? 'var(--green)' : 'var(--color-primary-dark)' }}>
                                  {isInc ? '+ ' : '− '}{fmt(Math.abs(e.amount))}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span 
                                  style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(e.note || 'No description') }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button className="btn btn-xs btn-ghost" style={{ border: 'none' }} onClick={()=>{setEditing(e);setShowModal(true);}}><Pencil size={14} /></button>
                                  <button className="btn btn-xs btn-ghost" style={{ border: 'none', color: 'var(--red)', opacity: 0.85 }} onClick={()=>handleDelete(e._id)}><Trash2 size={14} /></button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>

      {showModal && (
        <ExpenseModal
          initial={editing || { date: new Date().toISOString().slice(0,10) }}
          onSave={handleSave}
          onClose={()=>{ setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}


