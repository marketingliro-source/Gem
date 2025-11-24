import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { Users, Calendar, LogOut, Menu, X, UserCheck, BarChart2, ChevronDown, ChevronRight, Fan, Wind, Layers, Search } from 'lucide-react';
import styles from './Layout.module.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clientsOpen, setClientsOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: BarChart2, label: 'Dashboard', roles: ['admin', 'telepro'], color: '#059669' },
    { path: '/calendar', icon: Calendar, label: 'Agenda', roles: ['admin', 'telepro'], color: '#8b5cf6' },
    { path: '/prospection', icon: Search, label: 'Prospection', roles: ['admin', 'telepro'], color: '#3b82f6' },
  ];

  const clientsItems = [
    { path: '/clients/destratification', icon: Fan, label: 'Destratification', color: '#10b981', produit: 'destratification' },
    { path: '/clients/pression', icon: Wind, label: 'Pression', color: '#8b5cf6', produit: 'pression' },
    { path: '/clients/matelas_isolants', icon: Layers, label: 'Matelas Isolants', color: '#f59e0b', produit: 'matelas_isolants' },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  // Auto-open clients if on a clients route
  React.useEffect(() => {
    if (location.pathname.startsWith('/clients')) {
      setClientsOpen(true);
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

          {/* Clients dropdown */}
          <div className={styles.settingsSection}>
            <button
              className={`${styles.navItem} ${styles.settingsToggle} ${location.pathname.startsWith('/clients') ? styles.active : ''}`}
              onClick={() => setClientsOpen(!clientsOpen)}
              title="Clients"
            >
              <UserCheck size={sidebarOpen ? 20 : 56} style={{ color: location.pathname.startsWith('/clients') ? 'white' : '#10b981' }} />
              {sidebarOpen && (
                <>
                  <span>Clients</span>
                  {clientsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </>
              )}
            </button>

            {/* Submenu */}
            {clientsOpen && sidebarOpen && (
              <div className={styles.submenu}>
                {clientsItems.map((item) => {
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

          {/* Users (admin only) */}
          {user?.role === 'admin' && (
            <Link
              to="/users"
              className={`${styles.navItem} ${location.pathname === '/users' ? styles.active : ''}`}
              title="Utilisateurs"
            >
              <Users size={sidebarOpen ? 20 : 56} style={{ color: location.pathname === '/users' ? 'white' : '#06b6d4' }} />
              {sidebarOpen && <span>Utilisateurs</span>}
            </Link>
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
                  {user?.role === 'admin' ? 'Administrateur' : 'Téléprospecteur'}
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
