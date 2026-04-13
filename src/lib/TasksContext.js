import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';

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
  { id: '2', title: 'Read for 20 minutes', status: 'upcoming', energy: 'low',  dueDate: '', nextDueDate: '', tags: [],       subtasks: [] },
  { id: '3', title: 'Reply to emails',     status: 'pending',  energy: 'medium', dueDate: '04/14/2026', nextDueDate: '', tags: ['work'], subtasks: [] },
  { id: '4', title: 'Grocery run',         status: 'done',     energy: null,   dueDate: '', nextDueDate: '', tags: ['errands'], subtasks: [] },
];

const TasksContext = createContext();

export function TasksProvider({ children }) {
  const { storagePrefix } = useProfile();
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [taskHistory, setTaskHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(`${storagePrefix}tasks`),
      AsyncStorage.getItem(`${storagePrefix}task_history`)
    ]).then(([storedTasks, storedHistory]) => {
      if (storedTasks) {
        try { setTasks(JSON.parse(storedTasks)); } catch(e) {}
      }
      if (storedHistory) {
        try { setTaskHistory(JSON.parse(storedHistory)); } catch(e) {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(`${storagePrefix}tasks`, JSON.stringify(tasks)).catch(e => console.error(e));
      AsyncStorage.setItem(`${storagePrefix}task_history`, JSON.stringify(taskHistory)).catch(e => console.error(e));
    }
  }, [tasks, taskHistory, loaded, storagePrefix]);

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
