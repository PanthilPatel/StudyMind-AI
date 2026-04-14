/**
 * Navbar Component
 * 
 * Responsive navigation bar used on the landing page.
 * Shows login/signup buttons for unauthenticated users,
 * dashboard link for authenticated users.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <nav className="navbar" id="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo" id="navbar-logo">
          <span className="logo-icon">✦</span>
          <span className="logo-text">StudyMind AI</span>
        </Link>

        <button 
          className="navbar-toggle" 
          id="navbar-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        <div className={`navbar-actions ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            <div className={`theme-toggle-pill ${theme}`}>
              <span className="theme-icon">
                {theme === 'dark' ? '☀️' : '🌙'}
              </span>
            </div>
          </div>

          {user ? (
            <>
              <button 
                onClick={handleSignOut} 
                className="btn btn-ghost" 
                id="navbar-logout-btn"
              >
                Sign Out
              </button>
              <Link to="/dashboard" className="btn btn-primary" id="navbar-dashboard-btn">
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="btn btn-ghost" id="navbar-login-btn">
                Login
              </Link>
              <Link to="/auth?mode=signup" className="btn btn-primary" id="navbar-get-started-btn">
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
