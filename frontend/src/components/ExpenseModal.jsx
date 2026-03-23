import React, { useState, useEffect } from 'react';
import { CATEGORIES, CAT_MAP } from '../utils/categories';

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpenseModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    date: today(), category: 'food', amount: '',
    note: '', isRecurring: false, type: 'expense',
    ...initial,
  });
  const [err, setErr] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // sync type when category changes
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === form.category);
    if (cat) setForm(f => ({ ...f, type: cat.type }));
  }, [form.category]);

  const submit = () => {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return setErr('Enter a valid amount');
    setErr('');
    onSave({ ...form, amount: +form.amount });
  };

  const cat = CAT_MAP[form.category];

  return (
    <div className="modal-back" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box fade-up">
        <div className="modal-title">{initial?._id ? '✏️ Edit entry' : '➕ Add entry'}</div>

        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {/* Category grid */}
          <div className="fg">
            <label>Category</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
              {CATEGORIES.map(c => (
                <button key={c.id} type="button"
                  onClick={() => setForm(f=>({...f,category:c.id,type:c.type}))}
                  style={{
                    padding:'8px 4px',border:`2px solid ${form.category===c.id?c.color:'var(--border)'}`,
                    borderRadius:10,background:form.category===c.id?c.color+'18':'var(--surface2)',
                    cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                    transition:'all .15s',fontSize:11,color:form.category===c.id?c.color:'var(--text2)',fontWeight:form.category===c.id?600:400
                  }}>
                  <span style={{fontSize:18}}>{c.icon}</span>
                  <span style={{lineHeight:1.2,textAlign:'center'}}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid2">
            <div className="fg">
              <label>Amount ($)</label>
              <div className="ipre">
                <span className="sym">$</span>
                <input type="number" value={form.amount} onChange={set('amount')} placeholder="0.00" min="0" step="0.01" autoFocus />
              </div>
            </div>
            <div className="fg">
              <label>Date</label>
              <input type="date" value={form.date} onChange={set('date')} max={today()} />
            </div>
          </div>

          <div className="fg">
            <label>Note (optional)</label>
            <input type="text" value={form.note} onChange={set('note')} placeholder="e.g. Grocery run, Netflix sub..." maxLength={200} />
          </div>

          {/* Receipt upload placeholder */}
          <div className="fg">
            <label>Receipt photo (optional)</label>
            <div style={{border:'2px dashed var(--border2)',borderRadius:10,padding:'1rem',textAlign:'center',color:'var(--text3)',fontSize:13,cursor:'pointer',background:'var(--surface2)'}}
              onClick={() => document.getElementById('receipt-input').click()}>
              📷 Tap to attach a receipt image
              <input id="receipt-input" type="file" accept="image/*" capture="environment" style={{display:'none'}}
                onChange={e => { if(e.target.files[0]) setForm(f=>({...f,receiptFile:e.target.files[0],receiptName:e.target.files[0].name})); }} />
            </div>
            {form.receiptName && <div style={{fontSize:12,color:'var(--green)',marginTop:4}}>✅ {form.receiptName}</div>}
          </div>

          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14}}>
            <input type="checkbox" checked={form.isRecurring} onChange={e=>setForm(f=>({...f,isRecurring:e.target.checked}))} />
            <span>🔁 Mark as recurring (e.g. rent, subscriptions)</span>
          </label>

          {err && <div className="ferr">{err}</div>}

          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>
              {initial?._id ? 'Save changes' : `Add ${cat?.label||'entry'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
