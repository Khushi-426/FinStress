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
      <div className="auth-box fade-up">
        <div style={{fontFamily:'var(--serif)',fontSize:'1.6rem',color:'var(--accent)',marginBottom:4}}>📊 FinStress</div>
        <div style={{fontSize:14,color:'var(--text2)',marginBottom:'1.75rem'}}>Track expenses. Understand your stress.</div>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} placeholder="you@uni.edu" required/></div>
          <div className="fg"><label>Password</label><input type="password" value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))} placeholder="••••••••" required/></div>
          {err && <div className="ferr">{err}</div>}
          <button className="btn btn-primary" style={{justifyContent:'center',marginTop:4}} disabled={busy}>{busy?'Signing in…':'Sign in →'}</button>
        </form>
        <p style={{textAlign:'center',fontSize:13,marginTop:'1.25rem',color:'var(--text2)'}}>
          No account? <Link to="/register" style={{color:'var(--accent)',fontWeight:500}}>Register free</Link>
        </p>
      </div>
    </div>
  );
}
