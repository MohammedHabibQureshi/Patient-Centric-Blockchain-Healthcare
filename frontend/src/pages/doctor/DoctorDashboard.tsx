import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ClipboardList, FolderOpen, History, Loader2, Download, Eye, AlertCircle, CheckCircle, User, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { web3Service } from '../../services/web3';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function DoctorDashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const { state: walletState } = useWallet();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'requests' | 'patient-requests' | 'authorized' | 'audit' | 'profile'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [authorizedRecords, setAuthorizedRecords] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    recordId: '',
    accessLevel: 'SPECIFIC_RECORD',
    reason: '',
    purpose: '',
    expiresInHours: '24'
  });

  // Connected patients state (patients with accepted connection + record-access status)
  const [connectedPatients, setConnectedPatients] = useState<any[]>([]);
  const [connectedPatientsLoading, setConnectedPatientsLoading] = useState(false);

  // Patient requests state
  const [patientRequests, setPatientRequests] = useState<any[]>([]);
  const [patientRequestsLoading, setPatientRequestsLoading] = useState(false);
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);

  // Profile state
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const accessLevels = [
    { value: 'SPECIFIC_RECORD', label: 'Specific Record' },
    { value: 'FULL_RECORD', label: 'Full Record Access' },
    { value: 'RECORD_CATEGORY', label: 'Record Category' }
  ];

  useEffect(() => {
    const pathMap: Record<string, typeof activeTab> = {
      '/doctor/search': 'search',
      '/doctor/requests': 'requests',
      '/doctor/patient-requests': 'patient-requests',
      '/doctor/authorized': 'authorized',
      '/doctor/audit': 'audit',
      '/doctor/profile': 'profile',
    };
    const tab = pathMap[location.pathname];
    if (tab) setActiveTab(tab);
  }, [location.pathname]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'patient-requests') {
      loadPatientRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'search') {
      loadConnectedPatients();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab]);

  const loadAuditLogs = async () => {
    try {
      const data = await apiService.getAuditLogs({ page: 1, limit: 100 });
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  };

  const loadPatientRequests = async () => {
    try {
      setPatientRequestsLoading(true);
      const data = await apiService.getDoctorPatientRequests();
      setPatientRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load patient requests:', error);
      toast.error('Unable to load patient requests');
    } finally {
      setPatientRequestsLoading(false);
    }
  };

  const loadConnectedPatients = async () => {
    try {
      setConnectedPatientsLoading(true);
      const data = await apiService.getConnectedPatients();
      setConnectedPatients(data.patients || []);
    } catch (error) {
      console.error('Failed to load connected patients:', error);
      toast.error('Unable to load connected patients');
    } finally {
      setConnectedPatientsLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const data = await apiService.getCurrentUser();
      setProfileData(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      setAcceptingRequest(requestId);
      await apiService.acceptPatientRequest(requestId);
      toast.success('Request accepted successfully');
      loadPatientRequests();
      loadDashboardData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to accept request';
      toast.error(message);
    } finally {
      setAcceptingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      setAcceptingRequest(requestId);
      await apiService.rejectPatientRequest(requestId);
      toast.success('Request rejected');
      loadPatientRequests();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to reject request';
      toast.error(message);
    } finally {
      setAcceptingRequest(null);
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsData, patientsData, requestsData, authorizedData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getPatients(),
        apiService.getMyAccessRequests(),
        apiService.getAuthorizedRecords()
      ]);
      
      setStats(statsData?.stats || statsData);
      setPatients(patientsData.patients || []);
      setRequests(requestsData.requests || []);
      setAuthorizedRecords(authorizedData.records || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!selectedPatient || !requestForm.reason.trim() || !requestForm.purpose.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await apiService.requestAccess({
        patientWalletAddress: selectedPatient.wallet_address,
        recordId: requestForm.recordId || undefined,
        accessLevel: accessLevels.find(a => a.value === requestForm.accessLevel)?.value === 'SPECIFIC_RECORD' ? 1 : 
                    requestForm.accessLevel === 'FULL_RECORD' ? 0 : 2,
        reason: requestForm.reason,
        purpose: requestForm.purpose,
        expiresInHours: parseInt(requestForm.expiresInHours)
      });
      
      toast.success('Access request sent');
      setShowRequestModal(false);
      setRequestForm({ recordId: '', accessLevel: 'SPECIFIC_RECORD', reason: '', purpose: '', expiresInHours: '24' });
      loadDashboardData();
      loadConnectedPatients();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const msg = error.response?.data?.error || 'Failed to request access';
      console.error('Request access failed:', detail || error);
      toast.error(detail ? `${msg}: ${detail}` : msg);
    }
  };

  const handleDownload = async (record: any) => {
    try {
      const blob = await apiService.downloadRecord(record.record_uuid || record.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.record_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to download record');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <span className="badge badge-warning">Pending</span>;
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'DENIED': return <span className="badge badge-error">Denied</span>;
      case 'REVOKED': return <span className="badge badge-error">Revoked</span>;
      case 'EXPIRED': return <span className="badge badge-gray">Expired</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  const renderDashboard = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon warning"><ClipboardList size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.pendingRequests || 0}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.approvedAccess || 0}</div>
            <div className="stat-label">Approved Access</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><FolderOpen size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.availableRecords || 0}</div>
            <div className="stat-label">Available Records</div>
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-title">Recent Access Requests</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('requests')}>View All</button>
        </div>
        <div className="card-content">
          {requests.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" size={64} />
              <div className="empty-state-title">No requests yet</div>
              <div className="empty-state-description">Request access to patient records to get started</div>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('search')}>
                <Search size={18} /> Search Patients
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Record</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.patient_name || 'Unknown Patient'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.patient_wallet?.slice(0, 10)}...{req.patient_wallet?.slice(-6)}</div>
                      </td>
                      <td>{req.record_name || 'All Records'}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'MMM d, HH:mm')}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {req.expires_at ? format(new Date(req.expires_at), 'MMM d, HH:mm') : 'No expiry'}
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

  const renderSearch = () => {
    const getRecordAccessBadge = (status: string | null) => {
      if (!status) return <span className="badge badge-gray">Not Requested</span>;
      switch (status) {
        case 'PENDING': return <span className="badge badge-warning">Request Pending</span>;
        case 'APPROVED': return <span className="badge badge-success">Access Granted</span>;
        case 'DENIED': return <span className="badge badge-error">Request Denied</span>;
        case 'REVOKED': return <span className="badge badge-error">Access Revoked</span>;
        default: return <span className="badge badge-gray">{status}</span>;
      }
    };

    // Filter connected patients by search query
    const filteredPatients = connectedPatients.filter(p =>
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.wallet_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.identifier?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div>
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Connected Patients</div>
          </div>
          <div className="card-content">
            <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', marginBottom: connectedPatients.length > 0 ? '20px' : 0 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Filter by name, wallet address, or patient ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            {connectedPatientsLoading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Loader2 className="loading-spinner" size={24} />
                <div style={{ marginTop: '12px' }}>Loading connected patients...</div>
              </div>
            ) : connectedPatients.length === 0 ? (
              <div className="empty-state">
                <User className="empty-state-icon" size={64} />
                <div className="empty-state-title">No connected patients</div>
                <div className="empty-state-description">
                  When patients request access and you accept, they will appear here.
                  <br />You can then request access to their medical records.
                </div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="empty-state">
                <Search className="empty-state-icon" size={64} />
                <div className="empty-state-title">No patients match your search</div>
                <div className="empty-state-description">Try a different search term</div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Patient ID</th>
                      <th>Wallet</th>
                      <th>Record Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient: any) => {
                      const recordStatus = patient.record_access_status;
                      return (
                        <tr key={patient.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="user-avatar" style={{ width: 36, height: 36 }}>
                                {patient.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{patient.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{patient.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '13px' }}>{patient.identifier}</td>
                          <td><code style={{ fontSize: '11px' }}>{patient.wallet_address.slice(0, 10)}...{patient.wallet_address.slice(-6)}</code></td>
                          <td>{getRecordAccessBadge(recordStatus)}</td>
                          <td>
                            {(!recordStatus || recordStatus === 'DENIED' || recordStatus === 'REVOKED') && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => { setSelectedPatient(patient); setShowRequestModal(true); }}
                              >
                                {recordStatus ? 'Request Again' : 'Request Access'}
                              </button>
                            )}
                            {recordStatus === 'PENDING' && (
                              <span style={{ fontSize: '13px', color: 'var(--color-warning)' }}>Request Pending</span>
                            )}
                            {recordStatus === 'APPROVED' && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => setActiveTab('authorized')}
                              >
                                View Records
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRequests = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">My Access Requests</div>
        </div>
        <div className="card-content">
          {requests.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" size={64} />
              <div className="empty-state-title">No requests yet</div>
              <div className="empty-state-description">Request access to patient records to get started</div>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('search')}>
                <Search size={18} /> Search Patients
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Record</th>
                    <th>Access Level</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.patient_name || 'Unknown Patient'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.patient_wallet?.slice(0, 10)}...{req.patient_wallet?.slice(-6)}</div>
                      </td>
                      <td>{req.record_name || 'All Records'}</td>
                      <td><span className="badge badge-primary">{req.access_level}</span></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'MMM d, yyyy HH:mm')}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {req.expires_at ? format(new Date(req.expires_at), 'MMM d, yyyy HH:mm') : 'No expiry'}
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

  const renderAuthorized = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Authorized Records</div>
        </div>
        <div className="card-content">
          {authorizedRecords.length === 0 ? (
            <div className="empty-state">
              <FolderOpen className="empty-state-icon" size={64} />
              <div className="empty-state-title">No authorized records</div>
              <div className="empty-state-description">Approved records will appear here</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Record</th>
                    <th>Type</th>
                    <th>Approved</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizedRecords.map((record: any) => (
                    <tr key={record.id || record.record_uuid}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{record.patient_name || 'Unknown Patient'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{record.patient_wallet?.slice(0, 10)}...{record.patient_wallet?.slice(-6)}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{record.record_name}</td>
                      <td><span className="badge badge-primary">{record.record_type || 'N/A'}</span></td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {record.decided_at ? format(new Date(record.decided_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {record.expires_at ? format(new Date(record.expires_at), 'MMM d, yyyy HH:mm') : 'No expiry'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleDownload(record)} title="Download">
                            <Download size={16} />
                          </button>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleView(record)} title="View">
                            <Eye size={16} />
                          </button>
                        </div>
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

  const renderAudit = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Audit Log</div>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                      No audit logs available
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ').toLowerCase()}</td>
                      <td>{log.target_type} {log.target_identifier ? `: ${log.target_identifier}` : ''}</td>
                      <td>{getStatusBadge(log.status)}</td>
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

  const renderPatientRequests = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Patient Access Requests</div>
        </div>
        <div className="card-content">
          {patientRequestsLoading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Loader2 className="loading-spinner" size={24} />
              <div style={{ marginTop: '12px' }}>Loading patient requests...</div>
            </div>
          ) : patientRequests.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" size={64} />
              <div className="empty-state-title">No patient requests</div>
              <div className="empty-state-description">Patient access requests will appear here</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Patient ID</th>
                    <th>Wallet</th>
                    <th>Reason</th>
                    <th>Purpose</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patientRequests.map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.patient_name || 'Unknown Patient'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.patient_email}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{req.patient_id}</td>
                      <td><code style={{ fontSize: '11px' }}>{req.patient_wallet?.slice(0, 10)}...{req.patient_wallet?.slice(-6)}</code></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.purpose}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'MMM d, yyyy HH:mm')}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>
                        {req.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-success btn-sm" 
                              onClick={() => handleAcceptRequest(req.id)}
                              disabled={acceptingRequest === req.id}
                            >
                              {acceptingRequest === req.id ? <Loader2 className="loading-spinner" size={14} /> : 'Accept'}
                            </button>
                            <button 
                              className="btn btn-error btn-sm" 
                              onClick={() => handleRejectRequest(req.id)}
                              disabled={acceptingRequest === req.id}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status === 'ACCEPTED' && (
                          <span style={{ fontSize: '13px', color: 'var(--color-success)' }}>Connected</span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>Rejected</span>
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
    </div>
  );

  const renderProfile = () => {
    if (!walletState.isConnected) {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Profile</div>
          </div>
          <div className="card-content">
            <div className="empty-state">
              <User className="empty-state-icon" size={64} />
              <div className="empty-state-title">Wallet not connected</div>
              <div className="empty-state-description">Please connect your doctor wallet to view your profile.</div>
            </div>
          </div>
        </div>
      );
    }

    if (profileLoading) {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Profile</div>
          </div>
          <div className="card-content">
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Loader2 className="loading-spinner" size={24} />
              <div style={{ marginTop: '12px' }}>Loading profile...</div>
            </div>
          </div>
        </div>
      );
    }

    if (!profileData || profileData.role !== 'DOCTOR') {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Profile</div>
          </div>
          <div className="card-content">
            <div className="empty-state">
              <AlertCircle className="empty-state-icon" size={64} />
              <div className="empty-state-title">Doctor profile not found</div>
              <div className="empty-state-description">
                Doctor profile not found for the connected wallet. Please contact the administrator.
              </div>
            </div>
          </div>
        </div>
      );
    }

    const profileRows = [
      { label: 'Full Name', value: `Dr. ${profileData.name || '—'}` },
      { label: 'Email', value: profileData.email || '—' },
      { label: 'Doctor ID', value: profileData.identifier || '—' },
      { label: 'Role', value: profileData.role || '—' },
      { label: 'Wallet Address', value: walletState.address ? web3Service.formatAddress(walletState.address) : '—' },
    ];

    return (
      <div>
        <div className="card" style={{ maxWidth: '560px' }}>
          <div className="card-header">
            <div className="card-title">My Profile</div>
          </div>
          <div className="card-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {profileRows.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleView = (record: any) => {
    toast.success('Record view coming soon');
  };

  if (isLoading) {
    return <LoadingSpinner size="large" message="Loading dashboard..." />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <FolderOpen size={18} /> },
    { id: 'search', label: 'Search Patients', icon: <Search size={18} /> },
    { id: 'requests', label: 'My Requests', icon: <ClipboardList size={18} /> },
    { id: 'patient-requests', label: 'Patient Requests', icon: <ClipboardList size={18} /> },
    { id: 'authorized', label: 'Authorized Records', icon: <FolderOpen size={18} /> },
    { id: 'audit', label: 'Audit Log', icon: <History size={18} /> },
    { id: 'profile', label: 'Profile', icon: <User size={18} /> }
  ];

  return (
    <div className="page-content">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'search' && renderSearch()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'patient-requests' && renderPatientRequests()}
      {activeTab === 'authorized' && renderAuthorized()}
      {activeTab === 'audit' && renderAudit()}
      {activeTab === 'profile' && renderProfile()}

      {/* Request Access Modal */}
      {showRequestModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Request Access</h2>
              <button className="modal-close" onClick={() => setShowRequestModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="user-avatar">
                    {selectedPatient.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{selectedPatient.identifier}</div>
                  </div>
                </div>
              </div>

              <form onSubmit={e => { e.preventDefault(); handleRequestAccess(); }}>
                <div className="form-group">
                  <label className="form-label">Record (Optional)</label>
                  <select className="form-input" value={requestForm.recordId} onChange={e => setRequestForm(prev => ({ ...prev, recordId: e.target.value }))}>
                    <option value="">All Records / Full Access</option>
                    {/* In a real app, you'd fetch patient's records here */}
                  </select>
                  <div className="form-help">Leave empty for full record access request</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Access Level</label>
                  <select className="form-input" value={requestForm.accessLevel} onChange={e => setRequestForm(prev => ({ ...prev, accessLevel: e.target.value }))}>
                    {accessLevels.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Access *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Explain why you need access to this patient's records"
                    value={requestForm.reason}
                    onChange={e => setRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Purpose *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Describe the clinical or treatment purpose"
                    value={requestForm.purpose}
                    onChange={e => setRequestForm(prev => ({ ...prev, purpose: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiration (Hours)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="720"
                    value={requestForm.expiresInHours}
                    onChange={e => setRequestForm(prev => ({ ...prev, expiresInHours: e.target.value }))}
                  />
                  <div className="form-help">Set to 0 for no expiration, or specify hours (max 720 = 30 days)</div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Request Access</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}