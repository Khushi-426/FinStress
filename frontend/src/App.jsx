import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout       from './components/Layout';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TrackerPage  from './pages/TrackerPage';
import BudgetPage   from './pages/BudgetPage';
import AnalysisPage from './pages/AnalysisPage';
import './index.css';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="spin-full"><div className="spin"/></div>;
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index          element={<DashboardPage />} />
            <Route path="tracker" element={<TrackerPage />} />
            <Route path="budget"  element={<BudgetPage />} />
            <Route path="analyse" element={<AnalysisPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
