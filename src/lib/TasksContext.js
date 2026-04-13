import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';
import { supabase } from './supabase';

// Sample data for initial setup
const INITIAL_TASKS = [
  {
    id: '1', title: 'Morning workout', status: 'active',
    energy: 'high', dueDate: '04/13/2026', nextDueDate: '',
    tags: ['health'],
    subtasks: [
      { id: 's1', title: 'Stretch 5 min', done: false, subtasks: [] },
      { id: 's2', title: 'Run 2 miles', done: true, subtasks: [
        { id: 's2a', title: 'Warm up walk', done: true, subtasks: [] },
      ]},
    ],
  },
];

const TasksContext = createContext();

export function TasksProvider({ children }) {
  const { storagePrefix, user } = useProfile();
  const [tasks, setTasks] = useState([]);
  const [taskHistory, setTaskHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Initial Load (Local + Cloud)
  useEffect(() => {
    async function loadData() {
      // Local first
      const storedTasks = await AsyncStorage.getItem(`${storagePrefix}tasks`);
      const storedHistory = await AsyncStorage.getItem(`${storagePrefix}task_history`);
      
      if (storedTasks) setTasks(JSON.parse(storedTasks));
      if (storedHistory) setTaskHistory(JSON.parse(storedHistory));

      // Cloud sync
      if (user) {
        try {
          const { data } = await supabase
            .from('user_tasks')
            .select('data')
            .eq('user_id', user.id)
            .single();

          if (data && data.data) {
            setTasks(data.data);
          }
        } catch (e) {
          console.log('Tasks cloud sync fetch failed', e);
        }
      }
      
      setLoaded(true);
    }
    loadData();
  }, [storagePrefix, user]);

  // 1b. Real-time Subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`rt:user_tasks:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.data) {
            // Check if the new data is actually different from our current state
            // to avoid unnecessary re-renders or "bounce-back" saves
            const cloudDataStr = JSON.stringify(payload.new.data);
            AsyncStorage.getItem(`${storagePrefix}tasks`).then(localDataStr => {
              if (cloudDataStr !== localDataStr) {
                setTasks(payload.new.data);
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, storagePrefix]);

  // 2. Save Data (Local + Cloud)
  useEffect(() => {
    if (!loaded || !user) return;

    const saveData = async () => {
      const tasksStr = JSON.stringify(tasks);
      const historyStr = JSON.stringify(taskHistory);

      // Save local
      await AsyncStorage.setItem(`${storagePrefix}tasks`, tasksStr);
      await AsyncStorage.setItem(`${storagePrefix}task_history`, historyStr);

      // Check if we actually need to update the cloud 
      // (prevents loops if the change came from the cloud)
      try {
        const { data: remote } = await supabase
          .from('user_tasks')
          .select('data')
          .eq('user_id', user.id)
          .single();
        
        if (remote && JSON.stringify(remote.data) === tasksStr) {
          return; // Already in sync
        }

        setIsSyncing(true);
        await supabase
          .from('user_tasks')
          .upsert({ 
            user_id: user.id, 
            data: tasks,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('Tasks cloud save failed', e);
      } finally {
        setIsSyncing(false);
      }
    };

    const timeoutId = setTimeout(saveData, 1000); // Reduced to 1s for snappier feel
    return () => clearTimeout(timeoutId);
  }, [tasks, taskHistory, loaded, user, storagePrefix]);

  const logTaskEvent = (task, status) => {
    const event = {
      id: Date.now().toString(),
      taskId: task.id,
      title: task.title,
      status: status,
      energy: task.energy,
      tags: task.tags || [],
      timestamp: new Date().toISOString()
    };
    setTaskHistory(prev => [event, ...prev].slice(0, 1000)); // Keep last 1000 events
  };

  if (!loaded) return null;

  return (
    <TasksContext.Provider value={{ tasks, setTasks, taskHistory, logTaskEvent }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) throw new Error('useTasks must be used within TasksProvider');
  return context;
}
