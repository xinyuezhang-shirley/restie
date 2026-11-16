// Gives React Native a synchronous `localStorage` backed by SQLite.
// Used by the Supabase session and by the zustand store's offline cache.
import 'expo-sqlite/localStorage/install';

export const storage = globalThis.localStorage;
