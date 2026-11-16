/**
 * Rusty's little life in his room.
 *
 * His day is planned (src/rusty/life.ts): a timeline of activities that last
 * minutes, not seconds — sitting on the rug, watching the window, your
 * hobbies at their homes in the room, naps in his bed, sleep at night, and
 * some days a trip out. The brain just follows the plan: whenever you open
 * Home he's in the middle of whatever he was doing. Within an activity he
 * still does small things every half minute or so (a look, a little
 * expression, a line), so the room never feels frozen.
 *
 * Interrupts, high to low: Settings demo moves > you petting / waking him >
 * the plan.
 *
 * Other screens can queue a reaction for the next time Home is visible:
 *   rustyBus.getState().queue('celebrate')
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';

import { dailyLines } from '@/ai/rusty';
import { addKeepsake } from '@/data/actions';
import { hobbiesOf } from '@/data/selectors';
import { patchMind, useStore } from '@/data/store';
import type { HobbyIcon } from '@/data/types';
import { daysBetween, dayKey, now } from '@/lib/time';
import { useSky, type Condition } from '@/world/world';

import { blockAt, clockLabel, msOfDay, planDay, PLACES, type Block, type Place, type SpotKey } from './life';
import { activityLine, lines, pick } from './personality';
import type { PoseKey } from './rig';

export type { SpotKey };

/** The weather each day was planned with (the first seen that day). */
const DAY_WEATHER = new Map<string, Condition>();

/**
 * Where Rusty's feet go (fractions of the room) and his depth scale. Measured
 * on the room painting (src/room/layout.ts): the room is built to his size, so
 * along the wall his head is level with the desk top and the windowsill.
 *   rug    — middle of the floor, his home base
 *   desk   — in front of the desk (baking, writing, odds and ends)
 *   window — in front of the window (painting at the easel, plants, weather)
 *   bed    — in his cat bed, front left (naps, reading)
 *   door   — by the little door (trips, guitar in the corner)
 */
export const SPOTS: Record<SpotKey, { x: number; y: number; s: number }> = {
  rug: { x: 0.512, y: 0.748, s: 1 },
  desk: { x: 0.514, y: 0.573, s: 0.85 },
  window: { x: 0.197, y: 0.569, s: 0.85 },
  bed: { x: 0.22, y: 0.669, s: 0.9 },
  door: { x: 0.847, y: 0.573, s: 0.85 },
};

/**
 * Anywhere on the floor, for "walk over here" taps: `@x,y` in room fractions.
 * The floor runs from the back wall (y ≈ 0.56, by the desk) to the front
 * (y ≈ 0.80, above the plans card); he's drawn smaller further back.
 */
export type Where = SpotKey | `@${string}`;
export const FLOOR = { x0: 0.12, x1: 0.88, y0: 0.565, y1: 0.8 } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const depth = (y: number) => clamp(0.85 + ((y - 0.569) / (0.748 - 0.569)) * 0.15, 0.82, 1.05);

/** The floor point nearest to (x, y): taps on the wall send him to the back of the floor. */
export function freePlace(x: number, y: number): Where {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'rug';
  return `@${clamp(x, FLOOR.x0, FLOOR.x1).toFixed(3)},${clamp(y, FLOOR.y0, FLOOR.y1).toFixed(3)}` as Where;
}

export function spotAt(p: Where): { x: number; y: number; s: number } {
  if (!(p as string).startsWith('@')) return SPOTS[p as SpotKey];
  const [x, y] = (p as string).slice(1).split(',').map(Number);
  return { x, y, s: depth(y) };
}

type Reaction = 'celebrate' | 'wave';

/** A specific thing to do next (Settings → "Make Rusty…", for demos). */
export interface Directive {
  pose: PoseKey;
  spot: SpotKey;
}

export const rustyBus = create<{
  pending: Reaction | null;
  queue: (r: Reaction) => void;
  directive: Directive | null;
  direct: (d: Directive) => void;
  /** demo pace (1 = real life); `from` = ms of day when it was switched on */
  pace: { speed: number; from: number };
  setSpeed: (speed: number) => void;
  /** a demo trip: out now, back at `until` (epoch ms) */
  demoTrip: { until: number; place: Place } | null;
  sendOnTrip: (ms?: number) => void;
}>((set) => ({
  pending: null,
  queue: (r) => set({ pending: r }),
  directive: null,
  direct: (d) => set({ directive: d }),
  pace: { speed: 1, from: 0 },
  setSpeed: (speed) => set({ pace: { speed, from: msOfDay(new Date()) } }),
  demoTrip: null,
  sendOnTrip: (ms = 75_000) => set({ demoTrip: { until: Date.now() + ms, place: pick(PLACES) } }),
}));

export interface Brain {
  /** what to show right now (a reaction if there is one, else the activity) */
  pose: PoseKey;
  /** the ongoing activity (sit, paint, cook, sleep, think…) */
  base: PoseKey;
  /** a short reaction to a pet/poke, or null */
  reaction: PoseKey | null;
  spot: Where;
  line: string | null;
  /** out on a trip: the door sign says when he's back */
  away: { back: string; note: string } | null;
  /** a quiet subtitle of what he's up to (shown above the room, like Mycoto's narration) */
  doing: string;
  /** person tapped his head */
  pet: () => void;
  /** person tapped his body (holding him opens his menu instead) */
  poke: () => void;
  say: (text: string, ms?: number) => void;
  /** clear the speech bubble */
  hush: () => void;
  /** you tapped the floor (room fractions): he walks there and sits a while */
  goTo: (x: number, y: number) => void;
  /** you tapped his bed: a nap */
  goToBed: () => void;
  /** arrow keys: a few steps that way */
  nudge: (dir: 'up' | 'down' | 'left' | 'right') => void;
}

const HOBBY_DOING: Record<string, string> = {
  drawing: 'Rusty is painting by the window',
  baking: 'Rusty is mixing something at the desk',
  guitar: 'Rusty is practicing guitar (mostly purring)',
  reading: 'Rusty is reading in his bed',
  writing: 'Rusty is writing in his notebook',
  gardening: 'Rusty is checking on his little plant',
  other: 'Rusty is working on a little project',
};

/** The subtitle for what he's doing. */
function doingLine(kind: string, pose: PoseKey, spot: Where, icon: HobbyIcon | undefined, condition: Condition): string {
  if (kind === 'tour') return 'Rusty is waiting to meet you';
  if (kind === 'asked' && pose === 'sleep') return 'Rusty is napping in his bed (you said so)';
  if (kind === 'asked') return 'Rusty came over where you tapped';
  if (kind === 'hobby' && icon) return HOBBY_DOING[icon] ?? HOBBY_DOING.other;
  if (pose === 'paint') return HOBBY_DOING.drawing;
  if (pose === 'cook') return HOBBY_DOING.baking;
  if (pose === 'wave') return 'Rusty is waving hello';
  if (kind === 'sleep') return 'Rusty is asleep. It’s late.';
  if (pose === 'sleep') return 'Rusty is napping in his bed';
  if (kind === 'window' || (spot === 'window' && pose === 'sit')) {
    const w = { clear: 'the sky', cloudy: 'the clouds', fog: 'the fog', rain: 'the rain', snow: 'the snow', storm: 'the storm' }[condition];
    return `Rusty is watching ${w} out the window`;
  }
  if (pose === 'think') return spot === 'bed' ? 'Rusty is daydreaming in his bed' : 'Rusty is daydreaming';
  if (spot === 'door') return 'Rusty is sitting by the door, listening';
  return 'Rusty is lounging on the rug';
}

/** Little moments, narrated for a few seconds. */
const MOMENT: Partial<Record<PoseKey, string>> = {
  smug: 'Rusty looks very proud of himself',
  wink: 'Rusty does a slow blink at you',
  surprised: 'Rusty’s ears perk up',
  love: 'Rusty is purring',
};

/** What a block says when it starts (sometimes). */
function startLine(b: Block, condition: string): string | null {
  const r = Math.random();
  if (b.kind === 'hobby' && r < 0.5) return activityLine(b.icon);
  if (b.kind === 'window' && r < 0.55) return pick(lines.weather[condition as keyof typeof lines.weather]);
  if (b.kind === 'think' && r < 0.35) return pick(lines.thinking);
  return null;
}

/**
 * @param visible Home is on screen (the brain only acts then)
 * @param paused  the tour is running: Rusty stays on the rug, doesn't wander
 *                or chatter, and only reacts when you tap him
 */
export function useRustyBrain(visible: boolean, paused = false): Brain {
  const { phase, condition } = useSky();
  const icons = useStore((s) => {
    const list = hobbiesOf(s)
      .filter((h) => h.status === 'active')
      .map((h) => h.icon);
    return [...new Set(list)].sort().join(',');
  });
  const lastDoneAt = useStore((s) =>
    Object.values(s.hobbies).reduce<string | null>((m, h) => (h.lastDoneAt && (!m || h.lastDoneAt > m) ? h.lastDoneAt : m), null),
  );
  const pace = rustyBus((b) => b.pace);
  const demoTrip = rustyBus((b) => b.demoTrip);
  const pending = rustyBus((b) => b.pending);
  const directive = rustyBus((b) => b.directive);

  // Demo speed (Settings) also runs his day faster.
  const demoSpeed = useStore((s) => s.profile.settings.demoSpeed);
  useEffect(() => {
    if (demoSpeed && rustyBus.getState().pace.speed === 1) rustyBus.getState().setSpeed(10);
  }, [demoSpeed]);

  // The clock the plan is read from (ticks while Home is visible).
  const [clock, setClock] = useState(() => Date.now());

  // Today's plan. The weather it was planned with is the first one seen today,
  // so a passing cloud doesn't rewrite his whole day.
  const today = dayKey(new Date(clock));
  if (!DAY_WEATHER.has(today)) DAY_WEATHER.set(today, condition);
  const plan = useMemo(() => {
    const p = useStore.getState().profile;
    const firstDay = !p.onboardedAt || daysBetween(new Date(p.onboardedAt), new Date()) < 1;
    const tripYesterday = !!p.mind.lastTripAt && daysBetween(new Date(p.mind.lastTripAt), new Date()) <= 1;
    return planDay({
      date: new Date(`${today}T12:00:00`),
      icons: icons ? (icons.split(',') as HobbyIcon[]) : [],
      condition: DAY_WEATHER.get(today) ?? condition,
      canTrip: !firstDay && !tripYesterday,
      speed: pace.speed,
      from: pace.from,
    });
    // the day's weather is DAY_WEATHER (first seen today), not each passing change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, icons, pace]);

  // Where the plan says he is (demo pace: his clock runs faster).
  const realMs = msOfDay(new Date(clock));
  const ms = pace.speed === 1 ? realMs : pace.from + (realMs - pace.from) * pace.speed;
  const planned = blockAt(plan, ms);
  const demoAway = demoTrip && clock < demoTrip.until ? demoTrip : null;
  // Just back from a trip, souvenir not handed over yet: he's at the door, waving.
  const tripDone = useStore((s) => s.profile.mind.tripDone);
  const returning = (!!demoTrip && !demoAway) || (!!plan.trip && realMs >= plan.trip.end && tripDone !== today && pace.speed === 1);

  // Interrupts that sit on top of the plan for a while.
  const [hold, setHold] = useState<{
    pose: PoseKey;
    spot: Where;
    until: number;
    /** you asked him to (tap / arrow keys), not the plan */
    asked?: boolean;
  } | null>(null);
  const [override, setOverride] = useState<PoseKey | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [moment, setMoment] = useState<string | null>(null);
  const momentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const overrideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reactTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((text: string, ms = 6000) => {
    clearTimeout(lineTimer.current);
    setLine(text);
    lineTimer.current = setTimeout(() => setLine(null), ms);
  }, []);
  const hush = useCallback(() => {
    clearTimeout(lineTimer.current);
    setLine(null);
  }, []);
  const flash = useCallback((pose: PoseKey, ms: number) => {
    clearTimeout(overrideTimer.current);
    setOverride(pose);
    overrideTimer.current = setTimeout(() => setOverride(null), ms);
  }, []);

  // What he's doing now, in priority order.
  const away = !paused && (demoAway || planned.kind === 'away');
  const activeHold = hold && clock < hold.until ? hold : null;
  const block: {
    pose: PoseKey;
    spot: Where;
    kind: string;
    key: string;
    icon?: HobbyIcon;
  } = paused
    ? { pose: 'sit', spot: 'rug', kind: 'tour', key: 'tour' }
    : away
      ? { pose: 'sit', spot: 'door', kind: 'away', key: 'away' }
      : returning
        ? { pose: 'wave', spot: 'door', kind: 'hold', key: 'returning' }
        : activeHold
          ? { ...activeHold, kind: activeHold.asked ? 'asked' : 'hold', key: `hold-${activeHold.until}` }
          : planned.kind === 'away'
            ? { pose: 'sit', spot: 'door', kind: 'away', key: 'away' }
            : {
                pose: planned.pose,
                spot: planned.spot,
                kind: planned.kind,
                key: `${planned.kind}-${planned.start}`,
                icon: planned.icon,
              };

  // Tick: re-read the plan every 10 s (and right away when Home appears).
  useEffect(() => {
    if (!visible) return;
    const first = setTimeout(() => setClock(Date.now()), 0);
    const id = setInterval(() => setClock(Date.now()), pace.speed === 1 ? 10_000 : 2_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [visible, pace.speed]);

  // A new activity begins (while you're watching): sometimes he says so.
  const lastKey = useRef(block.key);
  useEffect(() => {
    if (lastKey.current === block.key) return;
    lastKey.current = block.key;
    if (!visible || paused || block.kind === 'away' || block.kind === 'hold' || planned.kind === 'away') return;
    const text = startLine(planned as Block, condition);
    if (text) setTimeout(() => say(text), 1800);
  }, [block.key, block.kind, visible, paused, planned, condition, say]);

  // Back from a trip (seen live, or the first time you look after he's back):
  // the souvenir becomes his keepsake, once per trip.
  const wasAway = useRef(false);
  useEffect(() => {
    if (!visible || paused) return;
    if (away) {
      wasAway.current = true;
      return;
    }
    const mind = useStore.getState().profile.mind;
    const realTripOver = plan.trip && realMs >= plan.trip.end && mind.tripDone !== today;
    const demoTripOver = wasAway.current && !demoAway && demoTrip;
    if (!realTripOver && !demoTripOver) return;
    wasAway.current = false;
    const place = demoTripOver ? demoTrip!.place : plan.trip!.place;
    const idea = mind.tripIdea?.date === today ? mind.tripIdea : null;
    const souvenir = idea ?? place.souvenir;
    addKeepsake({
      kind: 'rusty',
      caption: souvenir.caption,
      note: souvenir.line,
      sticker: 'hobby-other',
    });
    patchMind({
      lastTripAt: now(),
      ...(demoTripOver ? {} : { tripDone: today }),
    });
    if (demoTripOver) rustyBus.setState({ demoTrip: null });
    setHold({ pose: 'wave', spot: 'door', until: Date.now() + 60_000 });
    setTimeout(() => say(souvenir.line, 8000), 900);
  }, [visible, paused, away, demoAway, demoTrip, plan, realMs, today, say]);

  // Greeting when Home appears (not during the tour, not while he's out).
  useEffect(() => {
    if (!visible || paused || away) return;
    const gone = lastDoneAt ? daysBetween(new Date(lastDoneAt), new Date()) : 0;
    const t = setTimeout(() => {
      if (block.pose === 'sleep') return;
      say(gone >= 5 ? pick(lines.missing) : pick(lines.greet[phase]));
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Little life inside an activity: every 25–50 s a look, an expression or a line.
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!visible || paused || away || block.pose === 'sleep') return;
    const t = setTimeout(
      () => {
        const r = Math.random();
        if (r < 0.3) {
          const p = pick(['smug', 'wink', 'surprised', 'love'] as PoseKey[]);
          flash(p, 1300);
          clearTimeout(momentTimer.current);
          setMoment(MOMENT[p] ?? null);
          momentTimer.current = setTimeout(() => setMoment(null), 4000);
        }
        else if (r < 0.5) {
          const ai = useStore.getState().profile.mind.lines;
          say(
            ai?.date === today && ai.lines.length && Math.random() < 0.5
              ? pick(ai.lines)
              : block.icon
                ? activityLine(block.icon)
                : pick(lines.thinking),
          );
        }
        setBeat((b) => b + 1); // re-arm
      },
      (25 + Math.random() * 25) * 1000,
    );
    return () => clearTimeout(t);
  }, [visible, paused, away, block.pose, block.icon, beat, today, flash, say]);

  // Queued reactions from other screens (e.g. after logging a step). A short
  // beat first, so the room is on screen before he reacts.
  useEffect(() => {
    if (!visible || !pending) return;
    rustyBus.setState({ pending: null }); // re-runs this effect, so no cleanup here
    clearTimeout(reactTimer.current);
    reactTimer.current = setTimeout(() => {
      if (away) return; // he'll hear about it when he's back
      if (pending === 'celebrate') {
        flash('cheer', 3500);
        say(pick(lines.celebrate));
      } else flash('wave', 2500);
    }, 350);
  }, [visible, pending, away, flash, say]);

  // Demo directives: do exactly this for the next two minutes.
  useEffect(() => {
    if (!visible || !directive) return;
    // Clearing the directive re-runs this effect, so the update must not be
    // tied to its cleanup (it would be cancelled before it fires).
    rustyBus.setState({ directive: null });
    setTimeout(
      () =>
        setHold({
          pose: directive.pose,
          spot: directive.spot,
          until: Date.now() + 120_000,
        }),
      0,
    );
  }, [visible, directive]);

  // Taps. Several in a row → he gets giddy. Waking him: he sits up for a bit.
  const taps = useRef<number[]>([]);
  const streak = useCallback(() => {
    const t = Date.now();
    taps.current = [...taps.current.filter((x) => t - x < 3000), t];
    return taps.current.length;
  }, []);
  const wake = useCallback(
    (react: PoseKey) => {
      flash(react, 1300);
      say(pick(lines.woken), 3000);
      setTimeout(
        () =>
          setHold({
            pose: 'sit',
            spot: block.spot,
            until: Date.now() + 90_000,
          }),
        1300,
      );
    },
    [block.spot, flash, say],
  );
  const pet = useCallback(() => {
    if (streak() >= 5) {
      flash('laugh', 1600);
      say(pick(lines.tooMuch), 3000);
    } else if ((override ?? block.pose) === 'sleep') wake('surprised');
    else {
      flash(Math.random() < 0.25 ? 'love' : 'laugh', 1700);
      say(pick(lines.pet), 3500);
    }
  }, [block.pose, override, flash, say, streak, wake]);
  const poke = useCallback(() => {
    if (streak() >= 5) {
      flash('laugh', 1600);
      say(pick(lines.tooMuch), 3000);
    } else if ((override ?? block.pose) === 'sleep') wake('grumpy');
    else {
      flash(pick(['surprised', 'wink', 'laugh'] as PoseKey[]), 1200);
      if (Math.random() < 0.6) say(pick(lines.poke), 2500);
    }
  }, [block.pose, override, flash, say, streak, wake]);

  // You tell him where to go: tap the floor, tap his bed, or arrow keys.
  const goTo = useCallback(
    (x: number, y: number) => {
      if (!visible || paused || away) return;
      const wasAsleep = (override ?? block.pose) === 'sleep';
      setHold({ pose: 'sit', spot: freePlace(x, y), until: Date.now() + 90_000, asked: true });
      if (wasAsleep) say(pick(lines.woken), 2500);
      else if (Math.random() < 0.3) say(pick(['coming!', 'on my way.', 'this spot? okay.', 'trot trot trot.']), 2000);
    },
    [visible, paused, away, override, block.pose, say],
  );
  const goToBed = useCallback(() => {
    if (!visible || paused || away) return;
    if (block.pose === 'sleep' && block.spot === 'bed') {
      say('(he’s already curled up. zzz.)', 2500);
      return;
    }
    setHold({ pose: 'sleep', spot: 'bed', until: Date.now() + 3 * 60_000, asked: true });
    say(pick(['a nap? you don’t have to ask twice.', 'bedtime! just a short one.', 'okay… five more minutes. or fifty.']), 3000);
  }, [visible, paused, away, block.pose, block.spot, say]);
  const nudge = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (!visible || paused || away) return;
      const at = spotAt(block.spot);
      const [dx, dy] = { up: [0, -0.07], down: [0, 0.07], left: [-0.14, 0], right: [0.14, 0] }[dir];
      const next = freePlace(at.x + dx, at.y + dy);
      if (next === freePlace(at.x, at.y)) {
        say(dir === 'up' ? 'that’s the wall. I can’t climb walls. yet.' : 'that’s as far as the room goes.', 2500);
        return;
      }
      setHold({ pose: 'sit', spot: next, until: Date.now() + 90_000, asked: true });
    },
    [visible, paused, away, block.spot, say],
  );

  useEffect(
    () => () => {
      clearTimeout(lineTimer.current);
      clearTimeout(overrideTimer.current);
      clearTimeout(reactTimer.current);
      clearTimeout(momentTimer.current);
    },
    [],
  );

  const trip = demoAway ? { end: msOfDay(new Date(demoAway.until)), place: demoAway.place } : planned.kind === 'away' ? planned.trip : null;
  return {
    pose: away ? 'sit' : (override ?? block.pose),
    base: block.pose,
    reaction: away ? null : override,
    spot: block.spot,
    line,
    away: away && trip ? { back: clockLabel(trip.end), note: trip.place.note } : null,
    doing:
      away && trip
        ? `Rusty is out exploring · back around ${clockLabel(trip.end)}`
        : block.key === 'returning'
          ? 'Rusty just got back, and he brought something'
          : (moment ?? doingLine(block.kind, block.pose, block.spot, block.icon, condition)),
    pet,
    poke,
    say,
    hush,
    goTo,
    goToBed,
    nudge,
  };
}

/** Once a day: fetch fresh lines (and a souvenir idea for a trip) from Rusty's brain. */
export function useDailyRusty() {
  useEffect(() => {
    const today = dayKey();
    const mind = useStore.getState().profile.mind;
    if (mind.lines?.date === today) return;
    let cancelled = false;
    void (async () => {
      const res = await dailyLines();
      if (cancelled) return;
      patchMind({
        lines: { date: today, lines: res?.lines ?? [] },
        tripIdea: res?.trip ? { date: today, caption: res.trip.caption, line: res.trip.line } : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
