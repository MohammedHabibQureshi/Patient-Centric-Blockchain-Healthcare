import React, { useState, useEffect, useCallback } from 'react';
import { Stethoscope, UserPlus, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiService } from '../../services/api';
import { RegisterUserModal } from '../../components/RegisterUserModal';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface UserRow {
  id: string;
  name: string;
  wallet_address: string;
  role: string;
  email: string;
  identifier: string;
  status: string;
}

export function DoctorsPage() {
  const [doctors, setDoctors] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [removingAddress, setRemovingAddress] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await apiService.getUsersByRole('DOCTOR');
      setDoctors(data?.users || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleRemove = async (d: UserRow) => {
    if (!window.confirm(`Remove doctor "${d.name}"?\n\nThey will be deactivated, lose all patient access grants, and can no longer log in. Historical records are preserved.`)) {
      return;
    }
    setRemovingAddress(d.wallet_address);
    try {
      await apiService.deactivateUser(d.wallet_address);
      toast.success('Doctor removed successfully');
      await loadDoctors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove doctor');
    } finally {
      setRemovingAddress(null);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>Doctors</h2>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {doctors.length} registered {doctors.length === 1 ? 'doctor' : 'doctors'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
          <UserPlus size={18} />
          + Register Doctor
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Registered Doctors</div>
        </div>
        <div className="card-content">
          {isLoading ? (
            <LoadingSpinner size="large" message="Loading doctors..." />
          ) : doctors.length === 0 ? (
            <div className="empty-state">
              <Stethoscope className="empty-state-icon" size={64} />
              <div className="empty-state-title">No doctors registered yet.</div>
              <div className="empty-state-description">
                Doctors are registered by the Administrator. Please provide the doctor's public MetaMask wallet address.
              </div>
              <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setShowRegister(true)}>
                <UserPlus size={18} />
                Register First Doctor
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Wallet Address</th>
                    <th>License No.</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 500 }}>{d.name}</td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {d.wallet_address.slice(0, 10)}...{d.wallet_address.slice(-8)}
                        </code>
                      </td>
                      <td style={{ fontSize: '13px' }}>{d.identifier || '—'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{d.email}</td>
                      <td>
                        <span className={`badge ${d.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        {d.status === 'ACTIVE' ? (
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleRemove(d)}
                            disabled={removingAddress === d.wallet_address}
                          >
                            <UserX size={14} />
                            {removingAddress === d.wallet_address ? 'Removing...' : 'Remove'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Removed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showRegister && (
        <RegisterUserModal
          type="doctor"
          onClose={() => setShowRegister(false)}
          onSuccess={loadDoctors}
        />
      )}
    </div>
  );
}
