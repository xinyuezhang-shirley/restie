/**
 * Rusty, alive: the painted frame warped every frame by a Skia shader.
 *
 * - breathes, blinks, sways his tail, glances around (or toward your tap)
 * - crossfades between poses (TRANSITIONS in rig.ts can add in-between frames)
 * - tap his head → onPressHead (pet), tap elsewhere → onPressBody,
 *   press and hold → onLongPress (Home uses it to open his menu)
 *
 * Falls back to a gently breathing still image if Skia isn't available
 * (e.g. CanvasKit failed to load on the web).
 */
import { Canvas, Fill, ImageShader, Shader, Skia, useClock, useImage, type SkImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Particles, type ParticlesHandle, type ParticleType } from './Particles';
import { FRAMES, hitsHead, POSE_KEYS, RIG, TRANSITIONS, type PoseKey } from './rig';
import { PUPPET_SKSL } from './shader';

export interface RustyPuppetHandle {
  burst: (type: ParticleType, count?: number) => void;
  kickTail: () => void;
  /** glance toward a point in the puppet's own coordinates (0..size) */
  lookAt: (x: number, y: number) => void;
}

interface Props {
  pose: PoseKey;
  size: number;
  onPressHead?: () => void;
  onPressBody?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** turn off ambient particles (small avatars) */
  quiet?: boolean;
  /**
   * Fades the painted body only — taps and particles keep working. The room
   * uses it to hand off to sprite animations (walking, painting…).
   */
  bodyOpacity?: SharedValue<number>;
}

/** Wraps the painted body so it can fade without affecting taps/particles. */
function Body({ opacity, size, children }: { opacity?: SharedValue<number>; size: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity ? opacity.value : 1 }));
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      {children}
    </Animated.View>
  );
}

const skiaReady = () => Platform.OS !== 'web' || typeof (globalThis as { CanvasKit?: unknown }).CanvasKit !== 'undefined';

export const RustyPuppet = forwardRef<RustyPuppetHandle, Props>(function RustyPuppet(props, ref) {
  return skiaReady() ? <SkiaPuppet {...props} ref={ref} /> : <StillPuppet {...props} ref={ref} />;
});

/* --------------------------------------------------------------- the rig */

/** Two poses drawn on the same body (only the face differs). */
const sameBody = (a: PoseKey, b: PoseKey) => {
  const x = RIG[a];
  const y = RIG[b];
  return x.ground === y.ground && x.head[0] === y.head[0] && x.head[1] === y.head[1] && x.cx === y.cx;
};

const effect = (() => {
  try {
    return skiaReady() ? Skia.RuntimeEffect.Make(PUPPET_SKSL) : null;
  } catch (e) {
    console.warn('[restie] puppet shader failed to compile', e);
    return null;
  }
})();

function useFrames(): Record<PoseKey, SkImage | null> {
  const out = {} as Record<PoseKey, SkImage | null>;
  // POSE_KEYS is a constant list, so the hook order never changes.
  for (const k of POSE_KEYS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    out[k] = useImage(FRAMES[k]);
  }
  return out;
}

interface Motion {
  ax: SharedValue<number>;
  ay: SharedValue<number>;
  blinkAmt: SharedValue<number>;
  pop: SharedValue<number>;
  tailKick: SharedValue<number>;
}

const SkiaPuppet = forwardRef<RustyPuppetHandle, Props>(function SkiaPuppet(
  { pose, size, onPressHead, onPressBody, onLongPress, accessibilityLabel, accessibilityHint, quiet, bodyOpacity },
  ref,
) {
  const frames = useFrames();
  const reduce = useReducedMotion();
  const clock = useClock();
  const particles = useRef<ParticlesHandle>(null);

  // Pose crossfade: `shown` is what's on screen; `prev` fades out under it.
  const [shown, setShown] = useState<PoseKey>(pose);
  const [prev, setPrev] = useState<PoseKey | null>(null);
  const fade = useSharedValue(1);

  // Motion state, advanced on the UI thread every frame.
  const ax = useSharedValue(0);
  const ay = useSharedValue(0);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const lookLeft = useSharedValue(0); // seconds left looking at (gx, gy)
  const blinkAmt = useSharedValue(0);
  const blinkStart = useSharedValue(-1);
  const blinkNext = useSharedValue(1200);
  const pop = useSharedValue(0);
  const tailKick = useSharedValue(0);

  useFrameCallback((info) => {
    'worklet';
    const now = info.timestamp;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const t = now / 1000;
    let tx = Math.sin(t * 0.37) * 0.55 + Math.sin(t * 0.91) * 0.2;
    let ty = Math.sin(t * 0.53 + 1) * 0.3;
    if (lookLeft.value > 0) {
      lookLeft.value -= dt;
      tx = gx.value;
      ty = gy.value;
    }
    const k = 1 - Math.pow(0.004, dt);
    ax.value += (tx - ax.value) * k;
    ay.value += (ty - ay.value) * k;
    if (blinkStart.value < 0 && now > blinkNext.value) blinkStart.value = now;
    if (blinkStart.value >= 0) {
      const u = (now - blinkStart.value) / 170;
      blinkAmt.value = u < 0.4 ? u / 0.4 : u < 1 ? 1 - (u - 0.4) / 0.6 : 0;
      if (u >= 1) {
        blinkStart.value = -1;
        blinkAmt.value = 0;
        blinkNext.value = now + (Math.random() < 0.2 ? 200 : 2000 + Math.random() * 3500);
      }
    }
    pop.value = Math.max(0, pop.value - dt * 3);
    tailKick.value = Math.max(0, tailKick.value - dt * 1.2);
  });

  // React to pose changes: play transition frames (if any), then crossfade.
  useEffect(() => {
    if (pose === shown) {
      pop.set(1);
      return;
    }
    const chain = [...(TRANSITIONS[`${shown}>${pose}`] ?? []), pose];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    let from = shown;
    const step = () => {
      const next = chain[i++];
      setShown(next);
      pop.set(1);
      // Same body, different face (a tap reaction): swap the face on a little
      // head pop, the way a cartoon changes expression. Crossfading here showed
      // two faces on top of each other.
      if (sameBody(from, next)) {
        setPrev(null);
        fade.set(1);
        from = next;
        if (i < chain.length) timer = setTimeout(step, 220);
        return;
      }
      setPrev(from);
      from = next;
      fade.set(0);
      fade.set(withTiming(1, { duration: 320 }));
      if (i < chain.length) timer = setTimeout(step, 220);
      else timer = setTimeout(() => setPrev(null), 360);
    };
    step();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  // Ambient particles (sparkles while cheering, z's while asleep…).
  useEffect(() => {
    const fx = RIG[shown].fx;
    if (!fx || quiet || reduce) return;
    const id = setInterval(
      () => {
        const [hx, hy, r] = RIG[shown].head;
        if (fx === 'z') particles.current?.spawn('z', hx + 60, hy - 70);
        else particles.current?.spawn(fx, hx + (Math.random() * 2 - 1) * r * 1.6, hy - r * 0.6 + (Math.random() - 0.5) * r);
      },
      fx === 'z' ? 1300 : 700,
    );
    return () => clearInterval(id);
  }, [shown, quiet, reduce]);

  useImperativeHandle(
    ref,
    () => ({
      burst: (type, count = 4) => {
        const [hx, hy] = RIG[shown].head;
        for (let i = 0; i < count; i++) {
          setTimeout(() => particles.current?.spawn(type, hx + (Math.random() * 80 - 40), hy - 30), i * 110);
        }
        pop.set(1);
      },
      kickTail: () => {
        tailKick.set(1);
      },
      lookAt: (x, y) => {
        const [hx, hy] = RIG[shown].head;
        const unit = size / 700;
        gx.set(Math.max(-1, Math.min(1, (x - hx * unit) / (size * 0.5))));
        gy.set(Math.max(-1, Math.min(1, (y - hy * unit) / (size * 0.5))));
        lookLeft.set(2.5);
      },
    }),
    [shown, size, pop, tailKick, gx, gy, lookLeft],
  );

  const motion: Motion = { ax, ay, blinkAmt, pop, tailKick };
  const curUniforms = usePoseUniforms(shown, size, clock, motion, fade, !!reduce, false);
  const prevUniforms = usePoseUniforms(prev ?? shown, size, clock, motion, fade, !!reduce, true);

  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const unit = size / 700;
    if (hitsHead(shown, locationX / unit, locationY / unit)) onPressHead?.();
    else {
      tailKick.set(1);
      onPressBody?.();
    }
  };

  const cur = frames[shown];
  const before = prev ? frames[prev] : null;
  const rect = useMemo(() => ({ x: 0, y: 0, width: size, height: size }), [size]);

  if (!effect)
    return (
      <StillPuppet
        pose={pose}
        size={size}
        onPressHead={onPressHead}
        onPressBody={onPressBody}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        bodyOpacity={bodyOpacity}
      />
    );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Rusty, an orange tabby cat'}
      accessibilityHint={accessibilityHint}
      {...a11yActions(onPressHead, onLongPress)}
      style={{ width: size, height: size }}
    >
      <Body opacity={bodyOpacity} size={size}>
        <Canvas style={{ width: size, height: size }} pointerEvents="none">
          {before && (
            <Fill>
              <Shader source={effect} uniforms={prevUniforms}>
                <ImageShader image={before} fit="fill" rect={rect} />
              </Shader>
            </Fill>
          )}
          {cur && (
            <Fill>
              <Shader source={effect} uniforms={curUniforms}>
                <ImageShader image={cur} fit="fill" rect={rect} />
              </Shader>
            </Fill>
          )}
        </Canvas>
      </Body>
      <Particles ref={particles} size={size} />
    </Pressable>
  );
});

const S = 1 / 700;

/** Screen readers: double-tap pets him; "Talk to Rusty" is a separate action. */
function a11yActions(onPet?: () => void, onTalk?: () => void) {
  if (!onTalk) return {};
  return {
    accessibilityActions: [{ name: 'activate' }, { name: 'longpress', label: 'Talk to Rusty' }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
      if (e.nativeEvent.actionName === 'longpress') onTalk();
      else onPet?.();
    },
  };
}

function usePoseUniforms(
  pose: PoseKey,
  size: number,
  clock: SharedValue<number>,
  m: Motion,
  fade: SharedValue<number>,
  reduce: boolean,
  isPrev: boolean,
) {
  const r = RIG[pose];
  const { ax, ay, blinkAmt, pop, tailKick } = m;
  return useDerivedValue(() => {
    const m = { ax, ay, blinkAmt, pop, tailKick };
    const t = clock.value / 1000;
    const amp = reduce ? 0.35 : 1;
    const f = r.sleep ? 0 : 1;
    const A = r.hAmp ?? 1;
    const e = (i: number): [number, number, number, number] =>
      r.eyes && r.blink ? [r.eyes[i][0] * S, r.eyes[i][1] * S, r.eyes[i][2] * S, r.eyes[i][3] * S] : [0, 0, 0, 0];
    const fv = fade.value;
    const alpha = isPrev ? 1 : fv * fv * (3 - 2 * fv);
    const bA = (r.breathAmp ?? 1) * amp;
    const bS = r.breathSpd ?? 1;
    const limbOn = r.limb && !reduce;
    return {
      size: [size, size],
      alpha,
      neck: [r.neck[0] * S, r.neck[1] * S],
      hRot: (m.ax.value * 0.075 * f + Math.sin(t * 0.8) * 0.022 * amp) * A,
      hOff: [m.ax.value * 0.01 * f * A, (m.ay.value * 0.008 * f - m.pop.value * 0.006) * A],
      e0: e(0),
      e1: e(1),
      blink: m.blinkAmt.value,
      tB: [r.tail.base[0] * S, r.tail.base[1] * S],
      tC: [r.tail.c[0] * S, r.tail.c[1] * S, r.tail.r * S],
      tRot: Math.sin(t * (r.tail.spd ?? 1.8)) * r.tail.amp * amp + Math.sin(t * 14) * m.tailKick.value * 0.12,
      l0p: limbOn ? [r.limb!.piv[0] * S, r.limb!.piv[1] * S] : [0, 0],
      l0c: limbOn ? [r.limb!.c[0] * S, r.limb!.c[1] * S, r.limb!.c[2] * S] : [-1, -1, 0.001],
      l0: !limbOn
        ? [0, 0, 0]
        : r.limb!.move
          ? [
              Math.sin(t * 1.6 * r.limb!.move.spd) * r.limb!.move.rot * amp,
              Math.cos(t * 1.6 * r.limb!.move.spd) * r.limb!.move.dx * S * amp,
              Math.sin(t * 1.6 * r.limb!.move.spd) * r.limb!.move.dy * S * amp,
            ]
          : [0, Math.sin(t * 1.2) * 2 * S, Math.sin(t * 1.6) * 5 * S],
      ground: r.ground * S,
      cx: r.cx * S,
      breath: (Math.sin(t * 2.1 * bS) * 0.5 + 0.5) * 0.012 * bA + m.pop.value * 0.02,
      bodyRot: m.ax.value * 0.012 * f + (r.sway && !reduce ? Math.sin(t * 2.2) * r.sway : 0),
      shift: [0, r.bounce && !reduce ? -Math.abs(Math.sin(t * 4)) * 0.018 : 0],
      useHead: r.noHead ? 0 : 1,
      hb: [r.hb[0] * S, r.hb[1] * S, r.hb[2] * S],
    };
  }, [pose, size, reduce, isPrev]);
}

/* ------------------------------------------------------------ fallback */

const StillPuppet = forwardRef<RustyPuppetHandle, Props>(function StillPuppet(
  { pose, size, onPressHead, onPressBody, onLongPress, accessibilityLabel, accessibilityHint, bodyOpacity },
  ref,
) {
  const particles = useRef<ParticlesHandle>(null);
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.value = withRepeat(withSequence(withTiming(1.015, { duration: 1500 }), withTiming(1, { duration: 1500 })), -1);
  }, [breath]);
  useImperativeHandle(ref, () => ({
    burst: (type, count = 4) => {
      const [hx, hy] = RIG[pose].head;
      for (let i = 0; i < count; i++) setTimeout(() => particles.current?.spawn(type, hx + (Math.random() * 80 - 40), hy - 30), i * 110);
    },
    kickTail: () => {},
    lookAt: () => {},
  }));
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: size * 0.42 }, { scaleY: breath.value }, { translateY: -size * 0.42 }],
  }));
  return (
    <Pressable
      onPress={(e) => {
        const unit = size / 700;
        if (hitsHead(pose, e.nativeEvent.locationX / unit, e.nativeEvent.locationY / unit)) onPressHead?.();
        else onPressBody?.();
      }}
      onLongPress={onLongPress}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Rusty, an orange tabby cat'}
      accessibilityHint={accessibilityHint}
      {...a11yActions(onPressHead, onLongPress)}
      style={{ width: size, height: size }}
    >
      <Body opacity={bodyOpacity} size={size}>
        <Animated.View style={[{ width: size, height: size }, style]}>
          <Image source={FRAMES[pose]} style={{ width: size, height: size }} contentFit="contain" transition={250} />
        </Animated.View>
      </Body>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <Particles ref={particles} size={size} />
      </View>
    </Pressable>
  );
});
