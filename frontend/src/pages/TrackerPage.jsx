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
  const [saving,   setSaving]   = useState(false);

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
    setSaving(true);
    try {
      if (editing?._id) {
        const { data } = await api.patch(`/expenses/${editing._id}`, form);
        setItems(prev => prev.map(e => e._id===editing._id ? data : e));
      } else {
        const { data } = await api.post('/expenses', form);
        setItems(prev => [data, ...prev]);
      }
      // refresh summary
      const sR = await api.get(`/expenses/summary?month=${month}`);
      setSummary(sR.data);
    } catch(e) { alert(e.message); }
    setSaving(false);
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

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:'1rem'}}>
        <div>
          <h1 style={{fontFamily:'var(--serif)',fontSize:'1.9rem',lineHeight:1.2,marginBottom:'.2rem'}}>
            Daily <span style={{color:'var(--accent)',fontStyle:'italic'}}>Tracker</span>
          </h1>
          <p style={{color:'var(--text2)',fontSize:14}}>Log every expense — your analysis is built from this data.</p>
        </div>
        <button className="btn btn-primary" onClick={()=>{setEditing(null);setShowModal(true);}}>
          <Plus size={14} strokeWidth={2.2} /> Add entry
        </button>
      </div>

      <MonthNav month={month} onChange={setMonth}/>

      {/* Month totals */}
      <div className="mg" style={{marginBottom:'1.25rem'}}>
        <div className="mc good"><div className="ml">Income & aid</div><div className="mv">{fmt(totalIn)}</div><div className="ms">this month</div></div>
        <div className="mc"><div className="ml">Expenses</div><div className="mv">{fmt(totalOut)}</div><div className="ms">{items.filter(e=>e.type==='expense').length} entries</div></div>
        <div className={`mc ${gap<0?'danger':'good'}`}><div className="ml">Net</div><div className="mv">{gap>=0?'+':''}{fmt(gap)}</div><div className="ms">{gap<0?'deficit':'surplus'}</div></div>
      </div>

      {/* Category filter pills */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {[
          {id:'all',      label:'All',       Icon: List        },
          {id:'income',   label:'Income',    Icon: DollarSign  },
          {id:'recurring',label:'Recurring', Icon: Repeat      },
          ...CATEGORIES.map(c => ({...c, Icon: null})),
        ].map(c=>(
          <button key={c.id} className={`btn btn-sm ${filter===c.id?'btn-primary':'btn-ghost'}`}
            onClick={()=>setFilter(c.id)}>
            {c.Icon
              ? <c.Icon size={13} strokeWidth={1.9} style={{marginRight:4}} />
              : null
            }
            {c.label}
          </button>
        ))}
      </div>

      {/* Recurring quick-add */}
      {(() => {
        const recurrings = items.filter(e=>e.isRecurring);
        if (!recurrings.length) return null;
        return (
          <div className="card card-sm" style={{marginBottom:'1.25rem'}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Repeat size={12} strokeWidth={2}/> Recurring this month</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {recurrings.map(e=>{
                const cat = CAT_MAP[e.category];
                return (
                  <div key={e._id} style={{display:'flex',alignItems:'center',gap:6,background:'var(--surface2)',borderRadius:8,padding:'5px 10px',fontSize:13}}>
                    <span>{cat?.icon}</span>
                    <span style={{color:'var(--text2)'}}>{e.note||cat?.label}</span>
                    <span style={{fontWeight:600,color:'var(--accent)'}}>{fmt(e.amount)}</span>
                    <button className="btn-xs btn btn-ghost" onClick={()=>{setEditing(e);setShowModal(true);}} title="Edit"><Pencil size={11} strokeWidth={2}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Expense list grouped by day */}
      {loading ? <div className="spin-full"><div className="spin"/></div> : (
        groups.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:'2.5rem'}}>
            <Inbox size={42} strokeWidth={1.2} style={{margin:'0 auto .75rem',display:'block',color:'var(--text3)'}}/>
            <p style={{color:'var(--text2)',fontSize:14,marginBottom:'1rem'}}>
              {filter==='all' ? 'No entries yet this month.' : `No ${filter} entries.`}
            </p>
            <button className="btn btn-primary" onClick={()=>{setEditing(null);setShowModal(true);}}>Add first entry</button>
          </div>
        ) : groups.map(([date, exps]) => {
          const dayTotal = exps.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
          const dayIncome = exps.filter(e=>e.type==='income'||e.category==='financial_aid').reduce((s,e)=>s+e.amount,0);
          return (
            <div key={date} style={{marginBottom:'1.25rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 2px',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:500,color:'var(--text2)'}}>{fmtDay(date)}</span>
                <div style={{display:'flex',gap:12,fontSize:12}}>
                  {dayIncome>0 && <span style={{color:'var(--green)'}}>+{fmt(dayIncome)}</span>}
                  {dayTotal>0  && <span style={{color:'var(--red)'}}>-{fmt(dayTotal)}</span>}
                </div>
              </div>
              {exps.map(e => {
                const cat = CAT_MAP[e.category] || { icon: null, label: e.category, color:'#888' };
                const isInc = e.type==='income'||e.category==='financial_aid';
                return (
                  <div key={e._id} className="exp-row">
                    <div className="exp-cat-dot" style={{background:cat.color+'20'}}>
                      <span style={{fontSize:18}}>{cat.icon}</span>
                    </div>
                    <div className="exp-info">
                      <div className="exp-name">
                        {cat.label}
                        {e.isRecurring && <span style={{marginLeft:6,fontSize:10,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 5px',color:'var(--text3)',display:'inline-flex',alignItems:'center',gap:2}}><Repeat size={9} strokeWidth={2}/>recurring</span>}
                      </div>
                      <div className="exp-sub">{e.note || '\u00A0'}</div>
                    </div>
                    <div className="exp-amount" style={{color:isInc?'var(--green)':'var(--text)'}}>
                      {isInc?'+':'-'}{fmt(e.amount)}
                    </div>
                    <div style={{display:'flex',gap:4,marginLeft:8}}>
                      <button className="btn btn-xs btn-ghost" onClick={()=>{setEditing(e);setShowModal(true);}} title="Edit"><Pencil size={11} strokeWidth={2}/></button>
                      <button className="btn btn-xs btn-danger" onClick={()=>handleDelete(e._id)} title="Delete"><Trash2 size={11} strokeWidth={2}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Modal */}
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
