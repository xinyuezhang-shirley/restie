/**
 * The world outside Rusty's window, and the light it puts in his room.
 *
 * One rule: every light comes from something you can see.
 *  - By day the light comes in through the window: the sun patch on the floor
 *    moves and changes color with the time of day and dims with weather.
 *  - At night the desk lamp is on (the night painting fades in at dusk).
 *  - Rusty and the hobby objects get the same light as the room (lightFor).
 *
 * Weather lives outside the glass: the window pane is cut out of the room
 * paintings, and the sky, the view (branches + hills) and the weather are
 * drawn behind it. Rain also runs down the glass.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Condition, Phase } from '@/world/world';

import { FLOOR_Y, GLASS } from './layout';
import { VIEW, VIEW_DARK } from './objects';

const overcast = (c: Condition) => c !== 'clear';
const wet = (c: Condition) => c === 'rain' || c === 'storm';

/* ----------------------------------------------------------- the light */

/** How much of the night painting (desk lamp on) shows. */
export const NIGHT: Record<Phase, number> = { dawn: 0.3, day: 0, golden: 0.1, dusk: 0.6, night: 1 };

/** A soft color wash over the whole room, Rusty included, for the time of day / weather. */
export function roomWash(phase: Phase, c: Condition): string | null {
  if (wet(c)) return 'rgba(70,90,125,0.10)';
  if (c === 'fog') return 'rgba(210,214,222,0.08)';
  return { dawn: 'rgba(255,190,170,0.07)', day: null, golden: 'rgba(255,165,80,0.10)', dusk: 'rgba(120,90,160,0.10)', night: null }[phase];
}

/**
 * How much darker Rusty and the objects are than daylight, as a view filter
 * (supported on iOS, Android and web). The color of the light comes from the
 * wash and the sun patch, which are drawn over him too; this only dims him
 * the way the night painting dims the room. Objects inside the lamp's glow
 * (`lit`) stay bright at night.
 */
export function lightFor(phase: Phase, c: Condition, lit = false) {
  let [b, s] = { dawn: [0.98, 1], day: [1, 1], golden: [1, 1], dusk: [0.88, 0.92], night: lit ? [0.95, 0.92] : [0.66, 0.8] }[phase];
  if (c === 'cloudy') b *= 0.97;
  if (b === 1 && s === 1) return undefined;
  // the CSS string form works on web as well as iOS / Android
  return `brightness(${b.toFixed(2)}) saturate(${s.toFixed(2)})`;
}

const PATCH: Record<Phase, { len: number; skew: number; color: string; o: number }> = {
  dawn: { len: 340, skew: 40, color: '255,214,196', o: 1 },
  day: { len: 230, skew: 24, color: '255,248,226', o: 0.85 },
  golden: { len: 430, skew: 50, color: '255,196,120', o: 1 },
  dusk: { len: 380, skew: 56, color: '246,170,146', o: 0.35 },
  night: { len: 0, skew: 0, color: '0,0,0', o: 0 },
};
const PATCH_WEATHER: Record<Condition, number> = { clear: 1, cloudy: 0.35, fog: 0.2, rain: 0, storm: 0, snow: 0.45 };

/** Sunlight through the window, landing on the floor in front of it. */
export function SunPatch({ phase, condition, k }: { phase: Phase; condition: Condition; k: number }) {
  const p = PATCH[phase];
  const o = p.o * PATCH_WEATHER[condition];
  if (o <= 0.01 || p.len === 0) return null;
  const w = GLASS.w * 1.05;
  const c = (a: number) => `rgba(${p.color},${a})`;
  // Soft on every side: it fades in from the wall, out along its length, and
  // its sides are a stack of narrower and narrower layers (no hard edges).
  const LAYERS = 5;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: GLASS.x * k,
        top: FLOOR_Y * k,
        width: w * k,
        height: p.len * k,
        opacity: o,
        // top edge stays under the window; the far end leans into the room,
        // longer and more slanted when the sun is low
        transformOrigin: 'top',
        transform: [{ skewX: `${p.skew}deg` }],
        // brightens what it falls on, like light (not a pale sticker)
        mixBlendMode: 'screen',
      }}
    >
      {Array.from({ length: LAYERS }, (_, i) => {
        const inset = (i / LAYERS) * w * 0.32 * k;
        return (
          <LinearGradient
            key={i}
            colors={[c(0), c(0.9 / LAYERS), c(0.55 / LAYERS), c(0)]}
            locations={[0, 0.14, 0.5, 1]}
            style={{ position: 'absolute', top: 0, bottom: 0, left: inset, right: inset, borderRadius: 30 * k }}
          />
        );
      })}
    </View>
  );
}

/** Lightning: a brief flash in the window and across the room. */
export function StormFlash({ k, whole }: { k: number; whole?: boolean }) {
  const reduce = useReducedMotion();
  const f = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    f.value = withRepeat(
      withSequence(withDelay(5200, withTiming(1, { duration: 60 })), withTiming(0.2, { duration: 90 }), withTiming(0.8, { duration: 50 }), withTiming(0, { duration: 380 })),
      -1,
    );
  }, [f, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: f.value * (whole ? 0.16 : 0.75) }));
  const box = whole ? StyleSheet.absoluteFill : { position: 'absolute' as const, left: GLASS.x * k, top: GLASS.y * k, width: GLASS.w * k, height: GLASS.h * k };
  return <Animated.View pointerEvents="none" style={[box, { backgroundColor: '#F4F7FF' }, style]} />;
}

/* ----------------------------------------------------------- the window */

const SKY: Record<Phase, [string, string]> = {
  dawn: ['#F4B9A8', '#FBE2C6'],
  day: ['#8EC3EA', '#D6ECF7'],
  golden: ['#F2A65E', '#FBDDA6'],
  dusk: ['#5E4F8E', '#EE9474'],
  night: ['#0F1633', '#26305A'],
};
const SKY_GREY: Record<Phase, [string, string]> = {
  dawn: ['#B9A9AE', '#D9CFCB'],
  day: ['#9FAAB6', '#D3D9DF'],
  golden: ['#B49A86', '#D9C9B5'],
  dusk: ['#4D4763', '#8E7A86'],
  night: ['#12172A', '#232A40'],
};
/** How dark the view is (0 = daylight colors, 1 = night silhouette). */
const VIEW_DARKNESS: Record<Phase, number> = { dawn: 0.3, day: 0, golden: 0.18, dusk: 0.65, night: 1 };
/** Sun / moon: x, y as fractions of the glass, size, color. */
const ORB: Record<Phase, { x: number; y: number; r: number; color: string; glow: string } | null> = {
  dawn: { x: 0.28, y: 0.62, r: 0.16, color: '#FFE0C2', glow: 'rgba(255,214,180,0.55)' },
  day: { x: 0.68, y: 0.2, r: 0.15, color: '#FFF7DC', glow: 'rgba(255,248,214,0.5)' },
  golden: { x: 0.7, y: 0.58, r: 0.18, color: '#FFD08A', glow: 'rgba(255,196,110,0.6)' },
  dusk: null,
  night: { x: 0.66, y: 0.17, r: 0.11, color: '#F6F1DE', glow: 'rgba(240,236,214,0.25)' },
};

/**
 * Everything seen through the glass, drawn BEHIND the room painting (whose
 * pane is transparent): sky → sun/moon/stars → clouds → the view → rain/snow →
 * fog → drops on the glass.
 */
export function WindowView({ phase, condition, k }: { phase: Phase; condition: Condition; k: number }) {
  const w = GLASS.w * k;
  const h = GLASS.h * k;
  const grey = overcast(condition);
  const [top, bottom] = (grey ? SKY_GREY : SKY)[phase];
  const orb = ORB[phase];
  const dark = VIEW_DARKNESS[phase];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: GLASS.x * k, top: GLASS.y * k, width: w, height: h, overflow: 'hidden' }}>
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} />
      {phase === 'night' && <Stars w={w} h={h} n={grey ? 3 : 16} />}
      {orb && (condition === 'clear' || condition === 'cloudy') && (
        <View style={{ position: 'absolute', left: orb.x * w - orb.r * w * 1.6, top: orb.y * h - orb.r * w * 1.6, opacity: condition === 'cloudy' ? 0.45 : 1 }}>
          <View style={{ width: orb.r * w * 3.2, height: orb.r * w * 3.2, borderRadius: w, backgroundColor: orb.glow, opacity: 0.6 }} />
          <View style={{ position: 'absolute', left: orb.r * w * 0.6, top: orb.r * w * 0.6, width: orb.r * w * 2, height: orb.r * w * 2, borderRadius: w, backgroundColor: orb.color }} />
        </View>
      )}
      {grey && condition !== 'fog' && <Clouds w={w} h={h} phase={phase} heavy={condition !== 'cloudy'} />}
      {dark < 1 && <Image source={VIEW} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="bottom" accessible={false} />}
      {dark > 0 && <Image source={VIEW_DARK} style={[StyleSheet.absoluteFill, { opacity: dark }]} contentFit="cover" contentPosition="bottom" accessible={false} />}
      {(condition === 'rain' || condition === 'storm') && <Falling w={w} h={h} />}
      {condition === 'snow' && (
        <>
          <Falling w={w} h={h} snow />
          {/* snow building up on the outside ledge */}
          <View style={{ position: 'absolute', left: -4, right: -4, bottom: -h * 0.02, height: h * 0.07, borderTopLeftRadius: w, borderTopRightRadius: w, backgroundColor: '#F7F9FC' }} />
        </>
      )}
      {condition === 'fog' && <View style={[StyleSheet.absoluteFill, { backgroundColor: phase === 'night' ? 'rgba(70,78,98,0.6)' : 'rgba(236,238,242,0.62)' }]} />}
      {wet(condition) && <GlassDrops w={w} h={h} />}
      {condition === 'storm' && <StormFlash k={k} />}
    </View>
  );
}

function Stars({ w, h, n }: { w: number; h: number; n: number }) {
  const stars = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: ((i * 37) % 97) / 97, y: ((i * 53) % 89) / 89, r: i % 3 === 0 ? 1.6 : 1 })), [n]);
  return (
    <>
      {stars.map((s, i) => (
        <View key={i} style={{ position: 'absolute', left: s.x * w, top: s.y * h * 0.6, width: s.r * 2, height: s.r * 2, borderRadius: 2, backgroundColor: '#FFF8E0', opacity: 0.85 }} />
      ))}
    </>
  );
}

/** Soft clouds drifting past (the whole layer slides, looping). */
function Clouds({ w, h, phase, heavy }: { w: number; h: number; phase: Phase; heavy: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 38000, easing: Easing.linear }), -1);
  }, [t, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -t.value * w }] }));
  const color = phase === 'night' ? '#2A3150' : phase === 'dusk' ? '#8C7790' : heavy ? '#B7BEC8' : '#F4F5F7';
  const puffs = [
    { x: 0.05, y: 0.08, s: 0.55 },
    { x: 0.45, y: 0.2, s: 0.45 },
    { x: 0.75, y: 0.04, s: 0.6 },
    ...(heavy ? [{ x: 0.2, y: 0.3, s: 0.6 }, { x: 0.62, y: 0.38, s: 0.5 }] : []),
  ];
  const layer = (dx: number) =>
    puffs.map((p, i) => (
      <View key={`${dx}-${i}`} style={{ position: 'absolute', left: (p.x + dx) * w, top: p.y * h, width: p.s * w, height: p.s * w * 0.42, borderRadius: w, backgroundColor: color, opacity: heavy ? 0.9 : 0.8 }} />
    ));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w * 2, height: h }, style]}>
      {layer(0)}
      {layer(1)}
    </Animated.View>
  );
}

/** Rain or snow falling outside. */
function Falling({ w, h, snow }: { w: number; h: number; snow?: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: snow ? 6500 : 800, easing: Easing.linear }), -1);
  }, [t, reduce, snow]);
  const drops = useMemo(() => Array.from({ length: snow ? 22 : 30 }, (_, i) => ({ x: ((i * 41) % 100) / 100, y: ((i * 67) % 100) / 100 })), [snow]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: t.value * h }] }));
  const layer = (offset: number) => (
    <Animated.View key={offset} style={[{ position: 'absolute', left: 0, top: offset, width: w, height: h }, style]}>
      {drops.map((d, i) =>
        snow ? (
          <View key={i} style={{ position: 'absolute', left: d.x * w, top: d.y * h, width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: 'white', opacity: 0.9 }} />
        ) : (
          <View key={i} style={{ position: 'absolute', left: d.x * w, top: d.y * h, width: 1.2, height: 11, backgroundColor: 'rgba(225,235,250,0.7)', transform: [{ rotate: '10deg' }] }} />
        ),
      )}
    </Animated.View>
  );
  return (
    <>
      {layer(0)}
      {layer(-h)}
    </>
  );
}

/** Drops running down the glass itself (slow, a few at a time). */
function GlassDrops({ w, h }: { w: number; h: number }) {
  const reduce = useReducedMotion();
  const drops = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ x: ((i * 29) % 90) / 100 + 0.04, delay: (i * 1300) % 7000, dur: 4200 + ((i * 700) % 2600), len: 10 + (i % 3) * 6 })),
    [],
  );
  return (
    <>
      {drops.map((d, i) => (
        <GlassDrop key={i} x={d.x * w} h={h} len={d.len} delay={d.delay} dur={d.dur} still={!!reduce} />
      ))}
    </>
  );
}

function GlassDrop({ x, h, len, delay, dur, still }: { x: number; h: number; len: number; delay: number; dur: number; still: boolean }) {
  const t = useSharedValue(0.3);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.in(Easing.quad) }), -1));
  }, [t, delay, dur, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -len + t.value * (h + len) }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: 2.5, height: len, borderRadius: 2, backgroundColor: 'rgba(240,246,255,0.55)' }, style]}>
      <View style={{ position: 'absolute', bottom: -1, left: -1, width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(245,250,255,0.7)' }} />
    </Animated.View>
  );
}
