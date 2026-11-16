/**
 * Rusty moving through his room: the live puppet whenever he's sitting or
 * doing something, Shirley's sprite sheets for the moves in between.
 *
 * Every change goes through sitting, never jumping between states:
 *   painting (puppet's paint pose: brush arm moving)
 *     → paint sheet backwards: stand down to sitting
 *     → walk sheet: stand up facing the way, walk (cycle follows the distance
 *       walked), stop and sit
 *     → cook sheet forwards: sit → holding the bowl
 *     → cooking (puppet's cook pose: stirring)
 * The sheets are only used for those short moves, and each move starts and
 * ends on the puppet's own drawing (sprites.ts), so swapping between the live
 * puppet and a move doesn't change the picture. Between drawings are morphed
 * in-betweens, so the moves flow instead of cutting. The long, looping part of
 * each activity is the puppet. Sleep is the exception: it holds the move's
 * last frame and breathes.
 *
 * Taps always land on the puppet (its body just fades out while a sheet
 * plays), so petting, holding for the menu and hearts work in every state.
 */
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SPOTS, type SpotKey } from './brain';
import { RIG, type PoseKey } from './rig';
import { RustyPuppet, type RustyPuppetHandle } from './RustyPuppet';
import {
  ACTION_SHEET,
  clipMs,
  ENTER,
  EXIT,
  PUPPET_LOOP,
  R,
  SHEET_KEYS,
  SHEETS,
  STEP_FRAMES,
  WALK_LAST,
  WALK_SHEET,
  WALK_SPEED,
  WALK_STEP,
  walkClips,
  walkDir,
  type Clip,
  type SheetKey,
} from './sprites';

/** Where the feet are inside the puppet box (fractions of its size). */
export const FOOT_Y = RIG.neutral.ground / 700;
export const FOOT_X = 0.54;

/** Puppet ↔ sheet and sheet ↔ sheet handoff. */
const FADE_MS = 240;
/** The puppet's own pose crossfade (RustyPuppet) — wait it out while hidden. */
const PUPPET_SWAP_MS = 360;
const SLEEP = SHEET_KEYS.indexOf('sleep');
/** Head position per sheet (SHEET_KEYS order) and frame — plain arrays for the UI thread. */
const HEADS = SHEET_KEYS.map((k) => SHEETS[k].head);
/**
 * His resting pose. 'neutral' shares its body with every tap reaction (laugh,
 * love, wink, surprised…), so petting him only changes his face — no jump to
 * a different drawing. ('sit' is a separate drawing with a tilted head.)
 */
const REST: PoseKey = 'neutral';

/** Top-center of the puppet's head for a pose, in box units. */
const puppetHead = (p: PoseKey): [number, number] => {
  const [x, y, r] = RIG[p].head;
  return [x / 700, (y - r * 1.05) / 700];
};

/** What the UI thread is playing. Replaced as a whole so it's never half-updated. */
interface Playing {
  id: number;
  frames: readonly number[];
  fps: number;
  ease: 0 | 1 | 2 | 3; // none, in, out, inOut
  mode: 0 | 1; // once, walk (cycle by distance)
}
const EASE = { in: 1, out: 2, inOut: 3 } as const;

export interface ActorProps {
  roomW: number;
  roomH: number;
  /** puppet box size at depth scale 1 */
  size: number;
  spot: SpotKey;
  /** ongoing activity from the brain */
  base: PoseKey;
  /** short reaction (pet/poke); shown only while he's just sitting */
  reaction: PoseKey | null;
  /** feet position + depth scale, shared with the speech bubble */
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  sc: SharedValue<number>;
  /** top-center of his head in box units, kept up to date here (bubble, badge) */
  headX: SharedValue<number>;
  headY: SharedValue<number>;
  puppet: Omit<React.ComponentProps<typeof RustyPuppet>, 'pose' | 'size' | 'bodyOpacity'>;
  /** drawn on top, anchored to the top-center of his head (badges) */
  children?: ReactNode;
  /** the moving box, for the tour's spotlight */
  boxRef?: RefObject<ComponentRef<typeof View> | null>;
  onBoxLayout?: ViewProps['onLayout'];
  /** he arrived somewhere / finished a change */
  onSettled?: () => void;
  /** the room's light on him (a view filter: brightness, saturate) */
  light?: ViewStyle['filter'];
  /** out of the room (on a trip): fades out and can't be tapped */
  hidden?: boolean;
}

export const RustyActor = forwardRef<RustyPuppetHandle, ActorProps>(function RustyActor(props, ref) {
  const {
    roomW,
    roomH,
    size: S,
    spot,
    base,
    reaction,
    fx,
    fy,
    sc,
    headX,
    headY,
    puppet: puppetProps,
    children,
    boxRef,
    onBoxLayout,
    onSettled,
    light,
    hidden,
  } = props;
  const reduce = useReducedMotion();
  const puppet = useRef<RustyPuppetHandle>(null);
  useImperativeHandle(ref, () => ({
    burst: (t, n) => puppet.current?.burst(t, n),
    kickTail: () => puppet.current?.kickTail(),
    lookAt: (x, y) => puppet.current?.lookAt(x, y),
  }));

  /* ------------------------------------------- shared with the UI thread */

  const puppetO = useSharedValue(1);
  const spriteO = useSharedValue(0);
  // which sheet is showing, and the one it's handing off from
  const sheet = useSharedValue({ active: -1, prev: -1, prevFrame: 0 });
  const sheetMix = useSharedValue(1);
  const playing = useSharedValue<Playing>({ id: 0, frames: [0], fps: 1, ease: 0, mode: 0 });
  const startedId = useSharedValue(-1);
  const startedAt = useSharedValue(0);
  const walkFrom = useSharedValue({ x: 0, y: 0 });
  // box units walked per cycle frame, set per walk so he arrives mid-stride
  // on the drawing the sit-down move starts from
  const walkStep = useSharedValue(WALK_STEP / STEP_FRAMES);
  const boxSize = useSharedValue(S);
  const frame = useSharedValue(0);
  const breath = useSharedValue(1);
  const pHead = useSharedValue(puppetHead(REST));

  /**
   * What the puppet shows: null = his resting self (reactions allowed);
   * REST = waiting hidden behind a sheet; an activity pose = doing it.
   */
  const [hold, setHoldState] = useState<PoseKey | null>(null);
  const holding = useRef<PoseKey | null>(null);
  const setHold = (p: PoseKey | null) => {
    holding.current = p;
    setHoldState(p);
    pHead.set(puppetHead(p ?? REST));
  };

  /* ------------------------------------- sequencer state (JS, across renders) */

  type Mode = 'puppet' | 'sprite';
  const cur = useRef<{ spot: SpotKey; action: SheetKey | null; mode: Mode; sheet: SheetKey | null }>({
    spot,
    action: null,
    mode: 'puppet',
    sheet: null,
  });
  const want = useRef({ spot, action: ACTION_SHEET[base] ?? null });
  const running = useRef(false);
  const alive = useRef(true);
  const clipId = useRef(0);
  const dims = useRef({ W: roomW, H: roomH });
  const settled = useRef(onSettled);
  useEffect(() => {
    dims.current = { W: roomW, H: roomH };
    settled.current = onSettled;
    boxSize.set(S);
  });

  // Put him on a spot without walking.
  const place = (at: SpotKey) => {
    const s = SPOTS[at];
    fx.set(s.x * dims.current.W);
    fy.set(s.y * dims.current.H);
    sc.set(s.s);
  };
  useEffect(() => {
    place(cur.current.spot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomW, roomH]);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  /* ------------------------------------------------------------ helpers */

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** Start a clip on the UI thread (it starts on the next display frame). */
  const start = (clip: Clip, mode: Playing['mode']) => {
    clipId.current += 1;
    playing.set({ id: clipId.current, frames: clip.frames, fps: clip.fps, ease: clip.ease ? EASE[clip.ease] : 0, mode });
  };
  const still = (f: number) => start({ frames: [f], fps: 1 }, 0);
  const play = async (clip: Clip) => {
    start(clip, 0);
    await wait(clipMs(clip) + 1000 / clip.fps); // the last frame gets its full beat
  };

  /** Hand off to a sheet, holding frame f (from the puppet or another sheet). */
  const showSheet = async (key: SheetKey, f: number) => {
    const c = cur.current;
    const idx = SHEET_KEYS.indexOf(key);
    if (c.mode === 'sprite' && c.sheet === key) {
      still(f);
      return;
    }
    const s = sheet.get();
    sheet.set({ active: idx, prev: c.mode === 'sprite' ? s.active : -1, prevFrame: frame.get() });
    still(f);
    if (c.mode === 'sprite') {
      sheetMix.set(0);
      sheetMix.set(withTiming(1, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }));
      await wait(FADE_MS);
    } else {
      // the sheet comes up before the puppet goes, so he never thins out
      sheetMix.set(1);
      spriteO.set(withTiming(1, { duration: FADE_MS * 0.6 }));
      puppetO.set(withDelay(FADE_MS * 0.4, withTiming(0, { duration: FADE_MS * 0.6 })));
      await wait(FADE_MS);
      setHold(REST); // the puppet waits, hidden, in its sitting pose
    }
    c.mode = 'sprite';
    c.sheet = key;
  };

  /** Hand off from the sheet to the puppet, in pose p (null = resting). */
  const toPuppet = async (p: PoseKey | null) => {
    const c = cur.current;
    if (p !== holding.current) {
      setHold(p);
      await wait(PUPPET_SWAP_MS); // let the hidden puppet finish changing pose
    }
    puppetO.set(withTiming(1, { duration: FADE_MS * 0.6 }));
    spriteO.set(withDelay(FADE_MS * 0.4, withTiming(0, { duration: FADE_MS * 0.6 })));
    await wait(FADE_MS + 20);
    c.mode = 'puppet';
    c.sheet = null;
    sheet.set({ active: -1, prev: -1, prevFrame: 0 });
  };

  /* ---------------------------------------------------------- the steps */

  const exitAction = async () => {
    const a = cur.current.action!;
    const clip = EXIT[a]!;
    // from the puppet's activity pose back to the sheet's last frame
    await showSheet(a, clip.frames[0]);
    if (!reduce) await play(clip);
    else still(clip.frames[clip.frames.length - 1]);
    cur.current.action = null;
    await wait(reduce ? 0 : 200); // a breath of sitting before the next thing
  };

  const walkTo = async (dest: SpotKey) => {
    const { W, H } = dims.current;
    const to = SPOTS[dest];
    const tx = to.x * W;
    const ty = to.y * H;
    if (reduce) {
      // Reduce Motion: no walking — fade out, move, fade in.
      if (cur.current.mode === 'sprite') await toPuppet(null);
      puppetO.set(withTiming(0, { duration: FADE_MS }));
      await wait(FADE_MS);
      place(dest);
      puppetO.set(withTiming(1, { duration: FADE_MS }));
      await wait(FADE_MS);
    } else {
      const dx = tx - fx.get();
      const dy = ty - fy.get();
      const key = WALK_SHEET[walkDir(dx, dy)];
      const clips = walkClips(key);
      // starts on the puppet's own sitting drawing: no visible handoff
      await showSheet(key, clips.start.frames[0]);
      await play(clips.start);
      // walk: the cycle follows the distance covered (see the frame callback).
      // Pick the stride so the last cycle frame is the one 'stop' starts from.
      const n = clips.cycle.frames.length;
      const total = Math.hypot(dx, dy) / (S * to.s);
      const nominal = total / (WALK_STEP / STEP_FRAMES);
      const steps = WALK_LAST + n * Math.max(0, Math.round((nominal - WALK_LAST) / n));
      walkStep.set(total / (steps + 0.5));
      walkFrom.set({ x: fx.get(), y: fy.get() });
      start(clips.cycle, 1);
      // moving away reads slower on screen; scale distance by depth a little
      const dist = Math.hypot(dx, dy * 1.4);
      const ms = Math.max(800, (dist / WALK_SPEED) * 1000);
      const ease = { duration: ms, easing: Easing.inOut(Easing.sin) };
      fx.set(withTiming(tx, ease));
      fy.set(withTiming(ty, ease));
      sc.set(withTiming(to.s, ease));
      await wait(ms);
      await play(clips.stop);
    }
    cur.current.spot = dest;
    settled.current?.();
    await wait(reduce ? 0 : 160);
  };

  const enterAction = async (a: SheetKey) => {
    const clip = ENTER[a]!;
    await showSheet(a, clip.frames[0]);
    if (!reduce) await play(clip);
    else still(clip.frames[clip.frames.length - 1]);
    cur.current.action = a;
    const p = PUPPET_LOOP[a];
    if (p) await toPuppet(p); // the puppet carries on with it (one consistent drawing)
    settled.current?.();
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    try {
      // Re-read the goal after every step: the brain may have changed its mind.
      for (let guard = 0; guard < 12 && alive.current; guard++) {
        const w = want.current;
        const c = cur.current;
        if (c.action && (c.action !== w.action || c.spot !== w.spot)) await exitAction();
        else if (c.spot !== w.spot) await walkTo(w.spot);
        else if (w.action && !c.action) await enterAction(w.action);
        else if (!w.action && c.mode === 'sprite') await toPuppet(null);
        else break;
      }
    } finally {
      running.current = false;
    }
  };

  // The brain's goal changed → work toward it.
  const goalAction = ACTION_SHEET[base] ?? null;
  useEffect(() => {
    want.current = { spot, action: goalAction };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot, goalAction]);

  /* ------------------------------------------- UI thread: pick the frame */

  useFrameCallback((info) => {
    'worklet';
    const p = playing.value;
    const now = info.timestamp;
    if (startedId.value !== p.id) {
      startedId.value = p.id;
      startedAt.value = now;
    }
    const n = p.frames.length;
    let i = 0;
    if (n > 1) {
      if (p.mode === 1) {
        // walk: one cycle frame per WALK_STEP of distance (in box units at this depth)
        const d = Math.hypot(fx.value - walkFrom.value.x, fy.value - walkFrom.value.y) / (boxSize.value * sc.value);
        i = Math.floor(d / walkStep.value) % n;
      } else {
        // n frames, each held 1/fps; easing stretches the first/last ones
        let u = Math.min(1, (now - startedAt.value) / ((1000 * n) / p.fps));
        if (p.ease === 1) u = u * u;
        else if (p.ease === 2) u = 1 - (1 - u) * (1 - u);
        else if (p.ease === 3) u = 0.5 - Math.cos(u * Math.PI) / 2;
        i = Math.min(n - 1, Math.floor(u * n));
      }
    }
    frame.value = p.frames[i];

    // sleeping: a slow breath on the held frame
    const s = sheet.value;
    breath.value = s.active === SLEEP && n === 1 ? 1 + Math.sin(now / 900) * 0.012 : 1;

    // where his head is (badge + speech bubble follow it)
    let hx = pHead.value[0];
    let hy = pHead.value[1];
    if (s.active >= 0) {
      const H = HEADS[s.active][frame.value];
      let sx = H[0];
      let sy = H[1];
      if (s.prev >= 0 && sheetMix.value < 1) {
        const P = HEADS[s.prev][s.prevFrame];
        sx = P[0] + (sx - P[0]) * sheetMix.value;
        sy = P[1] + (sy - P[1]) * sheetMix.value;
      }
      hx += (sx - hx) * spriteO.value;
      hy += (sy - hy) * spriteO.value;
    }
    const k = Math.min(1, ((info.timeSincePreviousFrame ?? 16) / 1000) * 10);
    headX.set(headX.get() + (hx - headX.get()) * k);
    headY.set(headY.get() + (hy - headY.get()) * k);
  });

  /* ----------------------------------------------------------- drawing */

  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    shown.value = withTiming(hidden ? 0 : 1, { duration: 700 });
  }, [hidden, shown]);
  const boxStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    // once he's fully gone, move him off stage: on web a parent's
    // pointerEvents="none" doesn't stop his own Pressable from catching taps
    transform: [{ translateX: fx.value - FOOT_X * S - (shown.value === 0 ? 10000 : 0) }, { translateY: fy.value - FOOT_Y * S }, { scale: sc.value }],
  }));
  const spriteWrap = useAnimatedStyle(() => ({
    opacity: spriteO.value,
    transform: [{ translateY: FOOT_Y * S * (1 - breath.value) }, { scaleY: breath.value }],
  }));
  const headAnchor = useAnimatedStyle(() => ({ left: headX.value * S, top: headY.value * S }));

  const rest: PoseKey = ACTION_SHEET[base] || base === 'sit' ? REST : base;
  const puppetPose: PoseKey = hold ?? reaction ?? rest;

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[{ position: 'absolute', left: 0, top: 0, width: S, height: S, zIndex: 20, transformOrigin: `${FOOT_X * 100}% ${FOOT_Y * 100}%` }, boxStyle]}
    >
      <View ref={boxRef} onLayout={onBoxLayout} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={[styles.shadow, { left: S * 0.2, right: S * 0.2, top: S * (FOOT_Y - 0.03), height: S * 0.07 }]}
      />
      {/* he's lit like the room around him (dimmer and cooler at night…) */}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, light ? { filter: light } : null]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spriteWrap]}>
          {SHEET_KEYS.map((key, i) => (
            <SheetLayer key={key} sheet={key} index={i} size={S} at={sheet} sheetMix={sheetMix} frame={frame} />
          ))}
        </Animated.View>
        <RustyPuppet ref={puppet} pose={puppetPose} size={S} bodyOpacity={puppetO} {...puppetProps} />
      </View>
      <Animated.View style={[styles.anchor, headAnchor]} pointerEvents="box-none">
        {children}
      </Animated.View>
    </Animated.View>
  );
});

/**
 * One sheet, always mounted (so switching sheets never flashes): a window the
 * size of the current frame, placed where that frame sits in his box, with the
 * whole atlas slid inside it to show just that frame.
 */
function SheetLayer({
  sheet,
  index,
  size,
  at,
  sheetMix,
  frame,
}: {
  sheet: SheetKey;
  index: number;
  size: number;
  at: SharedValue<{ active: number; prev: number; prevFrame: number }>;
  sheetMix: SharedValue<number>;
  frame: SharedValue<number>;
}) {
  const s = SHEETS[sheet];
  const frames = s.frames;
  const k = size / R; // pt per atlas px

  const win = useAnimatedStyle(() => {
    const a = at.value;
    // during a sheet → sheet handoff the incoming one comes up fast and the
    // outgoing one leaves late, so he's still solid mid-handoff
    let o = 0;
    if (a.active === index) o = a.prev >= 0 ? Math.min(1, sheetMix.value / 0.6) : 1;
    else if (a.prev === index) o = Math.min(1, (1 - sheetMix.value) / 0.6);
    const f = a.active === index ? frame.value : a.prev === index ? a.prevFrame : 0;
    const [, , w, h, bx, by] = frames[Math.min(f, frames.length - 1)];
    return { opacity: o, left: bx * size, top: by * size, width: w * k, height: h * k };
  });
  const slide = useAnimatedStyle(() => {
    const a = at.value;
    const f = a.active === index ? frame.value : a.prev === index ? a.prevFrame : 0;
    const [x, y] = frames[Math.min(f, frames.length - 1)];
    return { transform: [{ translateX: -x * k }, { translateY: -y * k }] };
  });
  const img = { width: s.w * k, height: s.h * k };
  return (
    <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, win]}>
      <Animated.View style={[img, slide]}>
        <Image source={s.src} style={img} contentFit="fill" cachePolicy="memory-disk" accessible={false} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(110,70,35,0.18)' },
  anchor: { position: 'absolute', width: 0, height: 0 },
});
