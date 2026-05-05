import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      background: 'var(--surface2)',
      borderRadius: '32px',
      border: '1px solid var(--color-border)',
      maxWidth: '600px',
      margin: '4rem auto'
    }}>
      <AlertTriangle size={64} strokeWidth={1.5} style={{ color: 'var(--red)', marginBottom: '2rem' }} />
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
        {error || 'An unexpected error occurred while fetching your data. Please check your connection and try again.'}
      </p>
      {onRetry && (
        <button className="btn btn-gradient" style={{ padding: '12px 40px' }} onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
