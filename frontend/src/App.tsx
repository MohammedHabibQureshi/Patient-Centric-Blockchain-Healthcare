import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useWallet } from './contexts/WalletContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { PatientsPage } from './pages/admin/PatientsPage';
import { DoctorsPage } from './pages/admin/DoctorsPage';
import { BlockchainPage } from './pages/admin/BlockchainPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SystemStatusPage } from './pages/admin/SystemStatusPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

function RoleRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'ADMIN': return <Navigate to="/dashboard" replace />;
    case 'PATIENT': return <Navigate to="/patient" replace />;
    case 'DOCTOR': return <Navigate to="/doctor" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { state: walletState } = useWallet();

  if (isLoading) {
    return <LoadingSpinner size="large" message="Loading..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!walletState.isConnected) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { checkAuth } = useAuth();
  const { state: walletState } = useWallet();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Check if wallet is on correct network
  useEffect(() => {
    if (walletState.isConnected && !walletState.isCorrectNetwork) {
      // Could show a notification here
      console.warn('Wallet is on wrong network');
    }
  }, [walletState.isConnected, walletState.isCorrectNetwork]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        <Route element={
          <ProtectedRoute allowedRoles={['ADMIN', 'PATIENT', 'DOCTOR']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<RoleRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="dashboard/patients" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <PatientsPage />
            </ProtectedRoute>
          } />
          <Route path="dashboard/doctors" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DoctorsPage />
            </ProtectedRoute>
          } />
          <Route path="dashboard/blockchain" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <BlockchainPage />
            </ProtectedRoute>
          } />
          <Route path="dashboard/audit" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AuditLogsPage />
            </ProtectedRoute>
          } />
          <Route path="dashboard/system" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SystemStatusPage />
            </ProtectedRoute>
          } />
          <Route path="patient" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientDashboard />
            </ProtectedRoute>
          } />
          <Route path="patient/*" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientDashboard />
            </ProtectedRoute>
          } />
          <Route path="doctor" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorDashboard />
            </ProtectedRoute>
          } />
          <Route path="doctor/*" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorDashboard />
            </ProtectedRoute>
          } />
        </Route>
        
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;