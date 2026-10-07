import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';


// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: {
    isMetaMask: true,
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    selectedAddress: null,
    chainId: '0x53B', // 1339 in hex
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    utils: {
      isAddress: vi.fn((addr) => /^0x[a-fA-F0-9]{40}$/.test(addr)),
      verifyMessage: vi.fn((msg, sig) => '0x1234567890123456789012345678901234567890'),
      keccak256: vi.fn((str) => '0x' + '0'.repeat(64)),
      toUtf8Bytes: vi.fn((str) => new TextEncoder().encode(str)),
    },
    providers: {
      Web3Provider: vi.fn().mockImplementation(() => ({
        getSigner: vi.fn().mockReturnValue({
          signMessage: vi.fn().mockResolvedValue('0xsignature'),
          sendTransaction: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ transactionHash: '0xtxhash' }) }),
        }),
        listAccounts: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1339, name: 'Patient Healthcare Blockchain' }),
        getBlockNumber: vi.fn().mockResolvedValue(100),
      })),
      JsonRpcProvider: vi.fn().mockImplementation(() => ({
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1339 }),
        getBlockNumber: vi.fn().mockResolvedValue(100),
        getCode: vi.fn().mockResolvedValue('0x1234'),
      })),
    },
    Wallet: vi.fn().mockImplementation(() => ({
      address: '0x1234567890123456789012345678901234567890',
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
      sendTransaction: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ transactionHash: '0xtxhash' }) }),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      registerPatient: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ events: [{ args: { userId: 1n } }], transactionHash: '0xtxhash' }) }),
      registerDoctor: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ events: [{ args: { userId: 2n } }], transactionHash: '0xtxhash' }) }),
      getUser: vi.fn().mockResolvedValue({
        userId: 1n,
        walletAddress: '0x1234567890123456789012345678901234567890',
        name: 'Test User',
        email: 'test@test.com',
        identifier: 'ID-001',
        role: 2,
        status: 1,
        registeredAt: 1234567890n,
        registeredBy: '0x1234567890123456789012345678901234567890',
        exists: true,
      }),
      isRegistered: vi.fn().mockResolvedValue(true),
      hasUserRole: vi.fn().mockResolvedValue(true),
      getUserRole: vi.fn().mockResolvedValue(2),
      getAllUsers: vi.fn().mockResolvedValue([]),
      getPatients: vi.fn().mockResolvedValue([]),
      getDoctors: vi.fn().mockResolvedValue([]),
      getTotalUsers: vi.fn().mockResolvedValue(0),
      getUserById: vi.fn().mockResolvedValue({ exists: false }),
      deactivateUser: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ transactionHash: '0xtxhash' }) }),
      reactivateUser: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ transactionHash: '0xtxhash' }) }),
      on: vi.fn(),
    })),
    constants: {
      AddressZero: '0x0000000000000000000000000000000000000000',
    },
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: vi.fn(() => null),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/dashboard' })),
  Routes: vi.fn(({ children }) => children),
  Route: vi.fn(({ children }) => children),
  Link: vi.fn(({ children }) => children),
  NavLink: vi.fn(({ children, className }) => React.createElement('a', { className }, children)),
  Outlet: vi.fn(() => null),
  Navigate: vi.fn(() => null),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icons = [
    'LayoutDashboard', 'Users', 'UserPlus', 'FileText', 'FolderOpen',
    'Shield', 'Activity', 'Settings', 'LogOut', 'Menu', 'X', 'ChevronDown',
    'Home', 'Search', 'ClipboardList', 'History', 'Bell', 'User',
    'Upload', 'Download', 'Eye', 'Hash', 'AlertCircle', 'CheckCircle',
    'Loader2', 'MoreHorizontal'
  ];
  const mockIcon = (name: string) => (props: any) => React.createElement('svg', { 'data-testid': name, ...props });
  return icons.reduce((acc, name) => ({ ...acc, [name]: mockIcon(name) }), {});
});