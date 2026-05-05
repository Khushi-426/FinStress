import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
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

  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === form.category);
    if (cat) setForm(f => ({ ...f, type: cat.type }));
  }, [form.category]);

  const submit = () => {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return setErr('Enter a valid amount');
    setErr('');
    onSave({ ...form, amount: +form.amount });
  };

  const currentCat = CAT_MAP[form.category];

  return (
    <div className="modal-back" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box glow-in" style={{ position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <header style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', lineHeight: 1.1, marginBottom: '0.5rem' }}>
            {initial?._id ? 'Edit' : 'New'} Entry
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
            {initial?._id ? 'Modify your entry details' : 'Add your expense details'}
          </p>
        </header>

        <div style={{display:'flex',flexDirection:'column',gap:'2.5rem'}}>
          <div className="fg">
            <label>Select Category</label>
            <div className="cat-tile-grid">
              {CATEGORIES.map(c => (
                <div 
                  key={c.id} 
                  className={`cat-tile ${form.category === c.id ? 'active' : ''}`}
                  onClick={() => setForm(f=>({...f,category:c.id,type:c.type}))}
                >
                  <div className="cat-tile-icon">{c.icon}</div>
                  <span className="cat-tile-label">{c.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid2">
            <div className="fg">
              <label>Amount</label>
              <div className="soft-input-wrap">
                <span className="soft-input-prefix">₹</span>
                <input 
                  type="number" 
                  value={form.amount} 
                  onChange={set('amount')} 
                  placeholder="0" 
                  min="0" 
                  autoFocus 
                />
              </div>
            </div>
            <div className="fg">
              <label>Date</label>
              <div className="soft-input-wrap">
                <input 
                  type="date" 
                  className="hide-date-icon"
                  value={form.date} 
                  onChange={set('date')} 
                  max={today()} 
                />
                <Calendar size={16} className="soft-input-icon" />
              </div>
            </div>
          </div>

          <div className="fg">
            <label>Note (optional)</label>
            <input 
              type="text" 
              value={form.note} 
              onChange={set('note')} 
              placeholder="What was this for?" 
              maxLength={200} 
            />
          </div>

          <div className="fg">
            <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
              <input 
                type="checkbox" 
                checked={form.isRecurring} 
                onChange={e=>setForm(f=>({...f,isRecurring:e.target.checked}))} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Recurring Entry</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>This entry will repeat every month automatically.</span>
              </div>
            </label>
          </div>

          {err && <div className="ferr">{err}</div>}

          <div style={{display:'flex', gap:'1.5rem', justifyContent:'flex-end', marginTop: '1rem'}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-gradient" style={{ padding: '14px 40px' }} onClick={submit}>
              {initial?._id ? 'Save Changes' : `Add ${currentCat?.label||'Entry'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


