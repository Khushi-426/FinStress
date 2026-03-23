import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/',        icon: '📊', label: 'Dashboard'   },
  { to: '/tracker', icon: '📝', label: 'Daily Tracker'},
  { to: '/budget',  icon: '🎯', label: 'Budget'       },
  { to: '/analyse', icon: '🔬', label: 'Analysis'     },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sb-brand"><span>📊</span> FinStress</div>
        <nav className="sb-nav">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{padding:'0 .75rem .75rem'}}>
          <button className="nav-item" style={{width:'100%',color:'var(--red)'}}
            onClick={()=>{ logout(); navigate('/login'); }}>
            <span className="nav-icon">🚪</span> Sign out
          </button>
        </div>
        <div className="sb-user">
          <div className="avatar">{initials}</div>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{user?.name}</div>
            <div style={{fontSize:11,color:'var(--text3)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="page fade-up"><Outlet /></div>
      </main>
    </div>
  );
}
