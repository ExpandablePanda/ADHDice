import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check for active session on boot
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoaded(true);
    }).catch(async (error) => {
      console.error('Session loading failed:', error);
      // For specific critical auth errors, clear the session locally
      if (error?.message?.includes('Refresh Token Not Found') || error?.message?.includes('invalid_grant')) {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          // Ignore sign out errors if already unauthenticated
        }
      }
      setLoaded(true); 
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Keep compatibility with existing prefix-based storage for local backup
  const storagePrefix = user ? `@ADHD_${user.id}_` : '@ADHD_guest_';

  if (!loaded) return null;

  return (
    <ProfileContext.Provider value={{ 
      user, 
      login, 
      signUp, 
      logout, 
      storagePrefix,
      activeProfile: user ? user.email : null // existing code uses activeProfile as a truthy check
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}
