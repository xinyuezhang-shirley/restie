/**
 * The app's single source of truth.
 *
 * Local-first: every change lands here instantly (and is cached on the device
 * through `storage`), then src/data/sync.ts pushes it to Supabase in the
 * background and pulls changes made on other devices. The UI never waits on
 * the network, so Restie keeps working offline and during usability tests.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/lib/storage';
import { now, uuid } from '@/lib/time';

import type { Profile, TableName, Tables } from './types';

type Collections = { [K in TableName]: Record<string, Tables[K]> };

export interface OutboxItem {
  table: TableName | 'profiles';
  id: string;
}

export interface Toast {
  id: string;
  text: string;
  /** shows an Undo button (see showToast) */
  undo?: boolean;
}

export interface RestieState extends Collections {
  userId: string | null;
  profile: Profile;
  /** keepsake id → local photo uri (shown before/without the upload) */
  photoCache: Record<string, string>;
  outbox: OutboxItem[];
  lastPulledAt: string | null;
  syncStatus: 'local' | 'syncing' | 'synced' | 'offline';
  hydrated: boolean;
  toast: Toast | null;
}

export const emptyProfile = (): Profile => ({
  id: 'local',
  name: '',
  onboardedAt: null,
  tutorialDoneAt: null,
  settings: { notifications: true, location: true, demoSpeed: false },
  mind: { skipLedger: [], lessons: [], lastTripAt: null, lines: null },
  updatedAt: now(),
});

const emptyCollections = (): Collections => ({
  hobbies: {},
  milestones: {},
  tasks: {},
  keepsakes: {},
  activities: {},
  messages: {},
  focus_sessions: {},
});

export const useStore = create<RestieState>()(
  persist(
    (): RestieState => ({
      ...emptyCollections(),
      userId: null,
      profile: emptyProfile(),
      photoCache: {},
      outbox: [],
      lastPulledAt: null,
      syncStatus: 'local',
      hydrated: false,
      toast: null,
    }),
    {
      name: 'restie-store-v1',
      storage: createJSONStorage(() => storage),
      partialize: ({ hydrated, toast, syncStatus, ...rest }) => rest,
    },
  ),
);

// With a synchronous storage, rehydration finishes while `create` is still
// running, so mark it here (after `useStore` exists) rather than in a callback.
const markHydrated = () => useStore.setState({ hydrated: true });
if (useStore.persist.hasHydrated()) markHydrated();
else useStore.persist.onFinishHydration(markHydrated);

/* ------------------------------------------------------------------ writes */

let onDirty: () => void = () => {};
/** sync.ts registers itself here so every write schedules a push. */
export function setDirtyListener(fn: () => void) {
  onDirty = fn;
}

function markDirty(item: OutboxItem) {
  useStore.setState((s) => ({
    outbox: s.outbox.some((o) => o.table === item.table && o.id === item.id)
      ? s.outbox
      : [...s.outbox, item],
  }));
  onDirty();
}

/** Insert or replace an entity. Missing id/updatedAt are filled in. */
export function put<K extends TableName>(
  table: K,
  entity: Omit<Tables[K], 'id' | 'updatedAt'> & { id?: string; updatedAt?: string },
): Tables[K] {
  const row = { ...entity, id: entity.id ?? uuid(), updatedAt: now() } as Tables[K];
  useStore.setState((s) => ({ [table]: { ...s[table], [row.id]: row } }) as Partial<RestieState>);
  markDirty({ table, id: row.id });
  return row;
}

export function patch<K extends TableName>(table: K, id: string, changes: Partial<Tables[K]>) {
  const prev = useStore.getState()[table][id];
  if (!prev) return;
  const row = { ...prev, ...changes, updatedAt: now() } as Tables[K];
  useStore.setState((s) => ({ [table]: { ...s[table], [id]: row } }) as Partial<RestieState>);
  markDirty({ table, id });
}

/** Soft delete, so the deletion syncs to other devices. */
export function remove(table: TableName, id: string) {
  patch(table, id, { deletedAt: now() } as never);
}

export function patchProfile(changes: Partial<Profile>) {
  useStore.setState((s) => ({ profile: { ...s.profile, ...changes, updatedAt: now() } }));
  markDirty({ table: 'profiles', id: 'me' });
}

export function patchMind(changes: Partial<Profile['mind']>) {
  patchProfile({ mind: { ...useStore.getState().profile.mind, ...changes } });
}

/** Wipe everything on this device (used by "Start over" and demo reset). */
export function resetLocal() {
  useStore.setState({
    ...emptyCollections(),
    profile: emptyProfile(),
    photoCache: {},
    outbox: [],
    lastPulledAt: null,
  });
}

/* ------------------------------------------------------------------- toast */

let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** Actions on toasts (e.g. Undo) live outside the persisted store. */
let toastAction: (() => void) | null = null;

/**
 * Confirmation pill. Pass `undo` to offer a one-tap Undo — every completion
 * in the app does, so nothing is ever a one-way door.
 */
export function showToast(text: string, undo?: () => void) {
  clearTimeout(toastTimer);
  toastAction = undo ?? null;
  useStore.setState({ toast: { id: uuid(), text, undo: !!undo } });
  toastTimer = setTimeout(hideToast, undo ? 5000 : 2600);
}

export function hideToast() {
  clearTimeout(toastTimer);
  toastAction = null;
  useStore.setState({ toast: null });
}

export function runToastUndo() {
  const fn = toastAction;
  hideToast();
  fn?.();
}

/* ------------------------------------------------------------------- reads */

/**
 * Derived reads (lists, progress objects). zustand v5 requires selectors to
 * return stable references, so compute from the state snapshot with useMemo
 * instead of returning fresh arrays from a selector.
 */
export function useDerived<T>(fn: (s: RestieState) => T, deps: unknown[] = []): T {
  const s = useStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useMemo(() => fn(s), [s, ...deps]);
}

export const alive = <T extends { deletedAt?: string | null }>(rows: Record<string, T>): T[] =>
  Object.values(rows).filter((r) => !r.deletedAt);
