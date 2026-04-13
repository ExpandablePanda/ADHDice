import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';
import { supabase } from './supabase';

const NotesContext = createContext();

export function NotesProvider({ children }) {
  const { storagePrefix, user } = useProfile();
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // 1. Initial Load (Local + Cloud)
  useEffect(() => {
    async function loadData() {
      // Local first
      const stored = await AsyncStorage.getItem(`${storagePrefix}notes`);
      if (stored) {
        try { setNotes(JSON.parse(stored)); } catch(e) {}
      }

      // Cloud sync
      if (user) {
        try {
          const { data } = await supabase
            .from('user_notes')
            .select('data')
            .eq('user_id', user.id)
            .single();

          if (data && data.data) {
            setNotes(data.data);
          }
        } catch (e) {
          console.log('Notes cloud fetch failed', e);
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
      .channel(`rt:user_notes:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            const cloudStr = JSON.stringify(payload.new.data);
            AsyncStorage.getItem(`${storagePrefix}notes`).then(localStr => {
              if (cloudStr !== localStr) setNotes(payload.new.data);
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, storagePrefix]);

  // 2. Save Data (Local + Cloud)
  useEffect(() => {
    if (!loaded || !user) return;

    const saveData = async () => {
      const notesStr = JSON.stringify(notes);
      // Save local
      await AsyncStorage.setItem(`${storagePrefix}notes`, notesStr);

      // Save to Cloud
      try {
        const { data: remote } = await supabase.from('user_notes').select('data').eq('user_id', user.id).single();
        if (remote && JSON.stringify(remote.data) === notesStr) return;

        await supabase
          .from('user_notes')
          .upsert({ user_id: user.id, data: notes, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('Notes cloud save failed', e);
      }
    };

    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [notes, loaded, user, storagePrefix]);

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
