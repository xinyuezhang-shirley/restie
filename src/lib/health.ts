/**
 * Is Rusty's AI actually reachable on this device, and if not, why?
 * Every AI call reports here; Settings shows it ("Rusty's AI") and the chat
 * marks replies that came from his offline words. Without this, a failed
 * sign-in looked exactly like a "dumb" Rusty, with nothing saying why.
 */
import { create } from 'zustand';

export type AiHealth =
  | { state: 'unknown' }
  | { state: 'ok'; at: number }
  | { state: 'offline'; at: number; reason: string };

export const useAiHealth = create<{ health: AiHealth }>(() => ({ health: { state: 'unknown' } }));

export function reportAi(ok: true): void;
export function reportAi(ok: false, reason: string): void;
export function reportAi(ok: boolean, reason?: string) {
  useAiHealth.setState({ health: ok ? { state: 'ok', at: Date.now() } : { state: 'offline', at: Date.now(), reason: reason ?? 'unknown' } });
}

/** A plain-words reason from whatever went wrong. */
export function reasonOf(e: unknown): string {
  const ctx = (e as { context?: { status?: number } })?.context;
  const status = ctx?.status;
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'timeout') return 'it took too long to answer (slow connection?)';
  if (status === 401) return 'this device isn’t signed in to Rusty’s server';
  if (status === 429) return 'Rusty’s brain is busy (rate limit); try again in a minute';
  if (status === 500 && /key/i.test(msg)) return 'the server’s AI key is missing or invalid';
  if (status) return `the server answered with an error (${status})`;
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'couldn’t reach the server (offline, or blocked by a browser extension or network filter)';
  return msg.slice(0, 120);
}
