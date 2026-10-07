import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { 
  LayoutDashboard, UserPlus, Users, FileText, FolderOpen, 
  Shield, Activity, Settings, LogOut, Menu, X, ChevronDown,
  Home, Search, ClipboardList, History, Bell, User
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const navItems: NavItem[] = [
  // Admin
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { label: 'Patients', path: '/dashboard/patients', icon: Users, roles: ['ADMIN'] },
  { label: 'Doctors', path: '/dashboard/doctors', icon: UserPlus, roles: ['ADMIN'] },
  { label: 'Blockchain', path: '/dashboard/blockchain', icon: Activity, roles: ['ADMIN'] },
  { label: 'Audit Logs', path: '/dashboard/audit', icon: Shield, roles: ['ADMIN'] },
  { label: 'System Status', path: '/dashboard/system', icon: Settings, roles: ['ADMIN'] },
  
  // Patient
  { label: 'Dashboard', path: '/patient', icon: LayoutDashboard, roles: ['PATIENT'] },
  { label: 'My Records', path: '/patient/records', icon: FileText, roles: ['PATIENT'] },
  { label: 'Upload Record', path: '/patient/upload', icon: FolderOpen, roles: ['PATIENT'] },
  { label: 'Access Requests', path: '/patient/requests', icon: ClipboardList, roles: ['PATIENT'] },
  { label: 'Granted Access', path: '/patient/granted', icon: Shield, roles: ['PATIENT'] },
  { label: 'Audit Log', path: '/patient/audit', icon: History, roles: ['PATIENT'] },
  { label: 'Profile', path: '/patient/profile', icon: User, roles: ['PATIENT'] },
  
  // Doctor
  { label: 'Dashboard', path: '/doctor', icon: LayoutDashboard, roles: ['DOCTOR'] },
  { label: 'Search Patients', path: '/doctor/search', icon: Search, roles: ['DOCTOR'] },
  { label: 'Access Requests', path: '/doctor/requests', icon: ClipboardList, roles: ['DOCTOR'] },
  { label: 'Authorized Records', path: '/doctor/authorized', icon: FolderOpen, roles: ['DOCTOR'] },
  { label: 'Audit Log', path: '/doctor/audit', icon: History, roles: ['DOCTOR'] },
  { label: 'Profile', path: '/doctor/profile', icon: User, roles: ['DOCTOR'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { state: walletState, connect } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Activity size={20} />
          </div>
          <span className="sidebar-title">Healthcare Blockchain</span>
        </div>
        
        <nav className="sidebar-nav">
          {filteredNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="nav-item-icon" size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut className="nav-item-icon" size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="page-title">
              {filteredNavItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          
          <div className="header-right">
            {/* Network Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: 'var(--radius-md)', background: walletState.isCorrectNetwork ? 'var(--color-success-light)' : 'var(--color-warning-light)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: walletState.isCorrectNetwork ? 'var(--color-success)' : 'var(--color-warning)' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: walletState.isCorrectNetwork ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {walletState.isCorrectNetwork ? 'Connected' : 'Wrong Network'}
              </span>
            </div>

            {/* User Menu */}
            <div className="user-menu">
              <div className="user-avatar">
                {user ? getInitials(user.name) : '?'}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <span className="user-role">{user?.role?.toLowerCase() || ''}</span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <ChevronDown size={16} />
              </button>
            </div>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="modal-overlay" onClick={() => setUserMenuOpen(false)}>
                <div className="modal" style={{ width: '200px', maxWidth: 'none' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-body" style={{ padding: '8px' }}>
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 600 }}>{user?.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {walletState.address ? `${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}` : 'Not connected'}
                      </div>
                      {walletState.balance && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          Balance: {parseFloat(walletState.balance).toFixed(4)} ETH
                        </div>
                      )}
                    </div>
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px' }} onClick={handleLogout}>
                      <LogOut className="nav-item-icon" size={18} />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}