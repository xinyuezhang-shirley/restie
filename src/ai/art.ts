/**
 * Rusty's drawings (the `rusty-art` Edge Function): a picture for a hobby
 * that isn't in the built-in set, or an illustration for a keepsake.
 *
 * The server plans, draws (OpenAI image model, with the app's art as style
 * references), checks (pixels + Claude: appropriate, relevant, logical, same
 * style, fits the room) and retries; only drawings that pass come back.
 * Nothing goes on screen until you keep it: a finished drawing becomes an
 * "offer" (profile.mind.artOffers) that Rusty shows you.
 *
 * Everything falls back to the built-in art, instantly: no key, over the
 * monthly cap, offline, or a drawing that didn't pass.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { updateHobby, updateKeepsake } from '@/data/actions';
import { patchMind, useStore } from '@/data/store';
import type { ArtOffer, Hobby } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { now, uuid } from '@/lib/time';

export interface ArtStatus {
  configured: boolean;
  cap: number;
  used: number;
  left: number;
}

export type DrawResult =
  | { status: 'ready'; offer: ArtOffer; left: number }
  | { status: 'failed'; reasons: string[]; left: number }
  | { status: 'cap' | 'not_configured' | 'offline' | 'error' };

async function invoke<T>(body: object, ms: number): Promise<T | null> {
  if (!supabase) return null;
  try {
    const res = await Promise.race([
      supabase.functions.invoke('rusty-art', { body }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
    if (res.error) throw res.error;
    return res.data as T;
  } catch (e) {
    console.warn('[restie] rusty-art:', e instanceof Error ? e.message : e);
    return null;
  }
}

let statusCache: { at: number; value: ArtStatus | null } | null = null;

/** Can Rusty draw, and how much paint is left this month? (cached a minute) */
export async function artStatus(fresh = false): Promise<ArtStatus | null> {
  if (!fresh && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const value = await invoke<ArtStatus>({ action: 'status' }, 15_000);
  statusCache = { at: Date.now(), value };
  return value;
}

export function useArtStatus(): ArtStatus | null {
  const [s, setS] = useState<ArtStatus | null>(statusCache?.value ?? null);
  useEffect(() => {
    let alive = true;
    void artStatus().then((v) => alive && setS(v));
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

/** Ask Rusty to draw. Takes up to a minute or two (drawing + checking + retries). */
export async function draw(kind: ArtOffer['kind'], targetId: string, subject: string, detail?: string): Promise<DrawResult> {
  if (!supabase) return { status: 'offline' };
  const res = await invoke<{ status: string; path?: string; object?: string; left?: number; tries?: { problems: string[] }[] }>(
    { action: 'generate', kind, subject, detail },
    170_000,
  );
  statusCache = null;
  if (!res) return { status: 'error' };
  if (res.status === 'ready' && res.path) {
    const offer: ArtOffer = { id: uuid(), kind, targetId, path: res.path, object: res.object ?? subject, at: now() };
    const m = useStore.getState().profile.mind;
    patchMind({ artOffers: [...(m.artOffers ?? []).filter((o) => o.targetId !== targetId), offer] });
    return { status: 'ready', offer, left: res.left ?? 0 };
  }
  if (res.status === 'failed') return { status: 'failed', reasons: (res.tries ?? []).flatMap((t) => t.problems).slice(0, 3), left: res.left ?? 0 };
  if (res.status === 'cap' || res.status === 'not_configured') return { status: res.status };
  return { status: 'error' };
}

/** Keep it: it becomes the hobby's / keepsake's picture. */
export function keepOffer(offer: ArtOffer) {
  if (offer.kind === 'hobby') updateHobby(offer.targetId, { artPath: offer.path });
  else updateKeepsake(offer.targetId, { artPath: offer.path });
  dropOffer(offer.id);
}

export function dropOffer(id: string) {
  const m = useStore.getState().profile.mind;
  patchMind({ artOffers: (m.artOffers ?? []).filter((o) => o.id !== id) });
}

/* ------------------------------------------------- showing the pictures */

const signed = new Map<string, { url: string; at: number }>();

/** A private drawing → a short-lived URL (cached ~50 min). */
export async function artUrl(path: string): Promise<string | null> {
  const hit = signed.get(path);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  if (!supabase) return null;
  const { data } = await supabase.storage.from('generated').createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  signed.set(path, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

export function useArtUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (signed.get(path)?.url ?? null) : null));
  useEffect(() => {
    let alive = true;
    if (path) void artUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return path ? url : null;
}

/* -------------------------------------------- drawings in progress */

type Job = { state: 'drawing' } | { state: 'failed'; reasons: string[] } | { state: 'cap' } | { state: 'error' };

/** What Rusty is drawing right now (per hobby / keepsake), so leaving a page doesn't lose it. */
export const useArtJobs = create<{ jobs: Record<string, Job> }>(() => ({ jobs: {} }));
const setJob = (id: string, job: Job | null) =>
  useArtJobs.setState((s) => {
    const jobs = { ...s.jobs };
    if (job) jobs[id] = job;
    else delete jobs[id];
    return { jobs };
  });

export async function startDrawing(kind: ArtOffer['kind'], targetId: string, subject: string, detail?: string) {
  if (useArtJobs.getState().jobs[targetId]?.state === 'drawing') return;
  setJob(targetId, { state: 'drawing' });
  const r = await draw(kind, targetId, subject, detail);
  if (r.status === 'ready') setJob(targetId, null);
  else if (r.status === 'failed') setJob(targetId, { state: 'failed', reasons: r.reasons });
  else if (r.status === 'cap') setJob(targetId, { state: 'cap' });
  else setJob(targetId, { state: 'error' });
}

/**
 * A new hobby Rusty has no picture for ("other"): if drawing is on and there's
 * paint left, he starts on one in the background and shows it when it passes.
 */
export async function maybeDrawHobby(h: Hobby) {
  if (h.icon !== 'other' || h.artPath) return;
  const s = await artStatus();
  if (!s?.configured || s.left <= 0) return;
  void startDrawing('hobby', h.id, h.name, h.goal ?? undefined);
}
