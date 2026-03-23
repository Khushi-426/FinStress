import React from 'react';
import { monthLabel } from '../utils/categories';

export default function MonthNav({ month, onChange }) {
  const shift = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };
  const isCurrentMonth = month === new Date().toISOString().slice(0,7);
  return (
    <div className="month-nav">
      <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)}>‹</button>
      <span className="month-label">{monthLabel(month)}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} disabled={isCurrentMonth}>›</button>
      {!isCurrentMonth && (
        <button className="btn btn-ghost btn-sm"
          onClick={() => onChange(new Date().toISOString().slice(0,7))}>
          Today
        </button>
      )}
    </div>
  );
}
