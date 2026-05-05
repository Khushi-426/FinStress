import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout       from './components/Layout';

const LoginPage    = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TrackerPage  = lazy(() => import('./pages/TrackerPage'));
const BudgetPage   = lazy(() => import('./pages/BudgetPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const JourneyPage = lazy(() => import('./pages/JourneyPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
import './index.css';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="spin-full"><div className="spin"/></div>;
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE"}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="spin-full"><div className="spin"/></div>}>
            <Routes>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<Protected><Layout /></Protected>}>
                <Route index          element={<DashboardPage />} />
                <Route path="tracker" element={<TrackerPage />} />
                <Route path="budget"  element={<BudgetPage />} />
                <Route path="analyse" element={<AnalysisPage />} />
                <Route path="journey" element={<JourneyPage />} />
                <Route path="savings" element={<SavingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
