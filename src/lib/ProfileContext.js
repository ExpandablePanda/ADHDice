import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfileContext = createContext();

const PROFILES = [
  { id: 'andrew', name: 'Andrew', icon: '🎯', color: '#6366f1', desc: 'Main profile' },
  { id: 'test', name: 'Test Lab', icon: '🧪', color: '#f59e0b', desc: 'Feature testing' },
];

export function ProfileProvider({ children }) {
  const [activeProfile, setActiveProfile] = useState(null); // null = landing screen
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@ADHD_active_profile').then(stored => {
      // Don't auto-select — always show chooser on app launch
      setLoaded(true);
    });
  }, []);

  const selectProfile = (profileId) => {
    setActiveProfile(profileId);
    AsyncStorage.setItem('@ADHD_active_profile', profileId);
  };

  const clearProfile = () => {
    setActiveProfile(null);
  };

  // Storage key prefix based on active profile
  const storagePrefix = activeProfile ? `@ADHD_${activeProfile}_` : '@ADHD_';

  if (!loaded) return null;

  return (
    <ProfileContext.Provider value={{ activeProfile, selectProfile, clearProfile, profiles: PROFILES, storagePrefix }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}

export { PROFILES };
