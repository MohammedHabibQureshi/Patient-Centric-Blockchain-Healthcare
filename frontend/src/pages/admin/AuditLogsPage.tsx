import React, { useState, useEffect } from 'react';
import { Shield, Search, Download } from 'lucide-react';
import { apiService } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAuditLogs({ page: 1, limit: 200 });
      setLogs(data.logs || data.databaseLogs?.logs || []);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.target_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.actor_wallet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.target_identifier?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    if (action?.includes('CREATE')) return <span className="badge badge-success">{action}</span>;
    if (action?.includes('READ') || action?.includes('ACCESS')) return <span className="badge badge-primary">{action}</span>;
    if (action?.includes('DELETE') || action?.includes('DENY') || action?.includes('REVOKE')) return <span className="badge badge-error">{action}</span>;
    if (action?.includes('UPDATE')) return <span className="badge badge-warning">{action}</span>;
    return <span className="badge">{action}</span>;
  };

  if (isLoading) return <LoadingSpinner size="large" message="Loading audit logs..." />;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Audit Logs ({logs.length})</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
              <input type="text" className="form-input" placeholder="Search logs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '250px' }} />
            </div>
          </div>
        </div>
        <div className="card-content">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Shield className="empty-state-icon" size={64} />
              <div className="empty-state-title">No audit logs</div>
              <div className="empty-state-description">Audit events will appear here as they occur</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Actor</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log: any) => (
                    <tr key={log.id}>
                      <td>{getActionBadge(log.action)}</td>
                      <td style={{ fontWeight: 500 }}>{log.target_type || '—'} {log.target_identifier ? `: ${log.target_identifier}` : ''}</td>
                      <td><code style={{ fontSize: '11px' }}>{log.actor_wallet?.slice(0, 10)}...{log.actor_wallet?.slice(-6)}</code></td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof log.metadata === 'object' ? JSON.stringify(log.metadata) : (log.metadata || log.transaction_hash || '—')}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm:ss') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
