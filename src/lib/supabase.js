import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://mnwcuinnshsncqrhvsks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ud2N1aW5uc2hzbmNxcmh2c2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzgzMDksImV4cCI6MjA5MTE1NDMwOX0.ClXCeiKk1HeZB8PLdV1FNPcteEvgq5vpXjgZ0fXl284',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
