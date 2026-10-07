import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { apiService } from '../services/api';
import { web3Service } from '../services/web3';
import { Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function LoginPage() {
  const { login } = useAuth();
  const { state: walletState, connect, switchNetwork, signMessage, isMetaMaskInstalled } = useWallet();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'connect' | 'sign' | 'complete'>('connect');
  const [message, setMessage] = useState('');
  const [nonce, setNonce] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (walletState.isConnected && walletState.isCorrectNetwork && step === 'connect' && !isLoading) {
      setStep('sign');
    } else if (walletState.isConnected && !walletState.isCorrectNetwork) {
      setStep('connect');
      setError('Wrong network. Please switch to Patient Healthcare Blockchain (Chain ID: 1339) in MetaMask.');
    }
  }, [walletState.isConnected, walletState.isCorrectNetwork]);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      toast.error('MetaMask not found');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const connectedState = await connect();

      if (!connectedState.isConnected) {
        throw new Error('Wallet connection was rejected or failed.');
      }

      if (!connectedState.isCorrectNetwork) {
        try {
          await switchNetwork();
        } catch (switchErr: any) {
          throw new Error('Please switch to Patient Healthcare Blockchain (Chain ID: 1339) in MetaMask.');
        }
      }

      const address = connectedState.address;
      if (!address) {
        throw new Error('No wallet address returned from MetaMask.');
      }

      const nonceData = await apiService.getNonce(address);
      setNonce(nonceData.nonce);
      setMessage(nonceData.message);
      setStep('sign');
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setStep('connect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (!walletState.address || !message) return;

    setIsLoading(true);
    setError('');

    try {
      const signature = await signMessage(message);
      const user = await login(walletState.address, signature, message);
      setStep('complete');
      
      setTimeout(() => {
        switch (user?.role) {
          case 'ADMIN': navigate('/dashboard'); break;
          case 'PATIENT': navigate('/patient'); break;
          case 'DOCTOR': navigate('/doctor'); break;
          default: navigate('/dashboard');
        }
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(msg);
      setStep('connect');
    } finally {
      setIsLoading(false);
    }
  };

  const getNetworkInfo = () => {
    return {
      name: 'Patient Healthcare Blockchain',
      rpcUrl: web3Service.getRpcUrl(),
      chainId: web3Service.getChainId(),
      currency: 'ETH'
    };
  };

  if (step === 'complete') {
    return (
      <div className="wallet-connect">
        <CheckCircle className="wallet-connect-icon" style={{ color: 'var(--color-success)' }} size={80} />
        <h1 className="wallet-connect-title">Authentication Successful</h1>
        <p className="wallet-connect-description">Redirecting to dashboard...</p>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <Shield className="wallet-connect-icon" size={80} />
      <h1 className="wallet-connect-title">Patient Healthcare Blockchain</h1>
      <p className="wallet-connect-description">
        Secure, patient-centric medical record sharing powered by blockchain technology.
        Connect your MetaMask wallet to access your dashboard.
      </p>

      {error && (
        <div className="alert alert-error" style={{ width: '100%', maxWidth: '400px', marginBottom: '24px' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!isMetaMaskInstalled && (
        <div className="alert alert-warning" style={{ width: '100%', maxWidth: '400px', marginBottom: '24px' }}>
          <AlertCircle size={20} />
          <span>MetaMask not detected. <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Install MetaMask</a> to continue.</span>
        </div>
      )}

      {step === 'connect' && (
        <button 
          className="btn btn-primary btn-lg" 
          style={{ width: '100%', maxWidth: '400px' }}
          onClick={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="loading-spinner" size={20} />
              Connecting...
            </>
          ) : (
            'Connect MetaMask Wallet'
          )}
        </button>
      )}

      {step === 'sign' && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="alert alert-info" style={{ marginBottom: '24px', textAlign: 'left' }}>
            <CheckCircle size={20} />
            <div>
              <strong>Wallet Connected:</strong> {walletState.address ? web3Service.formatAddress(walletState.address) : 'Unknown'}
              {walletState.balance && <span style={{ marginLeft: '12px' }}>Balance: {parseFloat(walletState.balance).toFixed(4)} ETH</span>}
            </div>
          </div>

          <div style={{ background: 'var(--color-background)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '24px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '200px', overflow: 'auto' }}>
            <strong>Message to sign:</strong>
            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</pre>
          </div>

          <button 
            className="btn btn-primary btn-lg" 
            style={{ width: '100%' }}
            onClick={handleSign}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="loading-spinner" size={20} />
                Signing & Authenticating...
              </>
            ) : (
              'Sign Message & Login'
            )}
          </button>

          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            This signature proves ownership of your wallet. No gas fees required.
          </p>
        </div>
      )}

      {/* Network Configuration Info */}
      <details style={{ marginTop: '32px', width: '100%', maxWidth: '500px', textAlign: 'left' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Network Configuration (for MetaMask setup)
        </summary>
        <div style={{ marginTop: '16px', padding: '16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'monospace' }}>
          <div><strong>Network Name:</strong> {getNetworkInfo().name}</div>
          <div><strong>RPC URL:</strong> {getNetworkInfo().rpcUrl}</div>
          <div><strong>Chain ID:</strong> {getNetworkInfo().chainId}</div>
          <div><strong>Currency Symbol:</strong> {getNetworkInfo().currency}</div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Note: The RPC URL must be the ngrok HTTPS endpoint (e.g., https://abc123.ngrok-free.app) or your server's LAN IP, not localhost.
          </div>
        </div>
      </details>
    </div>
  );
}