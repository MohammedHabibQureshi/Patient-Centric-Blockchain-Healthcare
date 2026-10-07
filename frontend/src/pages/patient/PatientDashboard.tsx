import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Upload, Shield, ClipboardList, History, Loader2, MoreHorizontal, Download, Hash, AlertCircle, CheckCircle, User, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { web3Service } from '../../services/web3';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function PatientDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { state: walletState } = useWallet();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'upload' | 'requests' | 'granted' | 'doctors' | 'audit' | 'profile'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [grantedAccess, setGrantedAccess] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordName, setRecordName] = useState('');
  const [recordType, setRecordType] = useState('LAB_RESULT');
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Doctors state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ reason: '', purpose: '' });
  const [sendingRequest, setSendingRequest] = useState(false);
  const [myPatientRequests, setMyPatientRequests] = useState<any[]>([]);

  const recordTypes = [
    { value: 'GENERAL', label: 'General' },
    { value: 'LAB_RESULT', label: 'Lab Result' },
    { value: 'IMAGING', label: 'Imaging' },
    { value: 'PRESCRIPTION', label: 'Prescription' },
    { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
    { value: 'CONSULTATION', label: 'Consultation' },
    { value: 'VACCINATION', label: 'Vaccination' },
    { value: 'OTHER', label: 'Other' }
  ];

  useEffect(() => {
    const pathMap: Record<string, typeof activeTab> = {
      '/patient/records': 'records',
      '/patient/upload': 'upload',
      '/patient/requests': 'requests',
      '/patient/granted': 'granted',
      '/patient/doctors': 'doctors',
      '/patient/audit': 'audit',
      '/patient/profile': 'profile',
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
    if (activeTab === 'doctors') {
      loadDoctors();
      loadMyPatientRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'profile') return;
    setProfileLoading(true);
    (async () => {
      try {
        const data = await apiService.getCurrentUser();
        setProfileData(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
        setProfileData(null);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [activeTab]);

  const loadAuditLogs = async () => {
    try {
      const data = await apiService.getAuditLogs({ page: 1, limit: 100 });
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  };

  const loadDoctors = async () => {
    try {
      setDoctorsLoading(true);
      const data = await apiService.getDoctorsList();
      setDoctors(data.doctors || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
      toast.error('Unable to load doctors. Please check your network connection.');
    } finally {
      setDoctorsLoading(false);
    }
  };

  const loadMyPatientRequests = async () => {
    try {
      const data = await apiService.getMyPatientRequests();
      setMyPatientRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load patient requests:', error);
    }
  };

  const handleRequestDoctor = async () => {
    if (!selectedDoctor || !requestForm.reason.trim() || !requestForm.purpose.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSendingRequest(true);
      await apiService.requestDoctorAccess({
        doctorWalletAddress: selectedDoctor.wallet_address,
        reason: requestForm.reason,
        purpose: requestForm.purpose
      });
      toast.success('Request sent successfully');
      setShowRequestModal(false);
      setRequestForm({ reason: '', purpose: '' });
      setSelectedDoctor(null);
      loadMyPatientRequests();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to send request';
      toast.error(message);
    } finally {
      setSendingRequest(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsData, recordsData, requestsData, grantedData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getMyRecords(),
        apiService.getMyAccessRequests(),
        apiService.getMyAccessRequests() // This gets all, we'll filter
      ]);
      
      setStats(statsData?.stats || statsData);
      setRecords(recordsData.records || []);
      setRequests(requestsData.requests.filter((r: any) => r.status === 'PENDING') || []);
      setGrantedAccess(requestsData.requests.filter((r: any) => r.status === 'APPROVED') || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!recordName) {
        setRecordName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !recordName.trim()) {
      toast.error('Please select a file and enter a record name');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      // recordType holds the uppercase enum key (e.g. "PRESCRIPTION") that the
      // backend maps to the numeric enum value the smart contract expects.
      const result = await apiService.uploadRecord(selectedFile, recordType, recordName, setUploadProgress);
      
      toast.success('Record uploaded successfully');
      setSelectedFile(null);
      setRecordName('');
      setUploadProgress(0);
      loadDashboardData();
    } catch (error: any) {
      console.error('Record upload failed:', error);
      toast.error(error.response?.data?.error || 'Failed to upload record');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await apiService.approveAccess(requestId);
      toast.success('Access approved');
      loadDashboardData();
    } catch (error: any) {
      console.error('Failed to grant record access:', error);
      const message = error.response?.data?.error || 'Failed to approve access';
      toast.error(message);
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      await apiService.denyAccess(requestId);
      toast.success('Access denied');
      loadDashboardData();
    } catch (error: any) {
      console.error('Failed to deny access:', error);
      const message = error.response?.data?.error || 'Failed to deny access';
      toast.error(message);
    }
  };

  const handleRevoke = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to revoke access? This action cannot be undone.')) return;
    
    try {
      await apiService.revokeAccess(requestId);
      toast.success('Access revoked');
      loadDashboardData();
    } catch (error: any) {
      console.error('Failed to revoke access:', error);
      const message = error.response?.data?.error || 'Failed to revoke access';
      toast.error(message);
    }
  };

  const handleDownload = async (record: any) => {
    try {
      const blob = await apiService.downloadRecord(record.id);
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

  const handleVerify = async (record: any) => {
    try {
      const result = await apiService.verifyRecordIntegrity(record.id);
      toast.success(result.isValid ? 'File integrity verified ✓' : 'File integrity check failed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify record');
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
          <div className="stat-icon primary"><FileText size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.totalRecords || 0}</div>
            <div className="stat-label">Total Records</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><ClipboardList size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.pendingRequests || 0}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Shield size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.activePermissions || 0}</div>
            <div className="stat-label">Active Permissions</div>
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Records</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('records')}>View All</button>
        </div>
        <div className="card-content">
          {records.length === 0 ? (
            <div className="empty-state">
              <FileText className="empty-state-icon" size={64} />
              <div className="empty-state-title">No records yet</div>
              <div className="empty-state-description">Upload your first medical record to get started</div>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('upload')}>
                <Upload size={18} /> Upload Record
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th>Size</th>
                    <th>Hash</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 5).map((record: any) => (
                    <tr key={record.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{record.record_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{record.record_type}</div>
                      </td>
                      <td><span className="badge badge-primary">{record.record_type}</span></td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(record.uploaded_at), 'MMM d, yyyy')}</td>
                      <td style={{ fontSize: '13px' }}>{(record.file_size / 1024).toFixed(1)} KB</td>
                      <td>
                        <code style={{ fontSize: '11px' }}>{record.file_hash.slice(0, 16)}...</code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleDownload(record)} title="Download">
                            <Download size={16} />
                          </button>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleVerify(record)} title="Verify Integrity">
                            <Hash size={16} />
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

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <div className="card-title">Pending Access Requests</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('requests')}>View All</button>
          </div>
          <div className="card-content">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Record</th>
                    <th>Reason</th>
                    <th>Requested</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.doctor_name || 'Unknown Doctor'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.doctor_wallet?.slice(0, 10)}...{req.doctor_wallet?.slice(-6)}</div>
                      </td>
                      <td>{req.record_name || 'All Records'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'MMM d, HH:mm')}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {req.expires_at ? format(new Date(req.expires_at), 'MMM d, HH:mm') : 'No expiry'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleApprove(req.id)}>Approve</button>
                          <button className="btn btn-error btn-sm" onClick={() => handleDeny(req.id)}>Deny</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRecords = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">My Medical Records</div>
        </div>
        <div className="card-content">
          {records.length === 0 ? (
            <div className="empty-state">
              <FileText className="empty-state-icon" size={64} />
              <div className="empty-state-title">No records yet</div>
              <div className="empty-state-description">Upload your first medical record to get started</div>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('upload')}>
                <Upload size={18} /> Upload Record
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th>Size</th>
                    <th>Hash</th>
                    <th>Storage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record: any) => (
                    <tr key={record.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{record.record_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{record.record_type}</div>
                      </td>
                      <td><span className="badge badge-primary">{record.record_type}</span></td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(record.uploaded_at), 'MMM d, yyyy HH:mm')}</td>
                      <td style={{ fontSize: '13px' }}>{(record.file_size / 1024).toFixed(1)} KB</td>
                      <td><code style={{ fontSize: '11px' }}>{record.file_hash.slice(0, 24)}...</code></td>
                      <td><code style={{ fontSize: '11px' }}>{record.storage_cid.slice(0, 20)}...</code></td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleDownload(record)} title="Download">
                            <Download size={16} />
                          </button>
                          <button className="btn btn-ghost btn-icon" onClick={() => handleVerify(record)} title="Verify Integrity">
                            <Hash size={16} />
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

  const renderUpload = () => (
    <div>
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <div className="card-title">Upload Medical Record</div>
        </div>
        <div className="card-content">
          <form onSubmit={e => { e.preventDefault(); handleUpload(); }}>
            <div className="form-group">
              <label className="form-label">Record File</label>
              <input
                type="file"
                className="form-input"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.txt,.dcm"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <div className="form-help">Supported formats: PDF, JPG, PNG, TIFF, DICOM, TXT (Max 50MB)</div>
            </div>

            <div className="form-group">
              <label className="form-label">Record Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Blood Test Report - January 2024"
                value={recordName}
                onChange={e => setRecordName(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Record Type</label>
              <select
                className="form-input"
                value={recordType}
                onChange={e => setRecordType(e.target.value)}
                disabled={isUploading}
              >
                {recordTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {isUploading && (
              <div className="form-group">
                <label className="form-label">Upload Progress</label>
                <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      background: 'var(--color-primary)', 
                      width: `${uploadProgress}%`,
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" disabled={isUploading || !selectedFile}>
                {isUploading ? <Loader2 className="loading-spinner" size={18} /> : 'Upload Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Access Requests</div>
        </div>
        <div className="card-content">
          {requests.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" size={64} />
              <div className="empty-state-title">No pending requests</div>
              <div className="empty-state-description">Doctors' access requests will appear here</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Record</th>
                    <th>Reason</th>
                    <th>Purpose</th>
                    <th>Requested</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.doctor_name || 'Unknown Doctor'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.doctor_wallet?.slice(0, 10)}...{req.doctor_wallet?.slice(-6)}</div>
                      </td>
                      <td>{req.record_name || 'All Records'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.purpose}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'MMM d, yyyy HH:mm')}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {req.expires_at ? format(new Date(req.expires_at), 'MMM d, yyyy HH:mm') : 'No expiry'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleApprove(req.id)}>Approve</button>
                          <button className="btn btn-error btn-sm" onClick={() => handleDeny(req.id)}>Deny</button>
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

  const renderGranted = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Granted Access</div>
        </div>
        <div className="card-content">
          {grantedAccess.length === 0 ? (
            <div className="empty-state">
              <Shield className="empty-state-icon" size={64} />
              <div className="empty-state-title">No active permissions</div>
              <div className="empty-state-description">Approved access requests will appear here</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Record</th>
                    <th>Approved</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grantedAccess.map((req: any) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.doctor_name || 'Unknown Doctor'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{req.doctor_wallet?.slice(0, 10)}...{req.doctor_wallet?.slice(-6)}</div>
                      </td>
                      <td>{req.record_name || 'All Records'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{format(new Date(req.decided_at), 'MMM d, yyyy HH:mm')}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {req.expires_at ? format(new Date(req.expires_at), 'MMM d, yyyy HH:mm') : 'No expiry'}
                      </td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>
                        <button className="btn btn-error btn-sm" onClick={() => handleRevoke(req.id)}>Revoke</button>
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

  const renderDoctors = () => {
    const getDoctorRequestStatus = (doctorWallet: string) => {
      const req = myPatientRequests.find((r: any) => r.doctor_wallet?.toLowerCase() === doctorWallet?.toLowerCase());
      return req ? req.status : null;
    };

    return (
      <div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Registered Doctors</div>
          </div>
          <div className="card-content">
            {doctorsLoading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Loader2 className="loading-spinner" size={24} />
                <div style={{ marginTop: '12px' }}>Loading doctors...</div>
              </div>
            ) : doctors.length === 0 ? (
              <div className="empty-state">
                <User className="empty-state-icon" size={64} />
                <div className="empty-state-title">No active doctors</div>
                <div className="empty-state-description">No active doctors are currently registered in the network</div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>License ID</th>
                      <th>Email</th>
                      <th>Wallet</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor: any) => {
                      const requestStatus = getDoctorRequestStatus(doctor.wallet_address);
                      return (
                        <tr key={doctor.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="user-avatar" style={{ width: 36, height: 36 }}>
                                {doctor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500 }}>Dr. {doctor.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{doctor.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '13px' }}>{doctor.identifier}</td>
                          <td style={{ fontSize: '13px' }}>{doctor.email}</td>
                          <td><code style={{ fontSize: '11px' }}>{doctor.wallet_address?.slice(0, 10)}...{doctor.wallet_address?.slice(-6)}</code></td>
                          <td>
                            {requestStatus === 'PENDING' && <span className="badge badge-warning">Request Pending</span>}
                            {requestStatus === 'ACCEPTED' && <span className="badge badge-success">Connected</span>}
                            {requestStatus === 'REJECTED' && <span className="badge badge-error">Request Rejected</span>}
                            {!requestStatus && <span className="badge badge-gray">Not Connected</span>}
                          </td>
                          <td>
                            {!requestStatus && (
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => { setSelectedDoctor(doctor); setShowRequestModal(true); }}
                              >
                                Request Access
                              </button>
                            )}
                            {requestStatus === 'ACCEPTED' && (
                              <span style={{ fontSize: '13px', color: 'var(--color-success)' }}>Connected</span>
                            )}
                            {requestStatus === 'PENDING' && (
                              <span style={{ fontSize: '13px', color: 'var(--color-warning)' }}>Pending</span>
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

        {/* Request Access Modal */}
        {showRequestModal && selectedDoctor && (
          <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
            <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Request Access from Doctor</h2>
                <button className="modal-close" onClick={() => setShowRequestModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar">
                      {selectedDoctor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Dr. {selectedDoctor.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{selectedDoctor.identifier}</div>
                    </div>
                  </div>
                </div>

                <form onSubmit={e => { e.preventDefault(); handleRequestDoctor(); }}>
                  <div className="form-group">
                    <label className="form-label">Reason for Request *</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Explain why you need access to this doctor"
                      value={requestForm.reason}
                      onChange={e => setRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purpose *</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Describe the treatment or consultation purpose"
                      value={requestForm.purpose}
                      onChange={e => setRequestForm(prev => ({ ...prev, purpose: e.target.value }))}
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={sendingRequest}>
                      {sendingRequest ? <Loader2 className="loading-spinner" size={18} /> : 'Send Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
              <div className="empty-state-description">Please connect your patient wallet to view your profile.</div>
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

    if (!profileData || profileData.role !== 'PATIENT') {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">My Profile</div>
          </div>
          <div className="card-content">
            <div className="empty-state">
              <AlertCircle className="empty-state-icon" size={64} />
              <div className="empty-state-title">Patient profile not found</div>
              <div className="empty-state-description">
                Patient profile not found for the connected wallet. Please contact the administrator.
              </div>
            </div>
          </div>
        </div>
      );
    }

    const profileRows = [
      { label: 'Full Name', value: profileData.name || '—' },
      { label: 'Email', value: profileData.email || '—' },
      { label: 'Patient ID', value: profileData.identifier || '—' },
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

  if (isLoading) {
    return <LoadingSpinner size="large" message="Loading dashboard..." />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <FileText size={18} /> },
    { id: 'records', label: 'My Records', icon: <FileText size={18} /> },
    { id: 'upload', label: 'Upload Record', icon: <Upload size={18} /> },
    { id: 'requests', label: 'Access Requests', icon: <ClipboardList size={18} /> },
    { id: 'granted', label: 'Granted Access', icon: <Shield size={18} /> },
    { id: 'doctors', label: 'Find Doctors', icon: <User size={18} /> },
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
      {activeTab === 'records' && renderRecords()}
      {activeTab === 'upload' && renderUpload()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'granted' && renderGranted()}
      {activeTab === 'doctors' && renderDoctors()}
      {activeTab === 'audit' && renderAudit()}
      {activeTab === 'profile' && renderProfile()}
    </div>
  );
}