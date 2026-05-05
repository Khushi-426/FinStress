import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Pencil, Trash2, Repeat, Inbox, Plus, List, DollarSign } from 'lucide-react';
import api from '../utils/api';
import MonthNav    from '../components/MonthNav';
import ExpenseModal from '../components/ExpenseModal';
import { CATEGORIES, CAT_MAP, fmt, currentMonth } from '../utils/categories';

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
  const loc = useLocation();
  const [month,    setMonth]    = useState(loc.state?.month || currentMonth());
  const [items,    setItems]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [editing,  setEditing]  = useState(null);
  const [filter,   setFilter]   = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eR, sR] = await Promise.all([
        api.get(`/expenses?month=${month}&limit=500`),
        api.get(`/expenses/summary?month=${month}`),
      ]);
      setItems(eR.data);
      setSummary(sR.data);
    } catch {}
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    try {
      if (editing?._id) {
        const { data } = await api.patch(`/expenses/${editing._id}`, form);
        setItems(prev => prev.map(e => e._id===editing._id ? data : e));
      } else {
        const { data } = await api.post('/expenses', form);
        setItems(prev => [data, ...prev]);
      }
      const sR = await api.get(`/expenses/summary?month=${month}`);
      setSummary(sR.data);
    } catch(e) { alert(e.message); }
    setShowModal(false);
    setEditing(null);
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
  const totalIn  = summary?.totalIncome   || 0;
  const totalOut = summary?.totalExpenses || 0;
  const gap      = summary?.savingsGap ?? totalIn - totalOut;

  const mainInsight = gap < 0 
    ? `You are running a deficit of ${fmt(Math.abs(gap))}` 
    : `You have saved ${fmt(gap)} this month`;

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Your Spending.</h1>
          <p className="story-subtitle">The timeline of your financial activities.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <MonthNav month={month} onChange={setMonth}/>
          <button className="btn btn-gradient" style={{ padding: '12px 24px' }} onClick={()=>{setEditing(null);setShowModal(true);}}>
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

      <div className="story-narrative" style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <p>
          You've recorded <strong className="text-green">{fmt(totalIn)}</strong> in income and <strong className="text-blue">{fmt(totalOut)}</strong> in expenses. 
          {gap < 0 ? " You might want to review your non-essential spending." : " Great job on maintaining a positive cash flow."}
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

        {loading ? <div className="spin-full"><div className="spin"/></div> : (
          groups.length === 0 ? (
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
                        const cat = CAT_MAP[e.category] || { icon: null, label: e.category, color:'#888' };
                        const isInc = e.type==='income'||e.category==='financial_aid';
                        return (
                          <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ fontSize: '24px', background: cat.color+'15', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {cat.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{cat.label}</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isInc ? 'var(--green)' : 'var(--color-primary-dark)' }}>
                                  {isInc ? '+' : '−'}{fmt(e.amount)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{e.note || 'No description'}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button className="btn btn-xs btn-ghost" style={{ border: 'none' }} onClick={()=>{setEditing(e);setShowModal(true);}}><Pencil size={14} /></button>
                                  <button className="btn btn-xs btn-ghost" style={{ border: 'none', color: 'var(--red)' }} onClick={()=>handleDelete(e._id)}><Trash2 size={14} /></button>
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


