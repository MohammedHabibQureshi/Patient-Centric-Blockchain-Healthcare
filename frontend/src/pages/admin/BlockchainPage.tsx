import React, { useState, useEffect } from 'react';
import { Activity, Box, Database, FileText, Hash } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export function BlockchainPage() {
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadBlockchainInfo(); }, []);

  const loadBlockchainInfo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/system/health');
      const data = await res.json();
      setBlockchainInfo(data.services?.blockchain || {});
    } catch (error) {
      toast.error('Failed to load blockchain info');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner size="large" message="Loading blockchain info..." />;

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon success"><Activity size={24} /></div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: blockchainInfo.status === 'online' ? 'var(--color-success)' : 'var(--color-error)' }}>
              {blockchainInfo.status === 'online' ? 'Online' : 'Offline'}
            </div>
            <div className="stat-label">Network Status</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><Box size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{blockchainInfo.blockNumber || '—'}</div>
            <div className="stat-label">Latest Block</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><Hash size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{blockchainInfo.chainId || '—'}</div>
            <div className="stat-label">Chain ID</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Smart Contracts</div>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {blockchainInfo.contracts ? Object.entries(blockchainInfo.contracts).map(([name, address]) => (
                  <tr key={name}>
                    <td style={{ fontWeight: 500 }}>{name}</td>
                    <td><code style={{ fontSize: '11px' }}>{String(address)}</code></td>
                  </tr>
                )) : (
                  <tr>
                    <td style={{ fontWeight: 500 }}>UserRegistry</td>
                    <td><code style={{ fontSize: '11px' }}>0x6B35e80ac589b358f1b3aF17F16b707Ff8ad3613</code></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
