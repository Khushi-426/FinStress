import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [f, setF] = useState({ email:'', password:'' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.email, f.password); navigate('/'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="fade-up" style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily:'var(--serif)', fontSize:'2.5rem', color:'var(--color-primary)', marginBottom:'0.5rem' }}>FinStress</h1>
          <p style={{ fontSize: 16, color:'var(--color-text-secondary)' }}>Track expenses. Understand your stress.</p>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'2.5rem' }}>
          <div className="fg">
            <label>Email Address</label>
            <input type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} placeholder="you@example.com" required/>
          </div>
          <div className="fg">
            <label>Password</label>
            <input type="password" value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))} placeholder="••••••••" required/>
          </div>
          
          {err && <div className="ferr">{err}</div>}
          
          <button className="btn btn-primary" style={{ justifyContent:'center', padding: '14px', fontSize: '16px' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in \u2192'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize: 14, marginTop:'2.5rem', color:'var(--color-text-secondary)' }}>
          No account? <Link to="/register" style={{ color:'var(--color-primary)', fontWeight:600 }}>Register free</Link>
        </p>
      </div>
    </div>
  );
}

