import React from 'react';
import logoImg from '../assets/logo.webp';

const Logo = ({ size = 40, collapsed = false }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }}>
      <img
        src={logoImg}
        alt="France Eco Energie Logo"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
        }}
      />
      {!collapsed && (
        <span style={{
          fontSize: size * 0.43,
          fontWeight: '700',
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.8px',
          whiteSpace: 'nowrap'
        }}>
          FRANCE ÉCOÉNERGIE
        </span>
      )}
    </div>
  );
};

export default Logo;
