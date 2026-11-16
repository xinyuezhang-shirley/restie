/**
 * First-run tour: Rusty points at the real controls on Home, one at a time.
 *
 * Any component can register itself as a target:
 *   const t = useTutorialTarget('clock');  <View ref={t.ref} onLayout={t.onLayout} />
 * The overlay (rendered once in the root layout) dims everything except the
 * current target and shows Rusty's explanation next to it.
 *
 * The tour is its own layer on top of Home:
 * - The spotlighted control still works. If it opens another screen, the tour
 *   hides; Back brings you to Home and the tour picks up at the same step.
 * - Petting Rusty on his step hides the spotlight while he reacts, then the
 *   tour moves on — the two never overlap.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Button, ProgressDots, Row, RustyAvatar, T, tap } from '@/components/ui';
import { patchProfile, useStore } from '@/data/store';
import { now } from '@/lib/time';
import type { PoseImage } from '@/assets';
import { colors, radius, shadows, space } from '@/theme/tokens';

export type TargetKey = 'rusty' | 'board' | 'clock' | 'frames' | 'window' | 'week' | 'log' | 'tabs';

interface Step {
  target?: TargetKey;
  title: string;
  text: string;
  pose: PoseImage;
  /** the step also advances when the person does this */
  waitFor?: 'pet';
}

export const STEPS: Step[] = [
  {
    title: 'Hi, I’m Rusty!',
    text: 'This is my room. I’ll keep you company while you make time for the things you love. Quick tour?',
    pose: 'wave',
  },
  {
    target: 'rusty',
    title: 'That’s me',
    text: 'Tap me and I’ll react. To talk, log or check in, press and hold me, or tap the little bubble next to me. Try a tap!',
    pose: 'celebrate',
    waitFor: 'pet',
  },
  {
    target: 'board',
    title: 'The corkboard',
    text: 'Your Hobbies and To-dos are pinned here. Tap a note to open it.',
    pose: 'think',
  },
  {
    target: 'clock',
    title: 'Focus timer',
    text: 'Tap the clock to start a focus timer. I’ll work beside you, even for just 5 minutes.',
    pose: 'painting',
  },
  {
    target: 'frames',
    title: 'Keepsakes',
    text: 'Photos and notes you save become keepsakes. Pin favorites and they hang in these frames.',
    pose: 'idle',
  },
  {
    target: 'window',
    title: 'My window',
    text: 'It shows the real sky where you are: sunny, rainy, sunset, night. I have opinions about all of them.',
    pose: 'sleep',
  },
  {
    target: 'log',
    title: 'Log a step',
    text: 'Did something? Tap Log a step, pick it, done. You can always undo. Your plans for this week sit right next to it.',
    pose: 'celebrate',
  },
  {
    target: 'tabs',
    title: 'Everything else',
    text: 'Hobbies, To-dos and Keepsakes are always down here, on every page. The ? at the top explains everything.',
    pose: 'idle',
  },
  {
    title: 'That’s the tour!',
    text: 'Want to set up a goal with me? We’ll break it into milestones and small steps together.',
    pose: 'wave',
  },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TutorialState {
  active: boolean;
  step: number;
  rects: Partial<Record<TargetKey, Rect>>;
  /** Home is the focused screen (the tour only shows there) */
  homeVisible: boolean;
  /** Rusty is reacting to a pet — the spotlight steps aside meanwhile */
  reacting: boolean;
}

export const useTutorial = create<TutorialState>(() => ({
  active: false,
  step: 0,
  rects: {},
  homeVisible: false,
  reacting: false,
}));

const measurers = new Map<TargetKey, () => void>();

export function startTutorial() {
  useTutorial.setState({ active: true, step: 0, reacting: false });
  measurers.forEach((m) => m());
}

function finish() {
  clearTimeout(reactTimer);
  useTutorial.setState({ active: false, step: 0, reacting: false });
  patchProfile({ tutorialDoneAt: now() });
}

/** Home calls this on focus/blur. Coming back re-measures (things may have moved). */
export function setTutorialHomeVisible(visible: boolean) {
  useTutorial.setState({ homeVisible: visible });
  if (visible) setTimeout(() => measurers.forEach((m) => m()), 250);
}

/** Re-measure one target (e.g. after Rusty hops to a new spot). */
export function remeasureTarget(key: TargetKey) {
  measurers.get(key)?.();
}

let reactTimer: ReturnType<typeof setTimeout> | undefined;

function go(step: number) {
  measurers.forEach((m) => m());
  useTutorial.setState({ step });
}

/** Call when the person does the thing a step is waiting for (e.g. pets Rusty). */
export function tutorialEvent(e: 'pet') {
  const { active, step, reacting } = useTutorial.getState();
  if (!active || reacting || STEPS[step]?.waitFor !== e) return;
  // Step aside so his reaction (hearts, speech bubble) plays on its own…
  useTutorial.setState({ reacting: true });
  clearTimeout(reactTimer);
  // …then carry on with the tour.
  reactTimer = setTimeout(() => {
    useTutorial.setState({ reacting: false });
    if (useTutorial.getState().active) go(step + 1);
  }, 2200);
}

export function useTutorialTarget(key: TargetKey) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = useCallback(() => {
    // measureInWindow matches the overlay's coordinates (root, full window).
    requestAnimationFrame(() =>
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) useTutorial.setState((s) => ({ rects: { ...s.rects, [key]: { x, y, w, h } } }));
      }),
    );
  }, [key]);
  useEffect(() => {
    measurers.set(key, measure);
    return () => {
      measurers.delete(key);
    };
  }, [key, measure]);
  return { ref, onLayout: measure, measure };
}

/** Starts the tour the first time Home appears after onboarding. */
export function useAutoStartTutorial(ready: boolean) {
  const done = useStore((s) => s.profile.tutorialDoneAt);
  const onboarded = useStore((s) => s.profile.onboardedAt);
  useEffect(() => {
    if (!ready || done || !onboarded) return;
    // Coming back to Home mid-tour resumes it; only start a fresh one.
    const id = setTimeout(() => {
      if (!useTutorial.getState().active) startTutorial();
    }, 900);
    return () => clearTimeout(id);
  }, [ready, done, onboarded]);
}

export function TutorialOverlay() {
  const { active, step, rects, homeVisible, reacting } = useTutorial();
  const name = useStore((s) => s.profile.name);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The overlay may not start at the window origin (web: centered phone
  // column), so measure where it is and convert target rects into it.
  const root = useRef<ComponentRef<typeof View>>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: win.width, h: win.height });
  const measureRoot = () =>
    root.current?.measureInWindow((x, y, w, h) => {
      if (w > 0) setFrame({ x, y, w, h });
    });
  if (!active || !homeVisible || reacting) return null;
  const W = frame.w;
  const H = frame.h;
  const s = STEPS[step];
  const r = s.target ? rects[s.target] : undefined;
  const pad = 8;
  const hole = r ? { x: r.x - frame.x - pad, y: r.y - frame.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 } : null;
  const last = step === STEPS.length - 1;
  const cardBelow = hole ? hole.y + hole.h / 2 < H * 0.5 : false;
  const title = step === 0 && name ? `Hi ${name}, I’m Rusty!` : s.title;

  return (
    <View ref={root} onLayout={measureRoot} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim everything except the hole. The hole itself lets taps through,
          so people can try the real control (e.g. pet Rusty). */}
      {hole ? (
        <>
          <Scrim style={{ left: 0, top: 0, width: W, height: Math.max(0, hole.y) }} />
          <Scrim style={{ left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) }} />
          <Scrim style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <Scrim style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }} />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.x,
              top: hole.y,
              width: hole.w,
              height: hole.h,
              borderRadius: 18,
              borderWidth: 3,
              borderColor: colors.action,
            }}
          />
        </>
      ) : (
        <Scrim style={{ left: 0, top: 0, right: 0, bottom: 0 }} />
      )}

      <Animated.View
        key={step}
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(120)}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          hole
            ? cardBelow
              ? { top: Math.min(hole.y + hole.h + 14, H - 260) }
              : { bottom: Math.min(H - hole.y + 14, H - insets.top - 220) }
            : { top: H * 0.3 },
        ]}
      >
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <RustyAvatar pose={s.pose} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="title2" accessibilityRole="header">
              {title}
            </T>
            <T v="callout">{s.text}</T>
            {s.target && s.target !== 'rusty' && (
              <T v="caption" color={colors.inkSoft}>
                {s.target === 'tabs'
                  ? 'Tap one to peek. Tap Home to come back to the tour.'
                  : 'You can tap the highlighted spot to try it. Back brings you right here.'}
              </T>
            )}
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <ProgressDots done={step + 1} total={STEPS.length} size={7} current={false} />
          {!last && (
            <Pressable accessibilityRole="button" onPress={finish} hitSlop={10}>
              <T v="label" color={colors.inkSoft}>
                Skip tour
              </T>
            </Pressable>
          )}
        </Row>
        {last ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Button
              onPress={() => {
                finish();
                router.push('/new-hobby');
              }}
            >
              Set up a goal with Rusty
            </Button>
            <Button variant="tertiary" small onPress={finish}>
              I’ll look around first
            </Button>
          </View>
        ) : (
          <Button
            style={{ marginTop: space.md }}
            onPress={() => {
              tap();
              go(step + 1);
            }}
          >
            {step === 0 ? 'Show me around' : 'Next'}
          </Button>
        )}
      </Animated.View>
    </View>
  );
}

function Scrim({ style }: { style: object }) {
  // Taps on the dimmed area are swallowed so the tour can't be lost by accident.
  return <Pressable accessible={false} style={[{ position: 'absolute', backgroundColor: 'rgba(40,20,12,0.55)' }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    padding: space.lg,
    ...shadows.float,
  },
});
