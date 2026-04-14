/**
 * Authentication Context (Stability Version)
 * 
 * Provides app-wide authentication state and user profile management.
 * 
 * STABILITY FIXES:
 * 1. Safe Auth Listener: Added try/catch and null-protection for subscription.
 * 2. Fail-Safe Loading: Ensures loading=false even if Supabase is down.
 * 3. Configuration Awareness: Respects isSupabaseConfigured flag strictly.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Fetch or create user profile with error isolation
  async function fetchProfile(userId) {
    if (!isSupabaseConfigured || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, plan: 'free' })
          .select()
          .single();
        return insertError ? null : newProfile;
      }
      return error ? null : data;
    } catch (err) {
      console.error('[AuthContext] Profile fetch error:', err);
      return null;
    }
  }

  useEffect(() => {
    // If not configured, immediately stop loading
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let subscriptionRef = null;

    // Safety timeout to prevent infinite blank screen
    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
    }, 4000);

    async function initAuth() {
      try {
        // 1. Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          const p = await fetchProfile(initialSession.user.id);
          setProfile(p);
        }

        // 2. Set up listener
        const { data: { subscription }, error: subError } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            
            if (currentSession?.user) {
              const p = await fetchProfile(currentSession.user.id);
              setProfile(p);
            } else {
              setProfile(null);
            }
            setLoading(false);
          }
        );

        if (subError) throw subError;
        subscriptionRef = subscription;

      } catch (err) {
        console.error('[AuthContext] Auth initialization failed:', err);
      } finally {
        setLoading(false);
        clearTimeout(fallbackTimeout);
      }
    }

    initAuth();

    return () => {
      clearTimeout(fallbackTimeout);
      if (subscriptionRef) {
        try {
          subscriptionRef.unsubscribe();
        } catch {}
      }
    };
  }, []);

  async function signOut() {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user && isSupabaseConfigured) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  }

  function skipLogin() {
    const mockUser = { id: 'mock-user-123', email: 'guest@studymind.ai' };
    setUser(mockUser);
    setSession({ user: mockUser });
    setProfile({ id: 'mock-user-123', plan: 'free' });
    setLoading(false);
  }

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
    skipLogin,
    isPro: profile?.plan === 'pro',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
