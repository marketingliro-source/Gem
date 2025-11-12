import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { Home, Users, Calendar, LogOut, Menu, X, Settings, UserCheck, BarChart2, ChevronDown, ChevronRight, Database, List } from 'lucide-react';
import styles from './Layout.module.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: BarChart2, label: 'Dashboard', roles: ['admin', 'agent'], color: '#3b82f6' },
    { path: '/clients', icon: UserCheck, label: 'Clients', roles: ['admin', 'agent'], color: '#10b981' },
    { path: '/leads', icon: List, label: 'Leads', roles: ['admin', 'agent'], color: '#f59e0b' },
    { path: '/calendar', icon: Calendar, label: 'Agenda', roles: ['admin', 'agent'], color: '#8b5cf6' },
  ];

  const settingsItems = [
    { path: '/settings/users', icon: Users, label: 'Utilisateurs', color: '#06b6d4' },
    { path: '/settings/dimensioning', icon: Database, label: 'Dimensionnement', color: '#ec4899' },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  // Auto-open settings if on a settings route
  React.useEffect(() => {
    if (location.pathname.startsWith('/settings')) {
      setSettingsOpen(true);
    }
  }, [location.pathname]);

  return (
    <div className={styles.container}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>
        <div className={styles.sidebarHeader}>
          <Logo size={sidebarOpen ? 30 : 40} collapsed={!sidebarOpen} />
          {!sidebarOpen && (
            <button
              className={styles.toggleBtn}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ marginTop: '8px' }}
            >
              <Menu size={24} />
            </button>
          )}
          {sidebarOpen && (
            <button
              className={styles.toggleBtn}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <X size={22} />
            </button>
          )}
        </div>

        <nav className={styles.nav}>
          {/* Regular nav items */}
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={item.label}
              >
                <Icon size={sidebarOpen ? 20 : 56} style={{ color: isActive ? 'white' : item.color }} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Settings dropdown (admin only) */}
          {user?.role === 'admin' && (
            <div className={styles.settingsSection}>
              <button
                className={`${styles.navItem} ${styles.settingsToggle} ${location.pathname.startsWith('/settings') ? styles.active : ''}`}
                onClick={() => setSettingsOpen(!settingsOpen)}
                title="Paramètres"
              >
                <Settings size={sidebarOpen ? 20 : 56} style={{ color: location.pathname.startsWith('/settings') ? 'white' : '#64748b' }} />
                {sidebarOpen && (
                  <>
                    <span>Paramètres</span>
                    {settingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </>
                )}
              </button>

              {/* Submenu */}
              {settingsOpen && sidebarOpen && (
                <div className={styles.submenu}>
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`${styles.submenuItem} ${isActive ? styles.active : ''}`}
                        title={item.label}
                      >
                        <Icon size={18} style={{ color: isActive ? '#10b981' : item.color }} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className={styles.userDetails}>
                <div className={styles.username}>{user?.username}</div>
                <div className={styles.role}>
                  {user?.role === 'admin' ? 'Administrateur' : 'Agent'}
                </div>
              </div>
            )}
          </div>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Déconnexion"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
