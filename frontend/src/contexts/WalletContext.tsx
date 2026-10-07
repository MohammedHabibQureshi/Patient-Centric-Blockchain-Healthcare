import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WalletState } from '../types';
import { web3Service } from '../services/web3';
import toast from 'react-hot-toast';

interface WalletContextType {
  state: WalletState;
  connect: () => Promise<WalletState>;
  switchNetwork: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  isMetaMaskInstalled: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(web3Service.getState());

  useEffect(() => {
    const unsubscribe = web3Service.subscribe(setState);
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    try {
      return await web3Service.connect();
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await web3Service.switchNetwork();
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  }, []);

  const signMessage = useCallback(async (message: string) => {
    return web3Service.signMessage(message);
  }, []);

  return (
    <WalletContext.Provider value={{
      state,
      connect,
      switchNetwork,
      signMessage,
      isMetaMaskInstalled: web3Service.isMetaMaskInstalled()
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}