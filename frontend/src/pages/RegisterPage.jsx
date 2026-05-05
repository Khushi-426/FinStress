import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name:'',email:'',password:'',age:'',gender:'Male',yearInSchool:'Freshman',major:'Computer Science',paymentMethod:'Credit/Debit Card' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await register(f); navigate('/'); }
    catch(e){ setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="fade-up" style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily:'var(--serif)', fontSize:'2.5rem', color:'var(--color-primary)', marginBottom:'0.5rem' }}>FinStress</h1>
          <p style={{ fontSize: 16, color:'var(--color-text-secondary)' }}>Create your free account</p>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'2.5rem' }}>
          <div className="grid2">
            <div className="fg">
              <label>Full Name</label>
              <input value={f.name} onChange={set('name')} placeholder="Alex Johnson" required/>
            </div>
            <div className="fg">
              <label>Email Address</label>
              <input type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" required/>
            </div>
            <div className="fg">
              <label>Password</label>
              <input type="password" value={f.password} onChange={set('password')} placeholder="Min 6 chars" required/>
            </div>
            <div className="fg">
              <label>Age</label>
              <input type="number" value={f.age} onChange={set('age')} placeholder="18\u201325" min={13} max={35}/>
            </div>
            <div className="fg">
              <label>Gender</label>
              <select value={f.gender} onChange={set('gender')}>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
              </select>
            </div>
            <div className="fg">
              <label>Year in School</label>
              <select value={f.yearInSchool} onChange={set('yearInSchool')}>
                {['Freshman','Sophomore','Junior','Senior'].map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Major</label>
              <select value={f.major} onChange={set('major')}>
                {['Computer Science','Engineering','Biology','Economics','Psychology','Other'].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Payment Method</label>
              <select value={f.paymentMethod} onChange={set('paymentMethod')}>
                <option>Credit/Debit Card</option>
                <option>Cash</option>
                <option>Mobile Payment App</option>
              </select>
            </div>
          </div>

          {err && <div className="ferr">{err}</div>}
          
          <button className="btn btn-primary" style={{ justifyContent:'center', padding: '14px', fontSize: '16px' }} disabled={busy}>
            {busy ? 'Creating…' : 'Create account \u2192'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize: 14, marginTop:'2.5rem', color:'var(--color-text-secondary)' }}>
          Already registered? <Link to="/login" style={{ color:'var(--color-primary)', fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

