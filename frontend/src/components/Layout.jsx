import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gsap } from 'gsap';
import {
  LayoutDashboard,
  ClipboardList,
  Target,
  FlaskConical,
  LogOut,
} from 'lucide-react';

const NAV = [
  { to: '/',        Icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/tracker', Icon: ClipboardList,   label: 'Daily Tracker' },
  { to: '/budget',  Icon: Target,          label: 'Budget'        },
  { to: '/analyse', Icon: FlaskConical,    label: 'Analysis'      },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials =
    user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const sidebarRef = useRef(null);
  const navItemsRef = useRef([]);

  /* ── GSAP entrance: sidebar slides in from left + nav items stagger ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Sidebar panel
      gsap.fromTo(sidebarRef.current,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }
      );
      // Nav items stagger
      gsap.fromTo(navItemsRef.current,
        { x: -16, opacity: 0 },
        {
          x: 0, opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.07,
          delay: 0.2,
        }
      );
    }, sidebarRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="layout">

      {/* ═══════════════════════════════════
          FLOATING GLASS SIDEBAR
          ═══════════════════════════════════ */}
      <aside className="sidebar" ref={sidebarRef}>

        {/* Brand */}
        <div className="sb-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
          FinStress
        </div>

        {/* Nav links */}
        <nav className="sb-nav">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              ref={el => { navItemsRef.current[i] = el; }}
            >
              <span className="nav-dot" aria-hidden="true" />
              <span className="nav-icon">
                <n.Icon size={16} strokeWidth={1.8} />
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign-out */}
        <div style={{ padding: '0 .75rem .6rem' }}>
          <button
            className="nav-item nav-item--danger"
            style={{ width: '100%' }}
            ref={el => { navItemsRef.current[NAV.length] = el; }}
            onClick={() => { logout(); navigate('/login'); }}
          >
            <span className="nav-dot" aria-hidden="true" />
            <span className="nav-icon"><LogOut size={16} strokeWidth={1.8} /></span>
            Sign out
          </button>
        </div>

        {/* User chip */}
        <div className="sb-user">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <main className="main">
        <div className="page fade-up">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
