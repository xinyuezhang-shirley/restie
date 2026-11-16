/**
 * Rusty's day. Not a patrol loop: each local day gets a seed (like Mycoto's)
 * that plans his whole day as a timeline of activities measured in minutes,
 * weighted by the time of day, the weather, his mood and your hobbies.
 *
 * Because the plan is a pure function of the date (and your hobbies), he's
 * always somewhere in it: open the app and he's in the middle of whatever he
 * was doing while you were away — not starting over.
 *
 * Some days he goes on a trip for a few hours. A sign hangs on his door, and
 * he comes back with a souvenir for you.
 */
import type { HobbyIcon } from '@/data/types';
import { dayKey } from '@/lib/time';
import type { Condition } from '@/world/world';

import type { PoseKey } from './rig';

export type SpotKey = 'rug' | 'desk' | 'bed' | 'window' | 'door';
export type Mood = 'crafty' | 'sleepy' | 'curious' | 'cozy';
export type Kind = 'sit' | 'window' | 'think' | 'door' | 'nap' | 'hobby' | 'sleep' | 'back';

export interface Block {
  kind: Kind;
  pose: PoseKey;
  spot: SpotKey;
  /** ms since local midnight */
  start: number;
  end: number;
  icon?: HobbyIcon;
}

export interface Trip {
  start: number;
  end: number;
  place: Place;
}

export interface DayPlan {
  date: string;
  mood: Mood;
  favorite?: HobbyIcon;
  wake: number;
  bed: number;
  trip: Trip | null;
  blocks: Block[];
}

export interface Place {
  key: string;
  /** on the door sign / his note */
  note: string;
  souvenir: { caption: string; line: string };
}

export const PLACES: Place[] = [
  {
    key: 'creek',
    note: 'gone to the creek to look for good pebbles.',
    souvenir: { caption: 'A smooth pebble from the creek', line: 'I’m back! I found this pebble. it looks like a bread roll. it’s yours now.' },
  },
  {
    key: 'cafe',
    note: 'visiting the café cat down the street. she knows things.',
    souvenir: { caption: 'A bottle cap that sparkles', line: 'I’m back! the café cat says hi. I found a sparkly bottle cap on the way.' },
  },
  {
    key: 'park',
    note: 'at the park. the leaves are doing something important.',
    souvenir: { caption: 'A red leaf, perfectly crunchy', line: 'back! I brought you the crunchiest leaf in the whole park.' },
  },
  {
    key: 'library',
    note: 'at the library. I like the warm spot by the radiator.',
    souvenir: { caption: 'A bookmark someone dropped', line: 'I’m home! someone dropped this bookmark. now it’s ours.' },
  },
  {
    key: 'market',
    note: 'at the farmers market, smelling every single thing.',
    souvenir: { caption: 'A tiny feather', line: 'back! a bird left this at the market. I didn’t chase it. much.' },
  },
];

const MIN = 60_000;
const HOUR = 60 * MIN;

/* --------------------------------------------------------------- random */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32): the same day always plays out the same. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ activities */

/** Where each hobby happens (its home in the room, src/room/layout.ts). */
export function hobbyBlock(icon: HobbyIcon): { pose: PoseKey; spot: SpotKey } {
  switch (icon) {
    case 'drawing':
      return { pose: 'paint', spot: 'window' };
    case 'baking':
      return { pose: 'cook', spot: 'desk' };
    case 'gardening':
      return { pose: 'think', spot: 'window' };
    case 'reading':
      return { pose: 'think', spot: 'bed' };
    case 'guitar':
      return { pose: 'think', spot: 'door' };
    default:
      return { pose: 'think', spot: 'desk' };
  }
}

/** Minutes each kind of activity lasts (min, max). */
const LENGTH: Record<Exclude<Kind, 'sleep' | 'back'>, [number, number]> = {
  sit: [3, 7],
  window: [3, 6],
  think: [3, 6],
  door: [2, 4],
  nap: [12, 30],
  hobby: [8, 18],
};

const BASE: Record<Exclude<Kind, 'sleep' | 'back'>, { pose: PoseKey; spot: SpotKey }> = {
  sit: { pose: 'sit', spot: 'rug' },
  window: { pose: 'sit', spot: 'window' },
  think: { pose: 'think', spot: 'rug' },
  door: { pose: 'sit', spot: 'door' },
  nap: { pose: 'sleep', spot: 'bed' },
  hobby: { pose: 'think', spot: 'desk' },
};

function weights(hour: number, mood: Mood, condition: Condition) {
  const w = { sit: 2, window: 1.5, think: 1.5, door: 0.6, nap: 0.6, hobby: 3 };
  if (hour < 11) Object.assign(w, { window: 2.5, hobby: 3, nap: 0.3 });
  else if (hour < 13) Object.assign(w, { hobby: 4 });
  else if (hour < 16) Object.assign(w, { nap: 2.2, hobby: 3 });
  else if (hour < 19) Object.assign(w, { window: 2.2, hobby: 3 });
  else Object.assign(w, { nap: 1.6, think: 2, hobby: 2 });
  if (mood === 'crafty') w.hobby *= 1.6;
  if (mood === 'sleepy') w.nap *= 1.8;
  if (mood === 'curious') {
    w.window *= 1.6;
    w.door *= 1.8;
  }
  if (mood === 'cozy') {
    w.sit *= 1.5;
    w.think *= 1.4;
  }
  if (condition === 'rain' || condition === 'storm') {
    w.nap *= 1.4;
    w.window *= 1.3;
  }
  if (condition === 'snow') w.window *= 1.8;
  return w;
}

export interface PlanInput {
  date: Date;
  icons: HobbyIcon[];
  condition: Condition;
  /** no trips on his first day, or the day after a trip */
  canTrip: boolean;
  /** demo pace: the plan starts at `from` and runs `speed`× faster, awake all day */
  speed?: number;
  from?: number;
}

/** Plan a whole day. Pure: same inputs → same day. */
export function planDay({ date, icons, condition, canTrip, speed = 1, from }: PlanInput): DayPlan {
  const key = dayKey(date);
  const r = rng(hash(`${key}|${[...icons].sort().join(',')}|${speed}`));
  const between = (a: number, b: number) => a + r() * (b - a);
  const mood = (['crafty', 'sleepy', 'curious', 'cozy'] as const)[Math.floor(r() * 4)];
  const favorite = icons.length ? icons[Math.floor(r() * icons.length)] : undefined;
  const demo = speed !== 1;
  const wake = demo ? (from ?? 0) : Math.round(between(6.5, 8) * HOUR);
  const bed = demo ? 24 * HOUR : Math.round(between(22, 23.25) * HOUR);

  let trip: Trip | null = null;
  if (!demo && canTrip && r() < 0.18) {
    const start = Math.round(between(10.5, 12.5) * HOUR);
    trip = { start, end: start + Math.round(between(3, 5) * HOUR), place: PLACES[Math.floor(r() * PLACES.length)] };
  }

  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  if (!demo) push({ kind: 'sleep', pose: 'sleep', spot: 'bed', start: 0, end: wake });
  let t = wake;
  let prev: Kind | null = null;
  while (t < bed) {
    if (trip && t >= trip.start - 4 * MIN && t < trip.end) {
      // a last look at the door, then he's out; he walks back in with a wave
      if (t < trip.start) push({ kind: 'door', pose: 'sit', spot: 'door', start: t, end: trip.start });
      push({ kind: 'back', pose: 'wave', spot: 'door', start: trip.end, end: trip.end + 2 * MIN });
      t = trip.end + 2 * MIN;
      prev = 'back';
      continue;
    }
    const hour = (t / HOUR) % 24;
    const w = weights(hour, mood, condition);
    if (!icons.length) w.hobby = 0;
    const kinds = (Object.keys(w) as (keyof typeof w)[]).filter((k) => k !== prev);
    const total = kinds.reduce((n, k) => n + w[k], 0);
    let x = r() * total;
    let kind = kinds[0];
    for (const k of kinds) if ((x -= w[k]) <= 0) {
      kind = k;
      break;
    }
    const [lo, hi] = LENGTH[kind];
    const len = Math.round((between(lo, hi) * MIN) / speed);
    let block: Block = { kind, ...BASE[kind], start: t, end: Math.min(t + len, bed) };
    if (kind === 'hobby') {
      const icon = favorite && r() < 0.5 ? favorite : icons[Math.floor(r() * icons.length)];
      block = { ...block, ...hobbyBlock(icon), icon };
    }
    push(block);
    t = block.end;
    prev = kind;
  }
  if (!demo) push({ kind: 'sleep', pose: 'sleep', spot: 'bed', start: bed, end: 24 * HOUR });
  return { date: key, mood, favorite, wake, bed, trip, blocks };
}

export const msOfDay = (d: Date) => d.getHours() * HOUR + d.getMinutes() * MIN + d.getSeconds() * 1000 + d.getMilliseconds();

/** What he's doing at `ms` (since midnight): a block, or out on his trip. */
export function blockAt(plan: DayPlan, ms: number): Block | { kind: 'away'; trip: Trip } {
  if (plan.trip && ms >= plan.trip.start && ms < plan.trip.end) return { kind: 'away', trip: plan.trip };
  return plan.blocks.find((b) => ms >= b.start && ms < b.end) ?? plan.blocks[plan.blocks.length - 1];
}

/** "3:30" for the door sign. */
export function clockLabel(ms: number): string {
  const h = Math.floor(ms / HOUR) % 24;
  const m = Math.round((ms % HOUR) / MIN / 15) * 15;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 60 ? `${(hh % 12) + 1}:00` : `${hh}:${String(m).padStart(2, '0')}`;
}
