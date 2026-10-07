import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, UserX } from 'lucide-react';
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

export function PatientsPage() {
  const [patients, setPatients] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [removingAddress, setRemovingAddress] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    try {
      const data = await apiService.getUsersByRole('PATIENT');
      setPatients(data?.users || []);
    } catch (error) {
      console.error('Failed to load patients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleRemove = async (p: UserRow) => {
    if (!window.confirm(`Remove patient "${p.name}"?\n\nThey will be deactivated and can no longer log in or access records. Historical records are preserved.`)) {
      return;
    }
    setRemovingAddress(p.wallet_address);
    try {
      await apiService.deactivateUser(p.wallet_address);
      toast.success('Patient removed successfully');
      await loadPatients();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove patient');
    } finally {
      setRemovingAddress(null);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>Patients</h2>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {patients.length} registered {patients.length === 1 ? 'patient' : 'patients'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
          <UserPlus size={18} />
          + Register Patient
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Registered Patients</div>
        </div>
        <div className="card-content">
          {isLoading ? (
            <LoadingSpinner size="large" message="Loading patients..." />
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <Users className="empty-state-icon" size={64} />
              <div className="empty-state-title">No patients registered yet.</div>
              <div className="empty-state-description">
                Patients are registered by the Administrator. Please provide the patient's public MetaMask wallet address.
              </div>
              <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setShowRegister(true)}>
                <UserPlus size={18} />
                Register First Patient
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Wallet Address</th>
                    <th>Patient ID</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {p.wallet_address.slice(0, 10)}...{p.wallet_address.slice(-8)}
                        </code>
                      </td>
                      <td style={{ fontSize: '13px' }}>{p.identifier || '—'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{p.email}</td>
                      <td>
                        <span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.status === 'ACTIVE' ? (
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleRemove(p)}
                            disabled={removingAddress === p.wallet_address}
                          >
                            <UserX size={14} />
                            {removingAddress === p.wallet_address ? 'Removing...' : 'Remove'}
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
          type="patient"
          onClose={() => setShowRegister(false)}
          onSuccess={loadPatients}
        />
      )}
    </div>
  );
}
