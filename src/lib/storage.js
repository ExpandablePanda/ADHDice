import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'adhddice_state';

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore write errors
  }
}
