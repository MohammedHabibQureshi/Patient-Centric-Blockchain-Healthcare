import React, { useState } from 'react';
import { getAddress, isAddress } from 'ethers';
import { Loader2, X } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface RegisterUserModalProps {
  type: 'patient' | 'doctor';
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterUserModal({ type, onClose, onSuccess }: RegisterUserModalProps) {
  const [formData, setFormData] = useState({ walletAddress: '', name: '', email: '', identifier: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleLabel = type === 'patient' ? 'Patient' : 'Doctor';
  const identifierLabel = type === 'patient' ? 'Patient ID' : 'License Number';
  const identifierPlaceholder = type === 'patient' ? 'PAT-001' : 'MD-001';

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const input = formData.walletAddress.trim();

    if (!input) errors.walletAddress = 'Wallet address is required';
    else if (!isAddress(input)) errors.walletAddress = 'Invalid Ethereum/EVM wallet address. It must be a valid 0x address.';
    else {
      try {
        const checksummed = getAddress(input);
        setFormData(prev => ({ ...prev, walletAddress: checksummed }));
      } catch {
        errors.walletAddress = 'Invalid Ethereum/EVM wallet address.';
      }
    }

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.identifier.trim()) errors.identifier = `${identifierLabel} is required`;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getErrorMessage = (error: any): string => {
    const serverError = error?.response?.data?.error;

    // MetaMask user rejection / cancellation
    if (error?.code === 4001 || /user rejected|user denied/i.test(String(error?.message || error?.code))) {
      return 'Transaction cancelled in MetaMask.';
    }

    if (serverError) {
      if (typeof serverError === 'string') {
        return serverError;
      }
    }

    // Wallet/network connection problems before the request reaches the server
    if (!error?.response) {
      if (error?.code === 'ECONNABORTED') {
        return `${roleLabel} registration failed: the request timed out. Is the backend server running?`;
      }
      if (/not installed/i.test(String(error?.message))) {
        return error.message;
      }
      return `${roleLabel} registration failed: unable to reach the backend server. Please check that the server is running and the API URL is correct.`;
    }

    const status = error?.response?.status;
    if (status === 401) return 'Registration failed: you are not authenticated. Please log out and log back in.';
    if (status === 403) return 'Registration failed: you do not have permission to register users.';
    if (status === 400 || status === 422) {
      const msg = extractValidationMessage(error);
      return msg || 'Registration failed: the form data is invalid.';
    }

    // Server-side/blockchain revert or generic failure
    const reason = extractReasonFromServer(error);
    if (reason) {
      return `Patient registration failed: ${reason}`;
    }
    if (error?.reason || /cannot estimate gas|revert/i.test(String(error?.message || ''))) {
      return 'Patient registration failed: transaction reverted on the blockchain.';
    }
    return `Unable to register ${roleLabel.toLowerCase()}. Please verify the wallet address and blockchain connection, then try again.`;
  };

  const extractValidationMessage = (error: any): string | null => {
    const err = error?.response?.data;
    if (typeof err?.error === 'string') return err.error;
    if (typeof err?.message === 'string') return err.message;
    const items = err?.errors;
    if (items && typeof items === 'object') {
      for (const key of Object.keys(items)) {
        if (typeof items[key]?.message === 'string') return items[key].message;
      }
    }
    return null;
  };

  const extractReason = (error: any): string | null => {
    const candidates = [
      error?.error?.error?.reason,
      error?.error?.reason,
      error?.reason,
      error?.error?.error?.data?.reason,
      error?.error?.data?.reason,
      error?.data?.reason,
      error?.error?.error?.message,
      error?.error?.message,
      error?.message
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && /revert/i.test(c)) return extractRevertMessage(c);
    }
    return null;
  };

  const extractRevertMessage = (message: string): string | null => {
    const quoted = /reverted with reason string\s+'([^']+)'/.exec(message);
    if (quoted && quoted[1]) return quoted[1];
    const afterRevert = /(?:execution\s+)?revert(?:ed)?(?:\s+with?\s+reason string)?\s*:?\s*'?([^'"]+)/i.exec(message);
    if (afterRevert && afterRevert[1] && afterRevert[1].trim()) {
      const reason = afterRevert[1].trim();
      if (!/^VM Exception|^tracked|^processing transaction/i.test(reason)) return reason;
    }
    return message;
  };

  const extractReasonFromServer = (error: any): string | null => {
    const err = error?.response?.data;
    if (typeof err?.error === 'string') {
      // The backend already wraps as "Patient registration failed: <reason>".
      const wrapped = /Patient registration failed:\s*(.*)/.exec(err.error);
      return wrapped ? wrapped[1] : err.error;
    }
    return extractReason(error);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const address = getAddress(formData.walletAddress.trim());
      if (type === 'patient') {
        await apiService.registerPatient({
          walletAddress: address,
          name: formData.name.trim(),
          email: formData.email.trim(),
          patientId: formData.identifier.trim()
        });
      } else {
        await apiService.registerDoctor({
          walletAddress: address,
          name: formData.name.trim(),
          email: formData.email.trim(),
          licenseNumber: formData.identifier.trim()
        });
      }

      toast.success(`${roleLabel} registered successfully`);
      setFormData({ walletAddress: '', name: '', email: '', identifier: '' });
      setFormErrors({});
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(`Failed to register ${type}:`, error);
      if (error?.response?.data) {
        console.error('Server response:', error.response.data);
      }
      console.error(`Detailed ${type} registration error:`, {
        message: error?.message,
        code: error?.code,
        reason: error?.reason,
        tx: error?.transactionHash,
        status: error?.response?.status,
        data: error?.response?.data
      });
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Register New {roleLabel}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
            <div style={{ background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--color-primary)', lineHeight: '1.6' }}>
              Ask the {roleLabel.toLowerCase()} to open MetaMask and copy their public wallet address. Paste it below. Never ask for their private key or seed phrase.
            </div>
            <div className="form-group">
              <label className="form-label">Wallet Address</label>
              <input
                type="text"
                className={`form-input ${formErrors.walletAddress ? 'error' : ''}`}
                placeholder="0x..."
                value={formData.walletAddress}
                onChange={e => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
              />
              {formErrors.walletAddress && <div className="form-error">{formErrors.walletAddress}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className={`form-input ${formErrors.name ? 'error' : ''}`}
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
              {formErrors.name && <div className="form-error">{formErrors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-input ${formErrors.email ? 'error' : ''}`}
                placeholder="john@example.com"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
              {formErrors.email && <div className="form-error">{formErrors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">{identifierLabel}</label>
              <input
                type="text"
                className={`form-input ${formErrors.identifier ? 'error' : ''}`}
                placeholder={identifierPlaceholder}
                value={formData.identifier}
                onChange={e => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
              />
              {formErrors.identifier && <div className="form-error">{formErrors.identifier}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Role (auto-assigned):</span>
              <span className="badge badge-primary">{roleLabel.toUpperCase()}</span>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="loading-spinner" size={18} /> Registering...</> : 'Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
