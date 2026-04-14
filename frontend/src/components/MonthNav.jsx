import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { monthLabel } from '../utils/categories';

export default function MonthNav({ month, onChange }) {
  const shift = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };
  const isCurrentMonth = month === new Date().toISOString().slice(0,7);

  return (
    <div className="month-nav" style={{ justifyContent: 'center', background: 'var(--surface-glass2)', padding: '6px', borderRadius: '100px', display: 'inline-flex', alignSelf: 'center', margin: '0 auto 1.5rem', border: '1px solid var(--border-glass)' }}>
      <button className="btn btn-ghost btn-sm" style={{ padding: '6px', minWidth: '32px', borderRadius: '50%' }} onClick={() => shift(-1)}>
        <ChevronLeft size={16} strokeWidth={2.5} />
      </button>
      
      <div style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: 8, minWidth: '150px', justifyContent: 'center' }}>
        <Calendar size={14} color="var(--accent)" strokeWidth={2} />
        <span className="month-label" style={{ minWidth: 'auto', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
          {monthLabel(month)}
        </span>
      </div>

      <button className={`btn btn-ghost btn-sm`} style={{ padding: '6px', minWidth: '32px', borderRadius: '50%' }} onClick={() => shift(1)} disabled={isCurrentMonth}>
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>

      {!isCurrentMonth && (
        <button className="btn btn-primary btn-xs" 
          style={{ marginLeft: 6, padding: '4px 12px' }}
          onClick={() => onChange(new Date().toISOString().slice(0,7))}>
          Today
        </button>
      )}
    </div>
  );
}
