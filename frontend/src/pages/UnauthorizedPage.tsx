import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Home, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function UnauthorizedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="wallet-connect">
      <Shield className="wallet-connect-icon" style={{ color: 'var(--color-error)' }} size={80} />
      <h1 className="wallet-connect-title">Access Denied</h1>
      <p className="wallet-connect-description">
        You don't have permission to access this page. Your current role is <strong>{user?.role || 'Unknown'}</strong>.
      </p>
      
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <Link to="/dashboard" className="btn btn-primary">
          <Home size={18} />
          Go to Dashboard
        </Link>
        <button className="btn btn-secondary" onClick={logout}>
          <ArrowLeft size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}