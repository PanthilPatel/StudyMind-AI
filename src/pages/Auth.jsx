/**
 * Auth Page — Login & Signup
 * 
 * Handles email/password authentication via Supabase.
 * Toggles between login and signup modes.
 * Redirects to dashboard on successful auth.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, skipLogin } = useAuth();

  const [isSignup, setIsSignup] = useState(searchParams.get('mode') === 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  async function handleSocialLogin(provider) {
    if (!isSupabaseConfigured) {
      setError('Database is not connected. Connect Supabase to enable social login.');
      return;
    }

    setSocialLoading(provider);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || `Failed to sign in with ${provider}.`);
      setSocialLoading(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Check if Supabase is actually configured
    if (!isSupabaseConfigured) {
      setError('Database is not connected. You need to configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY constraints in your .env file first.');
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        // --- SIGN UP ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          setError('An account with this email already exists.');
        } else {
          setSuccess('Account created! Check your email to verify, then log in.');
          setIsSignup(false);
        }
      } else {
        // --- LOG IN ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Auth context listener will handle redirect via useEffect
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" id="auth-page">
      {/* Left panel — branding */}
      <div className="auth-brand-panel">
        <Link to="/" className="auth-brand-logo">
          <span className="logo-icon">✦</span>
          <span className="logo-text">StudyMind AI</span>
        </Link>
        <div className="auth-brand-content animate-in">
          <h2 className="auth-brand-title">
            Learn smarter.<br />Create faster.
          </h2>
          <p className="auth-brand-subtitle">
            Your AI-powered companion for studying, note-taking, content creation, and exam prep.
          </p>
          <div className="auth-brand-features">
            <div className="auth-brand-feature" style={{ animationDelay: '0.1s' }}>
              <span>💡</span> Topic Explainer
            </div>
            <div className="auth-brand-feature" style={{ animationDelay: '0.2s' }}>
              <span>📝</span> Notes Generator
            </div>
            <div className="auth-brand-feature" style={{ animationDelay: '0.3s' }}>
              <span>✍️</span> Content Writer
            </div>
            <div className="auth-brand-feature" style={{ animationDelay: '0.4s' }}>
              <span>🧠</span> MCQ Quiz Maker
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-form-panel">
        <div className="auth-form-container animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="auth-form-header">
            <h1 className="auth-form-title">
              {isSignup ? 'Create your account' : `${getGreeting()}, Welcome back`}
            </h1>
            <p className="auth-form-subtitle text-secondary">
              {isSignup
                ? 'Start your AI learning journey today'
                : 'Sign in to continue to your dashboard'}
            </p>
          </div>

          {/* Social Logins */}
          <div className="social-auth-grid">
            <button 
              className="social-btn" 
              type="button" 
              onClick={() => handleSocialLogin('google')}
              disabled={socialLoading !== null || loading}
            >
              {socialLoading === 'google' ? (
                <span className="spinner spinner-sm"></span>
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
              )}
              <span>{socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
            </button>
            <button 
              className="social-btn" 
              type="button" 
              onClick={() => handleSocialLogin('github')}
              disabled={socialLoading !== null || loading}
            >
              {socialLoading === 'github' ? (
                <span className="spinner spinner-sm"></span>
              ) : (
                <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style={{ filter: 'invert(1)' }} />
              )}
              <span>{socialLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          {/* Error / Success messages */}
          {error && (
            <div className="auth-message auth-error animate-shake" id="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="auth-message auth-success" id="auth-success">
              <span>✅</span> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" id="auth-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="password" className="form-label">Password</label>
                {!isSignup && <a href="#" className="forgot-password">Forgot password?</a>}
              </div>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit-btn"
              id="auth-submit-btn"
              disabled={loading}
            >
              {loading && <span className="spinner"></span>}
              {loading
                ? (isSignup ? 'Creating account...' : 'Signing in...')
                : (isSignup ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          {!isSupabaseConfigured && (
            <div className="auth-skip-section">
              <p className="text-secondary">
                Don't want to set up the database right now?
              </p>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={(e) => {
                  e.preventDefault();
                  skipLogin();
                  navigate('/dashboard');
                }}
              >
                Skip to Dashboard (Offline Mode)
              </button>
            </div>
          )}

          <div className="auth-toggle">
            <p className="text-secondary">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}
              <button
                className="auth-toggle-btn"
                id="auth-toggle-btn"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError('');
                  setSuccess('');
                }}
              >
                {isSignup ? 'Sign in' : 'Sign up free'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
