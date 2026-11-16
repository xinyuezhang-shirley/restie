/**
 * Rusty's room — Home. Built to his size (src/room/layout.ts).
 *
 * The wall holds the things you can tap, and they never change:
 *   window → Rusty talks weather       corkboard notes → Hobbies / To-dos
 *   clock on the desk → Focus timer    frames → Keepsakes    door → his walks
 *   Rusty → tap: he reacts · hold: his menu
 * The floor and furniture hold his life: each hobby has a home where he does
 * it, and its object grows in 3 stages as you reach milestones.
 *
 * Light (src/room/Sky.tsx): the sky, view and weather are behind the window
 * glass; the sun comes in through it by day, the desk lamp lights the room at
 * night, and Rusty and the objects are lit the same way as the room.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useReducedMotion, withDelay, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { KeepsakeImage } from '@/components/KeepsakeImage';
import { useArtUrl } from '@/ai/art';
import { tap } from '@/components/ui';
import type { HobbyIcon, Keepsake } from '@/data/types';
import { freePlace, spotAt, type Brain } from '@/rusty/brain';
import { lines, objectLine, pick } from '@/rusty/personality';
import { PUPPET_HEAD } from '@/rusty/sprites';
import { FOOT_Y, RustyActor } from '@/rusty/RustyActor';
import { type RustyPuppetHandle } from '@/rusty/RustyPuppet';
import { colors, fonts, shadows, space } from '@/theme/tokens';
import { remeasureTarget, tutorialEvent, useTutorialTarget } from '@/tutorial/tutorial';
import { useSky, type Condition, type Phase } from '@/world/world';

import { BED, BED_RIM, BOARD, CLOCK, DOOR, FRAME_SLOTS, FRAMES_AREA, GLASS, HOME_ORDER, HOMES, IMG, NOTES, OBJECT_ASPECT } from './layout';
import { BED_RIM_DAY, BED_RIM_NIGHT, OBJECTS, ROOM_DAY, ROOM_NIGHT } from './objects';
import { lightFor, NIGHT, roomWash, StormFlash, SunPatch, WindowView } from './Sky';

/** Rect in room-image pixels → absolute style at the current scale. */
const box = (k: number, x: number, y: number, w: number, h: number) => ({
  position: 'absolute' as const,
  left: x * k,
  top: y * k,
  width: w * k,
  height: h * k,
});

interface Props {
  width: number;
  brain: Brain;
  hobbyCount: number;
  stepCount: number;
  /** each hobby's home and how far it has grown */
  homes: Partial<Record<HobbyIcon, 1 | 2 | 3>>;
  /** Rusty's drawing (kept by you) for a hobby with no built-in object: stands in the "other" spot */
  otherArt?: string | null;
  pinned: Keepsake[];
  news: 'checkin' | 'skip' | null;
  onHobbies: () => void;
  onTodos: () => void;
  onClock: () => void;
  onKeepsakes: () => void;
  onRusty: () => void;
  onDoor: () => void;
}

export function Room(p: Props) {
  const k = p.width / IMG.w;
  const height = IMG.h * k;
  const { phase, condition } = useSky();
  const puppet = useRef<RustyPuppetHandle>(null);
  const { ref: rustyRef, onLayout: onRustyLayout } = useTutorialTarget('rusty');
  const { ref: boardRef, onLayout: onBoardLayout } = useTutorialTarget('board');
  const clockTarget = useTutorialTarget('clock');
  const framesTarget = useTutorialTarget('frames');
  const windowTarget = useTutorialTarget('window');

  // Rusty's feet + depth scale. RustyActor walks him between spots and plays
  // his moves; the bubble follows him.
  const start = spotAt(p.brain.spot);
  const fx = useSharedValue(start.x * p.width);
  const fy = useSharedValue(start.y * height);
  const sc = useSharedValue(start.s);
  // top-center of his head inside his box (RustyActor keeps it current)
  const headX = useSharedValue<number>(PUPPET_HEAD[0]);
  const headY = useSharedValue<number>(PUPPET_HEAD[1]);
  const puppetSize = p.width * 0.5;

  // Bubble "!" pulse when Rusty has something to ask.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // The room's own easel / bowl step aside while his drawing holds his own.
  const inUse: Partial<Record<HobbyIcon, boolean>> = { drawing: p.brain.base === 'paint', baking: p.brain.base === 'cook' };
  const wash = roomWash(phase, condition);
  const otherUrl = useArtUrl(p.otherArt);

  const roomRef = useRef<ComponentRef<typeof View>>(null);
  // Where you sent him: a paw print that fades when he gets going.
  const [mark, setMark] = useState<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    if (!mark) return;
    const t = setTimeout(() => setMark(null), 1100);
    return () => clearTimeout(t);
  }, [mark]);

  // On a computer: arrow keys walk him around (not while you're typing).
  const nudge = p.brain.nudge;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable))) return;
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[e.key as 'ArrowUp'];
      if (!dir) return;
      e.preventDefault();
      nudge(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudge]);

  return (
    <View ref={roomRef} style={{ width: p.width, height, overflow: 'hidden' }} accessibilityLabel="Rusty's room">
      {/* outside, seen through the cut-out window glass */}
      <WindowView phase={phase} condition={condition} k={k} />
      {/* the room by day, and lamp-lit by night (fades in at dusk) */}
      <Image source={ROOM_DAY} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      <NightPlate amount={NIGHT[phase]} />

      {/* Tap anywhere in the room and Rusty walks over (a tap on the wall
          sends him to the back of the floor). Things you can tap sit above. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessible={false}
        onPress={(e) => {
          if (p.brain.away) return;
          // pageX/Y minus where the room is on the page (locationX isn't reliable on web)
          const { pageX, pageY } = e.nativeEvent;
          roomRef.current?.measure((_x, _y, _w, _h, left, top) => {
            const fxr = (pageX - left) / p.width;
            const fyr = (pageY - top) / height;
            if (!Number.isFinite(fxr) || !Number.isFinite(fyr)) return;
            const to = spotAt(freePlace(fxr, fyr));
            setMark({ x: to.x * p.width, y: to.y * height, id: Date.now() });
            p.brain.goTo(fxr, fyr);
          });
        }}
      />
      {mark && (
        <Animated.View key={mark.id} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(400)} pointerEvents="none" style={[styles.mark, { left: mark.x - 14, top: mark.y - 14 }]}>
          <Icon name="paw" size={20} color={colors.action} />
        </Animated.View>
      )}
      {/* his bed: tap for a nap */}
      <Hotspot style={box(k, BED.x, BED.y, BED.w, BED.h)} a11y="Rusty's bed: send him for a nap" onPress={() => p.brain.goToBed()} />

      {/* pinned keepsakes in the wall frames */}
      {p.pinned.slice(0, 3).map((ks, i) => {
        const f = FRAME_SLOTS[i];
        return (
          // Each framed keepsake opens full size (eval #23: they're small on the wall).
          <Pressable
            key={ks.id}
            accessibilityRole="button"
            accessibilityLabel={`Keepsake on the wall: ${ks.caption}. Open it`}
            onPress={() => {
              tap();
              router.push(`/keepsake/${ks.id}`);
            }}
            style={[box(k, f.x, f.y, f.w, f.h), { backgroundColor: '#FFF7E7', padding: 2 * k, zIndex: 4 }]}
          >
            <KeepsakeImage keepsake={ks} style={{ width: '100%', height: '100%' }} />
          </Pressable>
        );
      })}

      {/* each hobby's home, grown to its stage */}
      {HOME_ORDER.filter((icon) => p.homes[icon]).map((icon) => (
        <HobbyObject
          key={icon}
          icon={icon}
          stage={p.homes[icon]!}
          k={k}
          hidden={!!inUse[icon]}
          art={icon === 'other' ? otherUrl : null}
          phase={phase}
          condition={condition}
          onPress={() =>
            p.brain.say(p.brain.away ? `(that’s Rusty’s. he’ll tell you all about it when he’s back.)` : objectLine(icon, p.homes[icon]!))
          }
        />
      ))}

      {/* what he's up to, quietly, in the empty wall above everything */}
      <Subtitle text={p.brain.doing} k={k} />

      {/* ---- the things on the wall you can tap ---- */}
      <Hotspot
        target={windowTarget}
        style={box(k, GLASS.x, GLASS.y, GLASS.w, GLASS.h)}
        a11y="Window: ask Rusty about the weather"
        onPress={() => p.brain.say(pick(lines.weather[condition]))}
      />
      <Hotspot target={clockTarget} style={box(k, CLOCK.x, CLOCK.y, CLOCK.w, CLOCK.h)} label="Focus" a11y="Clock: start a focus timer with Rusty" onPress={p.onClock} round />
      <Hotspot
        target={framesTarget}
        style={box(k, FRAMES_AREA.x, FRAMES_AREA.y, FRAMES_AREA.w, FRAMES_AREA.h)}
        label="Keepsakes"
        a11y="Picture frames: open keepsakes"
        onPress={p.onKeepsakes}
      />
      <Hotspot style={box(k, DOOR.x, DOOR.y, DOOR.w, DOOR.h)} a11y="Door: Rusty's walks" onPress={p.onDoor} />
      {p.brain.away && (
        <DoorSign
          k={k}
          back={p.brain.away.back}
          news={!!p.news}
          onPress={() => {
            tap();
            // his check-in still reaches you while he's out; otherwise, his note
            if (p.news) p.onRusty();
            else p.brain.say(`${p.brain.away!.note} back around ${p.brain.away!.back}. 🐾`, 7000);
          }}
        />
      )}

      {/* corkboard: two notes */}
      <View ref={boardRef} onLayout={onBoardLayout} style={box(k, BOARD.x, BOARD.y, BOARD.w, BOARD.h)} pointerEvents="box-none">
        {(['hobbies', 'todos'] as const).map((n) => {
          const r = NOTES[n];
          return (
            <BoardNote
              key={n}
              k={k}
              left={r.x - BOARD.x}
              top={r.y - BOARD.y}
              w={r.w}
              h={r.h}
              color={n === 'hobbies' ? colors.noteYellow : colors.notePurple}
              rotate={r.rotate}
              title={n === 'hobbies' ? 'Hobbies' : 'To-dos'}
              sub={n === 'hobbies' ? `${p.hobbyCount} growing` : `${p.stepCount} open`}
              onPress={n === 'hobbies' ? p.onHobbies : p.onTodos}
            />
          );
        })}
      </View>

      {/* ---- Rusty ---- */}
      <RustyActor
        ref={puppet}
        roomW={p.width}
        roomH={height}
        size={puppetSize}
        spot={p.brain.spot}
        base={p.brain.base}
        reaction={p.brain.reaction}
        fx={fx}
        fy={fy}
        sc={sc}
        headX={headX}
        headY={headY}
        light={lightFor(phase, condition)}
        hidden={!!p.brain.away}
        boxRef={rustyRef}
        onBoxLayout={onRustyLayout}
        // keep the tour's spotlight on him once he lands
        onSettled={() => setTimeout(() => remeasureTarget('rusty'), 50)}
        puppet={{
          // Tapping is for play; holding opens his menu (talk, check-in…).
          onPressHead: () => {
            tap('medium');
            puppet.current?.burst('heart', 4);
            p.brain.pet();
            tutorialEvent('pet');
          },
          onPressBody: () => {
            tap();
            puppet.current?.burst('spark', 2);
            p.brain.poke();
            if (p.news && Math.random() < 0.6) p.brain.say(pick(lines.holdHint), 4000);
            tutorialEvent('pet');
          },
          onLongPress: () => {
            tap('medium');
            p.onRusty();
          },
          accessibilityLabel: 'Rusty',
          accessibilityHint: 'Tap to pet him. Press and hold to talk or check in.',
        }}
      >
        {/* asleep: little z's drift up from his head */}
        {p.brain.base === 'sleep' && !p.brain.reaction && !p.brain.away && <Zzz size={puppetSize} />}
        {/* Always-visible shortcut to his menu (same as holding him), so
            talking to Rusty is recognizable, not recalled (eval #21):
            "!" when he has news, a speech bubble otherwise. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.news === 'checkin' ? 'Rusty has a check-in for you' : p.news ? 'Rusty has a suggestion for you' : 'Talk to Rusty'}
          onPress={() => {
            tap();
            p.onRusty();
          }}
          hitSlop={10}
          // anchored to the top of his head (follows him when he stands, curls up…),
          // up and to the left so it never covers his face or the easel
          style={{ position: 'absolute', left: -puppetSize * 0.2 - 30, top: -puppetSize * 0.06 }}
        >
          {p.news ? (
            <Animated.View style={[styles.news, { position: 'relative' }, pulseStyle]}>
              <Text style={styles.newsText}>!</Text>
            </Animated.View>
          ) : (
            <View style={[styles.news, styles.talk]}>
              <Icon name="chat" size={17} color={colors.actionText} strokeWidth={2.4} />
            </View>
          )}
        </Pressable>
      </RustyActor>

      {/* in front of Rusty: the bed's front rim (when he's in the bed), then
          the light, which falls on him as well as the room */}
      <BedRim k={k} fy={fy} night={NIGHT[phase]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 22 }]}>
        <SunPatch phase={phase} condition={condition} k={k} />
        {wash && <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />}
        {condition === 'storm' && <StormFlash k={k} whole />}
      </View>

      {p.brain.line && <SpeechBubble text={p.brain.line} fx={fx} fy={fy} sc={sc} headY={headY} size={puppetSize} maxW={p.width * 0.72} roomW={p.width} />}
    </View>
  );
}

/** A quiet line of narration (Mycoto-style), crossfading when it changes. */
function Subtitle({ text, k }: { text: string; k: number }) {
  const [shown, setShown] = useState(text);
  const o = useSharedValue(1);
  useEffect(() => {
    if (text === shown) return;
    o.value = withTiming(0, { duration: 250 });
    const t = setTimeout(() => {
      setShown(text);
      o.value = withTiming(1, { duration: 350 });
    }, 260);
    return () => clearTimeout(t);
  }, [text, shown, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[box(k, 40, 92, IMG.w - 80, 110), styles.subtitleWrap, style]}>
      {/* on a soft pill so it reads on the dark night wall too */}
      <View style={styles.subtitlePill}>
        <Text style={styles.subtitle} numberOfLines={2}>
          {shown}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Sleeping: three z's float up and fade, one after another, forever (still for Reduce Motion). */
function Zzz({ size }: { size: number }) {
  const reduce = useReducedMotion();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: size * 0.06, top: -size * 0.02 }} accessible={false}>
      {[0, 1, 2].map((i) => (
        <Zee key={i} delay={i * 1100} size={18 + i * 5} still={reduce} index={i} />
      ))}
    </View>
  );
}

function Zee({ delay, size, still, index }: { delay: number; size: number; still: boolean; index: number }) {
  const t = useSharedValue(still ? 0.5 + index * 0.2 : 0);
  useEffect(() => {
    if (still) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3300, easing: Easing.out(Easing.quad) }), -1, false));
  }, [delay, still, t]);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 0.8 : t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85,
    transform: [{ translateX: 8 + t.value * 30 + Math.sin(t.value * 6) * 4 }, { translateY: -t.value * 64 }, { rotate: `${-12 + t.value * 14}deg` }],
  }));
  return <Animated.Text style={[styles.zee, { fontSize: size }, style]}>z</Animated.Text>;
}

/** The lamp-lit night painting over the day one, crossfading as the sun sets. */
function NightPlate({ amount }: { amount: number }) {
  const o = useSharedValue(amount);
  useEffect(() => {
    o.value = withTiming(amount, { duration: 1200 });
  }, [amount, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image source={ROOM_NIGHT} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
    </Animated.View>
  );
}

/**
 * The cat bed's front rim, over Rusty while his feet are behind its front edge
 * (sitting or curled up in the bed, or walking behind it). It's the same
 * pixels as the painting under it, so it only shows where it covers him.
 */
function BedRim({ k, fy, night }: { k: number; fy: SharedValue<number>; night: number }) {
  const n = useSharedValue(night);
  useEffect(() => {
    n.value = withTiming(night, { duration: 1200 });
  }, [night, n]);
  const show = useAnimatedStyle(() => ({ opacity: fy.value < BED_RIM.bottom * k ? 1 : 0 }));
  const nightStyle = useAnimatedStyle(() => ({ opacity: n.value }));
  const r = box(k, BED_RIM.x, BED_RIM.y, BED_RIM.w, BED_RIM.h);
  return (
    <Animated.View pointerEvents="none" style={[r, { zIndex: 21 }, show]}>
      <Image source={BED_RIM_DAY} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      <Animated.View style={[StyleSheet.absoluteFill, nightStyle]}>
        <Image source={BED_RIM_NIGHT} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The sign on his door while he's out: where he went is in his note (tap it),
 * and a "!" when he left you a check-in.
 */
function DoorSign({ k, back, news, onPress }: { k: number; back: string; news: boolean; onPress: () => void }) {
  const w = 240;
  const h = 104;
  const x = DOOR.x + DOOR.w / 2 - w / 2;
  const y = DOOR.y + 120;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sign on Rusty's door: out exploring, back around ${back}. ${news ? 'He left you a check-in.' : 'Read his note.'}`}
      onPress={onPress}
      style={[box(k, x, y - 40, w, h + 40), { zIndex: 5, alignItems: 'center' }]}
    >
      {/* the string over the nail */}
      <View style={{ width: 0, height: 0, borderLeftWidth: 30 * k, borderRightWidth: 30 * k, borderBottomWidth: 36 * k, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#8A5A33', opacity: 0.8 }} />
      <View style={[styles.sign, { width: w * k, minHeight: h * k, transform: [{ rotate: '-2deg' }] }]}>
        <Text style={styles.signTitle}>Out exploring</Text>
        <Text style={styles.signSub}>back around {back}</Text>
      </View>
      {news && (
        <View style={[styles.news, { right: -10, top: 40 * k - 14 }]}>
          <Text style={styles.newsText}>!</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A hobby's object on its home spot, lit like the room; steps aside while Rusty holds his own. Tap: Rusty tells you about his. */
function HobbyObject({
  icon,
  stage,
  k,
  hidden,
  art,
  phase,
  condition,
  onPress,
}: {
  icon: HobbyIcon;
  stage: 1 | 2 | 3;
  k: number;
  hidden: boolean;
  /** a kept drawing replaces the built-in object (square, with margin) */
  art?: string | null;
  phase: Phase;
  condition: Condition;
  onPress: () => void;
}) {
  const home = HOMES[icon];
  // a drawing is a square with empty margin, so it gets a bigger box for the same visible size
  const h = art ? Math.max(home.h[stage - 1], 70) * 1.5 : home.h[stage - 1];
  const w = art ? h : h * OBJECT_ASPECT[icon][stage - 1];
  const o = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    o.value = withTiming(hidden ? 0 : 1, { duration: 500 });
  }, [hidden, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const light = lightFor(phase, condition, home.lit);
  return (
    // no zIndex: drawn in order (after the room, before Rusty). An explicit
    // zIndex on expo-image's web wrapper painted over Rusty.
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[box(k, home.x - w / 2, home.bottom - h, w, h), light ? { filter: light } : null, style]}>
      {/* a soft contact shadow, so it sits on the floor / desk instead of floating */}
      <View style={[styles.contact, { left: w * 0.08 * k, right: w * 0.08 * k, height: Math.max(4, h * 0.07) * k, bottom: -Math.max(2, h * 0.025) * k }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rusty's ${icon} things. Hear what he's working on`}
        onPress={() => {
          tap();
          onPress();
        }}
        hitSlop={8}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Image source={art ? { uri: art } : OBJECTS[icon][stage - 1]} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
      </Pressable>
    </Animated.View>
  );
}

function Hotspot({
  style,
  label,
  labelAt = 'below',
  a11y,
  onPress,
  target,
  round,
}: {
  style: object;
  label?: string;
  /** every tappable thing gets the same small label: under it, or inside at the top/bottom */
  labelAt?: 'below' | 'top' | 'bottom';
  a11y: string;
  onPress: () => void;
  target?: ReturnType<typeof useTutorialTarget>;
  round?: boolean;
}) {
  const { ref: targetRef, onLayout } = target ?? {};
  const place = labelAt === 'below' ? styles.labelBelow : labelAt === 'top' ? styles.labelTop : styles.labelBottom;
  return (
    <Pressable
      ref={targetRef}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [style, { zIndex: 3, borderRadius: round ? 999 : 12 }, pressed && { backgroundColor: 'rgba(255,255,255,0.22)' }]}
    >
      {label ? (
        <View style={[styles.hotLabelWrap, place]} pointerEvents="none">
          <View style={styles.hotLabel}>
            <Text style={styles.hotLabelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function BoardNote({
  k,
  left,
  top,
  w,
  h,
  color,
  rotate,
  title,
  sub,
  onPress,
}: {
  k: number;
  left: number;
  top: number;
  w: number;
  h: number;
  color: string;
  rotate: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.note,
        {
          left: left * k,
          top: top * k,
          width: w * k,
          minHeight: h * k,
          backgroundColor: color,
          transform: [{ rotate }, { scale: pressed ? 0.96 : 1 }],
          padding: 14 * k,
        },
      ]}
    >
      <View style={styles.pin} />
      <Text style={{ fontFamily: fonts.heading, fontSize: Math.max(13, 30 * k), color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(10, 20 * k), color: colors.ink, marginTop: 4 * k }}>{sub}</Text>
    </Pressable>
  );
}

/** Follows Rusty as he walks (positions come from his shared feet values). */
function SpeechBubble({
  text,
  fx,
  fy,
  sc,
  headY,
  size,
  maxW,
  roomW,
}: {
  text: string;
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  sc: SharedValue<number>;
  headY: SharedValue<number>;
  size: number;
  maxW: number;
  roomW: number;
}) {
  const bubble = useAnimatedStyle(() => {
    const left = Math.max(10, Math.min(roomW - maxW - 10, fx.value - maxW / 2));
    // just above his head, wherever it is (standing to paint, curled up asleep…)
    const head = fy.value + (headY.value - FOOT_Y) * size * sc.value;
    return { left, top: Math.max(8, head - size * sc.value * 0.12 - 64) };
  });
  const tail = useAnimatedStyle(() => {
    const left = Math.max(10, Math.min(roomW - maxW - 10, fx.value - maxW / 2));
    return { left: Math.max(16, Math.min(maxW - 30, fx.value - left - 8)) };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Rusty says: ${text}`}
      style={[styles.bubble, { width: maxW, zIndex: 25 }, bubble]}
    >
      <Text style={styles.bubbleText}>{text}</Text>
      <Animated.View style={[styles.bubbleTail, tail]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zee: { position: 'absolute', left: 0, top: 0, fontFamily: fonts.heading, color: '#4F6F9A', textShadowColor: 'rgba(255,255,255,0.95)', textShadowRadius: 4 },
  mark: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,236,0.85)',
    zIndex: 3,
  },
  shadow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(110,70,35,0.18)' },
  sign: {
    backgroundColor: '#FFF4E2',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9A6A3F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...shadows.soft,
  },
  signTitle: { fontFamily: fonts.heading, fontSize: 12, lineHeight: 16, color: colors.ink, textAlign: 'center' },
  signSub: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 14, color: colors.inkSoft, textAlign: 'center' },
  subtitleWrap: { justifyContent: 'center', alignItems: 'center' },
  subtitle: { fontFamily: fonts.body, fontStyle: 'italic', fontSize: 14, lineHeight: 19, color: '#6B4A33', textAlign: 'center' },
  subtitlePill: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,248,236,0.82)' },
  contact: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(95,58,28,0.22)' },
  news: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.soft,
  },
  talk: { position: 'relative', backgroundColor: colors.white, borderColor: colors.action },
  newsText: { color: colors.white, fontFamily: fonts.bodyExtra, fontSize: 18, lineHeight: 22 },
  hotLabelWrap: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  labelBelow: { top: '100%', marginTop: 7 },
  labelTop: { top: 6 },
  labelBottom: { bottom: 6 },
  hotLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,252,246,0.94)',
    ...shadows.soft,
  },
  hotLabelText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  note: { position: 'absolute', borderRadius: 4, ...shadows.soft },
  pin: {
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.action,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,253,248,0.97)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.float,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,253,248,0.97)',
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
