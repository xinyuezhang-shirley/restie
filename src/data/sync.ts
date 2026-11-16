/**
 * Supabase sync: push the outbox, pull what changed, upload photos.
 *
 * Conflict rule: last write wins per row (compare updated_at). That's enough
 * for one person on one or two devices, which is Restie's use case.
 */
import { File } from 'expo-file-system';
import { AppState, Platform } from 'react-native';

import { ensureSession, supabase } from '@/lib/supabase';

import { setDirtyListener, useStore, type OutboxItem } from './store';
import { TABLES, type Profile, type TableName } from './types';

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(entity: object, userId: string) {
  const row: Record<string, unknown> = { user_id: userId };
  // Skip undefined so column defaults apply (e.g. tasks.timed NOT NULL).
  for (const [k, v] of Object.entries(entity)) if (v !== undefined) row[snake(k)] = v;
  return row;
}

function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue;
    out[camel(k)] = v;
  }
  return out as T;
}

let flushTimer: ReturnType<typeof setTimeout> | undefined;
let busy = false;

export function scheduleFlush(delay = 800) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

async function uploadPendingPhotos(userId: string) {
  if (!supabase) return;
  const { keepsakes, photoCache } = useStore.getState();
  for (const [id, uri] of Object.entries(photoCache)) {
    const k = keepsakes[id];
    if (!k || k.deletedAt || k.photoPath) continue;
    try {
      const path = `${userId}/${id}.jpg`;
      const body =
        Platform.OS === 'web'
          ? await (await fetch(uri)).blob()
          : await new File(uri).arrayBuffer();
      const { error } = await supabase.storage
        .from('keepsakes')
        .upload(path, body, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      useStore.setState((s) => ({
        keepsakes: { ...s.keepsakes, [id]: { ...s.keepsakes[id], photoPath: path, updatedAt: new Date().toISOString() } },
        outbox: [...s.outbox, { table: 'keepsakes', id }],
      }));
    } catch (e) {
      console.warn('[restie] photo upload failed', e);
    }
  }
}

export async function flush() {
  if (!supabase || busy) return;
  const userId = useStore.getState().userId;
  if (!userId) return;
  busy = true;
  useStore.setState({ syncStatus: 'syncing' });
  try {
    await uploadPendingPhotos(userId);
    const state = useStore.getState();
    const batch: OutboxItem[] = state.outbox;
    if (batch.length === 0) {
      useStore.setState({ syncStatus: 'synced' });
      return;
    }
    const byTable = new Map<string, string[]>();
    for (const o of batch) byTable.set(o.table, [...(byTable.get(o.table) ?? []), o.id]);

    for (const [table, ids] of byTable) {
      if (table === 'profiles') {
        const p = state.profile;
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          name: p.name,
          onboarded_at: p.onboardedAt ?? null,
          tutorial_done_at: p.tutorialDoneAt ?? null,
          settings: p.settings,
          mind: p.mind,
          updated_at: p.updatedAt,
        });
        if (error) throw error;
        continue;
      }
      const rows = ids
        .map((id) => state[table as TableName][id])
        .filter(Boolean)
        .map((e) => toRow(e, userId));
      if (rows.length === 0) continue;
      // A batch mixes rows with different fields (e.g. steps with and without
      // substeps). Missing fields must take the column default, not null, or
      // NOT NULL columns reject the whole batch.
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', defaultToNull: false });
      if (error) throw error;
    }
    // Remove only what we sent; writes made meanwhile stay queued.
    useStore.setState((s) => ({
      outbox: s.outbox.filter((o) => !batch.some((b) => b.table === o.table && b.id === o.id)),
      syncStatus: 'synced',
    }));
  } catch (e) {
    console.warn('[restie] sync push failed', e);
    useStore.setState({ syncStatus: 'offline' });
  } finally {
    busy = false;
  }
}

export async function pull() {
  if (!supabase) return;
  const { userId, lastPulledAt } = useStore.getState();
  if (!userId) return;
  const started = new Date().toISOString();
  try {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (prof) {
      const remote = fromRow<Profile & { onboardedAt: string }>(prof);
      const local = useStore.getState().profile;
      if (!local.updatedAt || remote.updatedAt > local.updatedAt) {
        useStore.setState({ profile: { ...local, ...remote, id: userId } });
      }
    }
    for (const table of TABLES) {
      let q = supabase.from(table).select('*');
      if (lastPulledAt) q = q.gt('updated_at', lastPulledAt);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) continue;
      useStore.setState((s) => {
        const next = { ...s[table] } as Record<string, { updatedAt: string }>;
        for (const r of data) {
          const remote = fromRow<{ id: string; updatedAt: string }>(r);
          const local = next[remote.id];
          if (!local || remote.updatedAt > local.updatedAt) next[remote.id] = remote;
        }
        return { [table]: next } as never;
      });
    }
    useStore.setState({ lastPulledAt: started, syncStatus: 'synced' });
  } catch (e) {
    console.warn('[restie] sync pull failed', e);
    useStore.setState({ syncStatus: 'offline' });
  }
}

/** Call once after the store has hydrated. Safe without Supabase. */
export async function startSync() {
  setDirtyListener(() => scheduleFlush());
  if (!supabase) {
    useStore.setState({ syncStatus: 'local' });
    return;
  }
  const userId = await ensureSession();
  if (!userId) {
    useStore.setState({ syncStatus: 'offline' });
    return;
  }
  const prev = useStore.getState().userId;
  if (prev !== userId) {
    // New account on this device: push everything we have locally.
    const s = useStore.getState();
    const all: OutboxItem[] = [{ table: 'profiles', id: 'me' }];
    for (const t of TABLES) for (const id of Object.keys(s[t])) all.push({ table: t, id });
    useStore.setState({ userId, outbox: all, lastPulledAt: null });
  }
  await pull();
  await flush();
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void pull().then(flush);
  });
  setInterval(() => void flush(), 60_000);
}

/**
 * Delete this person's rows on the server (Settings → Start over / Load demo).
 * Without this, the next pull would bring the old data back.
 */
export async function wipeRemote() {
  const userId = useStore.getState().userId;
  if (!supabase || !userId) return;
  for (const table of TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) console.warn('[restie] wipe failed for', table, error.message);
  }
  await supabase.from('profiles').delete().eq('id', userId);
}

/* ---------------------------------------------------------------- photos */

const signed = new Map<string, { url: string; at: number }>();

/** Local uri if this device took the photo, else a signed Storage URL. */
export async function photoUrl(keepsakeId: string, photoPath?: string | null): Promise<string | null> {
  const local = useStore.getState().photoCache[keepsakeId];
  if (local) return local;
  if (!photoPath || !supabase) return null;
  const hit = signed.get(photoPath);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  const { data } = await supabase.storage.from('keepsakes').createSignedUrl(photoPath, 3600);
  if (!data?.signedUrl) return null;
  signed.set(photoPath, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}
