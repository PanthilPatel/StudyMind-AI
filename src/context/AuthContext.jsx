/**
 * Authentication Context
 * 
 * Provides app-wide authentication state and user profile management.
 * Wraps Supabase auth with React context for easy access in any component.
 * 
 * Features:
 * - Auto session restoration on load
 * - Auth state change listener
 * - User profile with plan info
 * - Sign out helper
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Fetch or create user profile from 'profiles' table
  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — create one
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, plan: 'free' })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return null;
        }
        return newProfile;
      }

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return null;
    }
  }

  useEffect(() => {
    // Skip if Supabase isn't configured
    if (!isSupabaseConfigured) return;

    // Emergency safety net: force loading=false if it hangs after 3 seconds
    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
      console.warn('AuthContext loading timeout hit — speed optimization triggered.');
    }, 3000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // OPTIMIZATION: Show the UI as soon as we know the user is there.
      // Profile (Pro plan info) will load in the background.
      setLoading(false); 

      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
    }).catch((err) => {
      console.error('Session error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fire and forget profile fetch
          fetchProfile(session.user.id).then(setProfile);
        } else {
          setProfile(null);
        }
        
        // Immediate UI update
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Sign out helper
  async function signOut() {
    try {
      if (isSupabaseConfigured) {
        // Don't wait for the network to clear local state
        supabase.auth.signOut().catch(err => console.error('Sign out error:', err));
      }
    } catch (err) {
      console.error('Sign out catch:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  }

  // Refresh profile (after plan upgrade, etc.)
  async function refreshProfile() {
    if (user && isSupabaseConfigured) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }

  // Skip Login (Offline Mode) helper
  function skipLogin() {
    const mockUser = { id: 'mock-user-123', email: 'guest@studymind.ai' };
    const mockProfile = { id: 'mock-user-123', plan: 'free' };
    setUser(mockUser);
    setSession({ user: mockUser });
    setProfile(mockProfile);
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

/**
 * Hook to access auth context
 * @returns {{ user, session, profile, loading, signOut, refreshProfile, isPro }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
