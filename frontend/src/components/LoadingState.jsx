import React from 'react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="spin-full" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spin" style={{ margin: '0 auto 2rem' }} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px', fontWeight: 500 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
