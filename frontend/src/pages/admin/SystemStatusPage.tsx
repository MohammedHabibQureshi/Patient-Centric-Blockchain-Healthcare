import React, { useState, useEffect } from 'react';
import { Database, Activity, HardDrive, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export function SystemStatusPage() {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadHealth(); }, []);

  const loadHealth = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/system/health');
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      toast.error('Failed to load system status');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'online') return <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />;
    return <AlertCircle size={20} style={{ color: 'var(--color-error)' }} />;
  };

  const getStatusColor = (status: string) => {
    return status === 'online' ? 'var(--color-success)' : 'var(--color-error)';
  };

  if (isLoading) return <LoadingSpinner size="large" message="Loading system status..." />;

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: `4px solid ${getStatusColor(health?.services?.database?.status)}` }}>
          <div className="stat-icon primary"><Database size={24} /></div>
          <div className="stat-content">
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: getStatusColor(health?.services?.database?.status) }}>
              {getStatusIcon(health?.services?.database?.status)} {health?.services?.database?.status === 'online' ? 'Online' : 'Offline'}
            </div>
            <div className="stat-label">PostgreSQL Database</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${getStatusColor(health?.services?.blockchain?.status)}` }}>
          <div className="stat-icon success"><Activity size={24} /></div>
          <div className="stat-content">
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: getStatusColor(health?.services?.blockchain?.status) }}>
              {getStatusIcon(health?.services?.blockchain?.status)} {health?.services?.blockchain?.status === 'online' ? 'Online' : 'Offline'}
            </div>
            <div className="stat-label">Blockchain Network</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${getStatusColor(health?.services?.storage?.status)}` }}>
          <div className="stat-icon warning"><HardDrive size={24} /></div>
          <div className="stat-content">
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: getStatusColor(health?.services?.storage?.status) }}>
              {getStatusIcon(health?.services?.storage?.status)} {health?.services?.storage?.status === 'online' ? 'Online' : 'Offline'}
            </div>
            <div className="stat-label">File Storage</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Detailed Status</div>
          <button className="btn btn-ghost btn-sm" onClick={loadHealth}><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Service</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500 }}>PostgreSQL Database</td>
                  <td>{getStatusIcon(health?.services?.database?.status)} <span style={{ color: getStatusColor(health?.services?.database?.status) }}>{health?.services?.database?.status}</span></td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Port 5432</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>Ganache Blockchain</td>
                  <td>{getStatusIcon(health?.services?.blockchain?.status)} <span style={{ color: getStatusColor(health?.services?.blockchain?.status) }}>{health?.services?.blockchain?.status}</span></td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Chain ID: {health?.services?.blockchain?.chainId} | Block: {health?.services?.blockchain?.blockNumber}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>File Storage</td>
                  <td>{getStatusIcon(health?.services?.storage?.status)} <span style={{ color: getStatusColor(health?.services?.storage?.status) }}>{health?.services?.storage?.status}</span></td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Files: {health?.services?.storage?.totalFiles ?? 0} | Size: {health?.services?.storage?.totalSizeBytes ? `${(health.services.storage.totalSizeBytes / 1024).toFixed(1)} KB` : '0 B'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
