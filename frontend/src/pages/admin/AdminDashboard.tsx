import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, FileText, Shield, Activity, AlertCircle, CheckCircle, Boxes } from 'lucide-react';
import { apiService } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [blockchainHealth, setBlockchainHealth] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const healthInterval = setInterval(loadSystemHealth, 10000);
    return () => clearInterval(healthInterval);
  }, []);

  const loadSystemHealth = async () => {
    setHealthLoading(true);
    try {
      const data = await apiService.getPublicSystemHealth();
      if (data && data.services) {
        setBlockchainHealth(data);
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
      setBlockchainHealth((prev: any) => prev);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    setStatsLoading(true);

    apiService.getDashboardStats()
      .then((data) => {
        setStats(data?.stats || null);
      })
      .catch((error) => {
        console.error('Failed to load dashboard stats:', error);
        toast.error('Failed to load dashboard stats');
      })
      .finally(() => setStatsLoading(false));

    loadSystemHealth();

    apiService.getAuditLogs({ limit: 10 })
      .then((data) => {
        setRecentActivity(data?.databaseLogs?.logs || []);
      })
      .catch((e) => {
        console.error('Failed to load audit logs:', e);
      });

    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <span className="badge badge-success">Success</span>;
      case 'FAILED': return <span className="badge badge-error">Failed</span>;
      case 'PENDING': return <span className="badge badge-warning">Pending</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'USER_REGISTERED': return <UserPlus size={14} className="text-primary" />;
      case 'USER_DEACTIVATED': return <AlertCircle size={14} className="text-error" />;
      case 'USER_LOGIN': return <CheckCircle size={14} className="text-success" />;
      case 'RECORD_UPLOADED': return <FileText size={14} className="text-primary" />;
      case 'ACCESS_REQUESTED': return <Shield size={14} className="text-warning" />;
      case 'ACCESS_APPROVED': return <CheckCircle size={14} className="text-success" />;
      case 'ACCESS_DENIED': return <AlertCircle size={14} className="text-error" />;
      case 'ACCESS_REVOKED': return <Shield size={14} className="text-error" />;
      case 'RECORD_ACCESSED': return <FileText size={14} className="text-primary" />;
      default: return <Activity size={14} className="text-secondary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="page-content">
        <LoadingSpinner size="large" message="Loading dashboard..." />
      </div>
    );
  }

  const getStatusLabel = (loading: boolean, status: string | undefined) => {
    if (loading) return { text: 'Checking...', color: 'var(--color-text-muted)' };
    if (status === 'online') return { text: 'Online', color: 'var(--color-success)' };
    return { text: 'Offline', color: 'var(--color-error)' };
  };

  const dbStatus = getStatusLabel(healthLoading, blockchainHealth?.services?.database?.status);
  const bcStatus = getStatusLabel(healthLoading, blockchainHealth?.services?.blockchain?.status);
  const storageStatusInfo = getStatusLabel(healthLoading, blockchainHealth?.services?.storage?.status);
  const blockNumber = blockchainHealth?.services?.blockchain?.blockNumber;

  return (
    <div className="page-content">
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{statsLoading ? '...' : (stats?.totalUsers || 0)}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{statsLoading ? '...' : (stats?.totalPatients || 0)}</div>
            <div className="stat-label">Patients</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{statsLoading ? '...' : (stats?.totalDoctors || 0)}</div>
            <div className="stat-label">Doctors</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{statsLoading ? '...' : (stats?.totalRecords || 0)}</div>
            <div className="stat-label">Medical Records</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><Shield size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{statsLoading ? '...' : (stats?.pendingRequests || 0)}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><Boxes size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{healthLoading ? '...' : (blockNumber?.toLocaleString() || 'N/A')}</div>
            <div className="stat-label">Block Height</div>
          </div>
        </div>
      </div>

      {/* System Status & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* System Status Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">System Status</div>
          </div>
          <div className="card-content">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Database</div>
                <div style={{ fontWeight: 600, color: dbStatus.color }}>
                  {dbStatus.text}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Blockchain</div>
                <div style={{ fontWeight: 600, color: bcStatus.color }}>
                  {bcStatus.text}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Storage</div>
                <div style={{ fontWeight: 600, color: storageStatusInfo.color }}>
                  {storageStatusInfo.text}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Block Height</div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {healthLoading ? '...' : (blockNumber?.toLocaleString() || 'N/A')}
                </div>
              </div>
            </div>

            {blockchainHealth?.contracts && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Smart Contracts</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px' }}>
                  {Object.entries(blockchainHealth.contracts).map(([name, address]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <code style={{ flex: 1, fontSize: '11px', color: 'var(--color-text-muted)' }}>{address as string}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Quick Actions</div>
          </div>
          <div className="card-content">
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate('/dashboard/patients')}
              >
                <UserPlus size={18} />
                + Register Patient
              </button>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate('/dashboard/doctors')}
              >
                <UserPlus size={18} />
                + Register Doctor
              </button>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start' }}
                onClick={loadDashboardData}
              >
                <Activity size={18} />
                Refresh Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Activity</div>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                      No recent activity
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((log: any) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                      </td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getActionIcon(log.action)}
                        <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{log.actor_wallet?.slice(0, 10)}...{log.actor_wallet?.slice(-6)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{log.actor_role?.toLowerCase()}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {log.target_type} {log.target_identifier ? `: ${log.target_identifier}` : ''}
                      </td>
                      <td>{getStatusBadge(log.status)}</td>
                      <td>
                        {log.transaction_hash && log.transaction_hash !== '' ? (
                          <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {log.transaction_hash.slice(0, 12)}...
                          </code>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
