import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const Ctx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('fs_token');
    if (t) {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      api.get('/auth/me').then(r => setUser(r.data.user)).catch(logout).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const _save = (token, user) => {
    localStorage.setItem('fs_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
  };

  const login    = async (e, p) => { const { data } = await api.post('/auth/login',    { email:e, password:p }); _save(data.token, data.user); };
  const register = async (f)    => { const { data } = await api.post('/auth/register', f); _save(data.token, data.user); };
  const logout   = ()           => { localStorage.removeItem('fs_token'); delete api.defaults.headers.common['Authorization']; setUser(null); };
  const refresh  = async ()     => { const { data } = await api.get('/auth/me'); setUser(data.user); };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
