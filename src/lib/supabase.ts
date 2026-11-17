import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { storage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null when Supabase isn't configured: the app then runs fully on-device
 * (everything still works, nothing syncs, Rusty uses his offline replies).
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Restie has no login screen: each device signs in anonymously, which gives
 * it a stable user id so Row Level Security keeps every person's data
 * private. (Enable "Anonymous sign-ins" in Supabase → Authentication.)
 */
let lastAuthError: string | null = null;
/** Why the last sign-in failed (shown in Settings → Rusty's AI). */
export const authError = () => lastAuthError;

let signingIn: Promise<string | null> | null = null;

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  // one sign-in at a time (startup and an AI call can both ask)
  signingIn ??= (async () => {
    try {
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error) {
        lastAuthError = /rate limit/i.test(error.message)
          ? 'too many sign-ins from this network in the last hour (Supabase limit); try again later'
          : `sign-in failed: ${error.message}`;
        console.warn('[restie] anonymous sign-in failed:', error.message);
        return null;
      }
      lastAuthError = null;
      return signed.user?.id ?? null;
    } catch (e) {
      lastAuthError = `couldn’t reach the sign-in server (${e instanceof Error ? e.message : String(e)})`;
      return null;
    } finally {
      signingIn = null;
    }
  })();
  return signingIn;
}
