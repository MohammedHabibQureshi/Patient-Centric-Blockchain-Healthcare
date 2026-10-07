import { BrowserProvider, Signer, formatEther } from 'ethers';
import { WalletState } from '../types';

const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://10.32.0.108:7548';
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '1339');
const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME || 'Patient Healthcare Blockchain';
const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || 'ETH';
const BLOCK_EXPLORER_URL = import.meta.env.VITE_BLOCK_EXPLORER_URL || '';

declare global {
  interface Window {
    ethereum?: any;
  }
}

class Web3Service {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private listeners: Set<(state: WalletState) => void> = new Set();
  private currentState: WalletState = {
    isConnected: false,
    isCorrectNetwork: false
  };
  private isInitialized = false;

  constructor() {
    this.initializeIfPossible();
  }

  private initializeIfPossible(): void {
    if (typeof window === 'undefined') return;

    try {
      if (window.ethereum) {
        this.provider = new BrowserProvider(window.ethereum);
        this.setupEventListeners();
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('Web3 initialization failed (non-critical):', error);
      this.isInitialized = true;
    }
  }

  private setupEventListeners(): void {
    if (!window.ethereum) return;

    try {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        this.handleAccountsChanged(accounts);
      });

      window.ethereum.on('chainChanged', (chainId: string) => {
        this.handleChainChanged(chainId);
      });

      window.ethereum.on('disconnect', () => {
        this.handleDisconnect();
      });
    } catch (error) {
      console.warn('Failed to set up ethereum event listeners:', error);
    }
  }

  private async handleAccountsChanged(accounts: string[]): Promise<void> {
    if (accounts.length === 0) {
      this.handleDisconnect();
    } else {
      await this.updateState();
      this.notifyListeners();
    }
  }

  private async handleChainChanged(chainId: string): Promise<void> {
    await this.updateState();
    this.notifyListeners();

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private handleDisconnect(): void {
    this.signer = null;
    this.currentState = {
      isConnected: false,
      isCorrectNetwork: false
    };
    this.notifyListeners();
  }

  private async updateState(): Promise<void> {
    if (!this.provider) return;

    try {
      const accounts = await this.provider.listAccounts();
      const network = await this.provider.getNetwork();

      this.currentState = {
        isConnected: accounts.length > 0,
        address: accounts[0]?.address.toLowerCase(),
        chainId: Number(network.chainId),
        isCorrectNetwork: Number(network.chainId) === CHAIN_ID
      };

      if (accounts.length > 0) {
        this.signer = accounts[0];
        try {
          const balance = await this.provider.getBalance(accounts[0].address);
          this.currentState.balance = formatEther(balance);
        } catch {
          this.currentState.balance = '0';
        }
      }
    } catch (error) {
      console.error('Failed to update wallet state:', error);
      this.currentState = {
        isConnected: false,
        isCorrectNetwork: false
      };
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in wallet state listener:', error);
      }
    });
  }

  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener);
    if (this.isInitialized) {
      listener(this.currentState);
    }
    return () => this.listeners.delete(listener);
  }

  getState(): WalletState {
    return { ...this.currentState };
  }

  async connect(): Promise<WalletState> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
    }

    if (!this.provider) {
      this.provider = new BrowserProvider(window.ethereum);
      this.setupEventListeners();
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await this.updateState();
      this.notifyListeners();
      return this.currentState;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('Connection rejected. Please approve the connection in MetaMask.');
      }
      throw error;
    }
  }

  async switchNetwork(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // wallet_addEthereumChain UPDATES the RPC URL for an existing network,
      // unlike wallet_switchEthereumChain which only switches without updating.
      // Call this first so MetaMask always has the current RPC URL.
      await this.addNetwork();
    } catch (error: any) {
      if (error.code === 4001) {
        throw error;
      }
      // Fall back to basic chain switch if wallet_addEthereumChain is unsupported
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }]
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await this.addNetwork();
        } else {
          throw switchError;
        }
      }
    }
  }

  async addNetwork(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${CHAIN_ID.toString(16)}`,
        chainName: NETWORK_NAME,
        nativeCurrency: {
          name: CURRENCY_SYMBOL,
          symbol: CURRENCY_SYMBOL,
          decimals: 18
        },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: BLOCK_EXPLORER_URL ? [BLOCK_EXPLORER_URL] : []
      }]
    });
  }

  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return this.signer.signMessage(message);
  }

  async sendTransaction(transaction: any): Promise<any> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return this.signer.sendTransaction(transaction);
  }

  getProvider(): BrowserProvider | null {
    return this.provider;
  }

  getSigner(): Signer | null {
    return this.signer;
  }

  getChainId(): number {
    return CHAIN_ID;
  }

  getRpcUrl(): string {
    return RPC_URL;
  }

  isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
  }

  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatBalance(balance: string, decimals: number = 4): string {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    return num.toFixed(decimals);
  }
}

export const web3Service = new Web3Service();
export default web3Service;
