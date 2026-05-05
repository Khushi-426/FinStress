import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Target, Plus, Trash2, TrendingUp, Calendar, X } from 'lucide-react';
import api from '../utils/api';
import LoadingState from '../components/LoadingState';
import { fmt } from '../utils/categories';

export default function SavingsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', deadline: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/savings');
      setGoals(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/savings', newGoal);
      load();
      setShowModal(false);
      setNewGoal({ name: '', targetAmount: '', deadline: '' });
    } catch (err) { alert(err.message); }
  };

  const handleUpdate = async (id, currentAmount) => {
    try {
      await api.patch(`/savings/${id}`, { currentAmount });
      load();
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/savings/${id}`);
      load();
    } catch {}
  };

  return (
    <div className="fade-up page">
      <header className="story-header">
        <div>
          <h1 className="story-title">Savings Goals.</h1>
          <p className="story-subtitle">Track your progress toward what matters most.</p>
        </div>
        <button className="btn btn-gradient" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Goal
        </button>
      </header>

      {loading ? <LoadingState message="Loading your goals..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          {goals.map(g => {
            const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
            return (
              <div key={g._id} className="modal-box" style={{ padding: '2rem', maxWidth: '100%', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div style={{ background: g.color + '20', color: g.color, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={24} />
                  </div>
                  <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)', border: 'none', padding: '4px', opacity: 0.85 }} onClick={() => handleDelete(g._id)}><Trash2 size={14} /></button>
                </div>
                
                <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--serif)', fontSize: '1.4rem' }}>{g.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Target: <strong>{fmt(g.targetAmount)}</strong></span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{pct}%</span>
                </div>

                <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', marginBottom: '1.5rem', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: g.color, transition: 'width 0.8s ease' }} />
                </div>

                <div className="fg">
                  <label>Update Progress</label>
                  <div className="soft-input-wrap">
                    <span className="soft-input-prefix">₹</span>
                    <input 
                      type="number" 
                      value={g.currentAmount} 
                      onChange={(e) => handleUpdate(g._id, e.target.value)}
                      style={{ fontSize: '14px', padding: '8px 4px 8px 24px' }}
                    />
                  </div>
                </div>
                
                {g.deadline && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <Calendar size={12} />
                    Due by {new Date(g.deadline).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && ReactDOM.createPortal(
        <div className="modal-back" onClick={() => setShowModal(false)}>
          <div className="modal-box glow-in" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', zIndex: 10 }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', marginBottom: '2.5rem', textAlign: 'center' }}>Set a Goal</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="fg">
                <label>Goal Name</label>
                <div className="soft-input-wrap">
                  <input 
                    type="text" 
                    required 
                    value={newGoal.name} 
                    onChange={e => setNewGoal({...newGoal, name: e.target.value})} 
                    placeholder="e.g. New Laptop, Travel, Internship Savings" 
                  />
                </div>
              </div>

              <div className="fg">
                <label>Target Amount</label>
                <div className="soft-input-wrap">
                  <span className="soft-input-prefix">₹</span>
                  <input 
                    type="number" 
                    required 
                    value={newGoal.targetAmount} 
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setNewGoal({...newGoal, targetAmount: v >= 0 ? v : 0});
                    }} 
                    placeholder="0.00" 
                    min="0"
                  />
                </div>
              </div>

              <div className="fg">
                <label>Deadline (Optional)</label>
                <div className="soft-input-wrap">
                  <input 
                    type="date" 
                    className="hide-date-icon"
                    value={newGoal.deadline} 
                    onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} 
                  />
                  <Calendar className="soft-input-icon" size={18} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '14px' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gradient" style={{ flex: 1, padding: '14px' }}>Create Goal</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
