import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User, AuthTokens } from '../types';
import { apiService } from '../services/api';
import { web3Service } from '../services/web3';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
  login: (walletAddress: string, signature: string, message: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: undefined,
    tokens: undefined,
    isAuthenticated: false,
    isLoading: true
  });

  const checkAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      apiService.initializeFromStorage();
      
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setState({ user: undefined, tokens: undefined, isAuthenticated: false, isLoading: false });
        return;
      }

      const user = await apiService.getCurrentUser();
      const tokens: AuthTokens = {
        accessToken,
        refreshToken: localStorage.getItem('refreshToken') || ''
      };

      setState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      console.error('Auth check failed:', error);
      apiService.clearAuth();
      setState({ user: undefined, tokens: undefined, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = useCallback(async (walletAddress: string, signature: string, message: string) => {
    try {
      const { user, tokens } = await apiService.verifyWalletAuth(walletAddress, signature, message);
      
      apiService.setTokens(tokens.accessToken, tokens.refreshToken);
      
      setState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false
      });

      toast.success(`Welcome, ${user.name}!`);
      return user;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Authentication failed');
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    apiService.clearAuth();
    setState({ user: undefined, tokens: undefined, isAuthenticated: false, isLoading: false });
    toast.success('Logged out successfully');
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;
    
    try {
      const user = await apiService.getCurrentUser();
      setState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [state.isAuthenticated]);

  // Initialize on mount
  useEffect(() => {
    checkAuth();

    // Subscribe to wallet changes
    const unsubscribe = web3Service.subscribe((walletState) => {
      if (!walletState.isConnected && state.isAuthenticated) {
        // Wallet disconnected, logout
        logout();
      }
    });

    return unsubscribe;
  }, [checkAuth, logout, state.isAuthenticated]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}