import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';

const NotesContext = createContext();

export function NotesProvider({ children }) {
  const { storagePrefix } = useProfile();
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`${storagePrefix}notes`).then(stored => {
      if (stored) {
        try {
          setNotes(JSON.parse(stored));
        } catch(e) { console.error('Failed to parse notes', e); }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(`${storagePrefix}notes`, JSON.stringify(notes)).catch(e => console.error(e));
    }
  }, [notes, loaded, storagePrefix]);

  const addNote = (title, content, tags = []) => {
    const newNote = {
      id: Date.now().toString(),
      title,
      content,
      tags,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: '#ffffff'
    };
    setNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (!loaded) return null;

  return (
    <NotesContext.Provider value={{ notes, setNotes, addNote, updateNote, deleteNote }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error('useNotes must be used within NotesProvider');
  return context;
}
