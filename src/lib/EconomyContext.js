import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';
import { supabase } from './supabase';

const EconomyContext = createContext();

const INITIAL_ECONOMY = {
  level: 1,
  xp: 0,
  xpReq: 100,
  points: 0,
  freeRolls: 0,
  activeStreak: 0,
  missedStreak: 0,
};

export function EconomyProvider({ children }) {
  const { storagePrefix, user } = useProfile();
  const [economy, setEconomy] = useState(INITIAL_ECONOMY);
  const [loaded, setLoaded] = useState(false);

  // 1. Initial Load (Local + Cloud)
  useEffect(() => {
    async function loadData() {
      // Local first
      const stored = await AsyncStorage.getItem(`${storagePrefix}economy`);
      if (stored) {
        try { setEconomy(JSON.parse(stored)); } catch (e) {}
      }

      // Cloud sync
      if (user) {
        try {
          const { data } = await supabase
            .from('user_economy')
            .select('data')
            .eq('user_id', user.id)
            .single();

          if (data && data.data) {
            setEconomy(data.data);
          }
        } catch (e) {
          console.log('Economy cloud fetch failed', e);
        }
      }
      setLoaded(true);
    }
    loadData();
  }, [storagePrefix, user]);

  // NEW: 1b. Real-time Subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`rt:user_economy:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_economy', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            setEconomy(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // 2. Save Data (Local + Cloud)
  useEffect(() => {
    if (!loaded || !user) return;

    const saveData = async () => {
      // Save local
      await AsyncStorage.setItem(`${storagePrefix}economy`, JSON.stringify(economy));

      // Save to Cloud
      try {
        await supabase
          .from('user_economy')
          .upsert({ user_id: user.id, data: economy, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('Economy cloud save failed', e);
      }
    };

    const timeoutId = setTimeout(saveData, 2000);
    return () => clearTimeout(timeoutId);
  }, [economy, loaded, user, storagePrefix]);

  const addReward = (gainedPoints, gainedXp) => {
    setEconomy(prev => {
      let newXp = prev.xp + gainedXp;
      let newLevel = prev.level;
      let newReq = prev.xpReq;
      let newRolls = prev.freeRolls;

      while (newXp >= newReq) {
        newXp -= newReq;
        newLevel++;
        newRolls++;
        newReq = Math.floor(newReq * 1.5); // Next level requires 50% more XP
      }

      return {
        ...prev,
        points: prev.points + gainedPoints,
        xp: newXp,
        level: newLevel,
        xpReq: newReq,
        freeRolls: newRolls,
      };
    });
  };

  const removeReward = (lostPoints, lostXp) => {
    setEconomy(prev => {
      let newXp = prev.xp - lostXp;
      let newPoints = prev.points - lostPoints;
      let newLevel = prev.level;
      let newReq = prev.xpReq;
      let newRolls = prev.freeRolls;
      
      // Basic de-leveling. It's complex to know the exact previous requirements if multiple levels are lost,
      // but assuming they only lost 1-2 levels, we can reverse the 1.5x math roughly:
      while (newXp < 0 && newLevel > 1) {
        newLevel--;
        newRolls = Math.max(0, newRolls - 1);
        newReq = Math.ceil(newReq / 1.5);
        newXp += newReq;
      }
      
      if (newXp < 0) newXp = 0;
      if (newPoints < 0) newPoints = 0;

      return {
        ...prev,
        points: newPoints,
        xp: newXp,
        level: newLevel,
        xpReq: newReq,
        freeRolls: newRolls,
      };
    });
  };

  const spendPoints = (cost) => {
    if (economy.freeRolls > 0) {
      setEconomy(prev => ({ ...prev, freeRolls: prev.freeRolls - 1 }));
      return true;
    }
    if (economy.points >= cost) {
      setEconomy(prev => ({ ...prev, points: prev.points - cost }));
      return true;
    }
    return false;
  };

  const resetEconomy = () => {
    setEconomy(INITIAL_ECONOMY);
  };

  const cheatEconomy = () => {
    setEconomy(prev => ({
      ...prev,
      points: prev.points + 1000,
      freeRolls: prev.freeRolls + 10,
    }));
  };

  const incrementActiveStreak = () => {
    setEconomy(prev => ({ ...prev, activeStreak: (prev.activeStreak || 0) + 1, missedStreak: 0 }));
  };

  const incrementMissedStreak = () => {
    setEconomy(prev => ({ ...prev, missedStreak: (prev.missedStreak || 0) + 1, activeStreak: 0 }));
  };

  const addFreeRoll = (amount = 1) => {
    setEconomy(prev => ({ ...prev, freeRolls: prev.freeRolls + amount }));
  };

  if (!loaded) return null;

  return (
    <EconomyContext.Provider value={{ economy, addReward, spendPoints, removeReward, resetEconomy, cheatEconomy, incrementActiveStreak, incrementMissedStreak, addFreeRoll }}>
      {children}
    </EconomyContext.Provider>
  );
}

export function useEconomy() {
  const context = useContext(EconomyContext);
  if (!context) throw new Error('useEconomy must be used within EconomyProvider');
  return context;
}
