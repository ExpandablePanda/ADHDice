import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';
import { getLocalDateKey } from './TasksContext';
import { supabase } from './supabase';

const RoutinesContext = createContext();

export function getRoutineProgress(routine, tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getLocalDateKey(today);

  const routineTasks = routine.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  if (!routineTasks.length) return { done: 0, total: 0, pct: 0 };

  const done = routineTasks.filter(t => {
    const s = t.statusHistory?.[todayKey] || t.status;
    return s === 'done' || s === 'did_my_best';
  }).length;

  return {
    done,
    total: routineTasks.length,
    pct: Math.round((done / routineTasks.length) * 100),
  };
}

export function getRoutineStreak(routine, tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threshold = routine.streakThreshold ?? 75;

  const routineTasks = routine.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  if (!routineTasks.length) return { streak: 0, perfectStreak: 0 };

  let streak = 0;
  let perfectStreak = 0;
  let perfectBroken = false;

  for (let i = 0; i <= 730; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getLocalDateKey(d);

    const doneTasks = routineTasks.filter(t => {
      const s = i === 0
        ? (t.statusHistory?.[key] || t.status)
        : t.statusHistory?.[key];
      return s === 'done' || s === 'did_my_best';
    }).length;

    const pct = (doneTasks / routineTasks.length) * 100;

    if (pct >= threshold) {
      streak++;
      if (pct === 100 && !perfectBroken) perfectStreak++;
      else perfectBroken = true;
    } else if (i === 0) {
      continue; // today not done yet — check yesterday
    } else {
      break;
    }
  }

  return { streak, perfectStreak };
}

export function RoutinesProvider({ children }) {
  const { storagePrefix, user } = useProfile();
  const [routines, setRoutines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const lastLocalChangeRef = useRef(0);

  // Initial load: local then cloud
  useEffect(() => {
    async function load() {
      const stored = await AsyncStorage.getItem(`${storagePrefix}routines`);
      if (stored) setRoutines(JSON.parse(stored));

      if (user) {
        try {
          const { data } = await supabase
            .from('user_routines')
            .select('data')
            .eq('user_id', user.id)
            .single();
          if (data?.data && Array.isArray(data.data)) {
            isRemoteUpdateRef.current = true;
            setRoutines(data.data);
          }
        } catch (e) {
          console.log('Routines cloud sync skipped', e);
        }
      }
      setLoaded(true);
    }
    load();
  }, [storagePrefix, user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`rt:user_routines:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_routines', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new?.data) {
            const remoteTime = new Date(payload.new.updated_at).getTime();
            if (remoteTime > lastLocalChangeRef.current + 1000) {
              isRemoteUpdateRef.current = true;
              setRoutines(Array.isArray(payload.new.data) ? payload.new.data : []);
            }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Debounced save to local + cloud
  useEffect(() => {
    if (!loaded) return;
    if (isRemoteUpdateRef.current) { isRemoteUpdateRef.current = false; return; }

    lastLocalChangeRef.current = Date.now();
    const snapshot = routines;

    const saveData = async () => {
      await AsyncStorage.setItem(`${storagePrefix}routines`, JSON.stringify(snapshot));
      if (user) {
        try {
          await supabase.from('user_routines').upsert(
            { user_id: user.id, data: snapshot, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        } catch (e) {
          console.error('Routines cloud save failed', e);
        }
      }
    };

    const id = setTimeout(saveData, 1500);
    const handleUnload = () => saveData();
    if (Platform.OS === 'web') window.addEventListener('pagehide', handleUnload);
    return () => {
      clearTimeout(id);
      if (Platform.OS === 'web') window.removeEventListener('pagehide', handleUnload);
    };
  }, [routines, loaded, user, storagePrefix]);

  const save = useCallback((updated) => setRoutines(updated), []);

  const addRoutine = useCallback((fields) => {
    const newRoutine = {
      id: String(Date.now()),
      name: fields.name || 'New Routine',
      icon: fields.icon || '🎯',
      color: fields.color || '#6366f1',
      taskIds: [],
      streakThreshold: fields.streakThreshold ?? 75,
    };
    setRoutines(prev => [...prev, newRoutine]);
    return newRoutine;
  }, []);

  const updateRoutine = useCallback((id, changes) => {
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  }, []);

  const deleteRoutine = useCallback((id) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <RoutinesContext.Provider value={{ routines, addRoutine, updateRoutine, deleteRoutine }}>
      {children}
    </RoutinesContext.Provider>
  );
}

export function useRoutines() {
  return useContext(RoutinesContext);
}
