/**
 * Rusty's puppet rig — ported from the "Mikan" WebGL artifact.
 *
 * Each pose is one painted frame (assets/rusty/frames/*.png, transparent).
 * The shader warps that single frame to fake a rig: breathing, blinking,
 * head turn toward a gaze target, tail sway, and an optional limb wiggle.
 * Coordinates were measured on a 700px grid, so divide by 700 to get UVs.
 *
 * Adding a pose: drop a 1000×1000 frame in art/puppet/, run
 * scripts/cutout-frames.py, add it to FRAMES below and give it a rig entry.
 */

export type PoseKey =
  | 'sit'
  | 'wave'
  | 'cheer'
  | 'cook'
  | 'paint'
  | 'think'
  | 'sleep'
  | 'neutral'
  | 'laugh'
  | 'wink'
  | 'cry'
  | 'grumpy'
  | 'surprised'
  | 'love'
  | 'star'
  | 'smug';

export const FRAMES: Record<PoseKey, number> = {
  sit: require('../../assets/rusty/frames/sit.png'),
  wave: require('../../assets/rusty/frames/wave.png'),
  cheer: require('../../assets/rusty/frames/cheer.png'),
  cook: require('../../assets/rusty/frames/cook.png'),
  paint: require('../../assets/rusty/frames/paint.png'),
  think: require('../../assets/rusty/frames/think.png'),
  sleep: require('../../assets/rusty/frames/sleep.png'),
  neutral: require('../../assets/rusty/frames/neutral.png'),
  laugh: require('../../assets/rusty/frames/laugh.png'),
  wink: require('../../assets/rusty/frames/wink.png'),
  cry: require('../../assets/rusty/frames/cry.png'),
  grumpy: require('../../assets/rusty/frames/grumpy.png'),
  surprised: require('../../assets/rusty/frames/surprised.png'),
  love: require('../../assets/rusty/frames/love.png'),
  star: require('../../assets/rusty/frames/star.png'),
  smug: require('../../assets/rusty/frames/smug.png'),
};

export const POSE_KEYS = Object.keys(FRAMES) as PoseKey[];

type Vec2 = [number, number];
type Eye = [number, number, number, number]; // cx, cy, half-width, half-height

export interface Rig {
  head: [number, number, number]; // cx, cy, radius
  neck: Vec2;
  eyes: [Eye, Eye] | null;
  tail: { base: Vec2; c: Vec2; r: number; amp: number; spd?: number };
  ground: number;
  cx: number;
  blink?: boolean;
  /** horizontal band (x0, x1, feather) the head warp is allowed to touch */
  hb: [number, number, number];
  hAmp?: number;
  sway?: number;
  bounce?: boolean;
  noHead?: boolean;
  sleep?: boolean;
  breathAmp?: number;
  breathSpd?: number;
  /** ambient particles this pose emits */
  fx?: 'spark' | 'z' | 'heart';
  /**
   * A moving limb: pivot, influence circle (cx, cy, r), and optionally how it
   * moves — rotation amplitude (radians), an elliptical drift (dx, dy in rig
   * units) and speed. Without `move` it bobs gently (the thought cloud).
   */
  limb?: { piv: Vec2; c: [number, number, number]; move?: { rot: number; dx: number; dy: number; spd: number } };
}

/** Shared geometry for the 9 expression frames (same seated body). */
const SHEET: Rig = {
  head: [385, 265, 112],
  neck: [390, 350],
  eyes: [
    [322, 254, 33, 23],
    [437, 228, 30, 26],
  ],
  tail: { base: [238, 585], c: [178, 492], r: 96, amp: 0.07 },
  ground: 597,
  cx: 385,
  hb: [195, 580, 40],
};

export const RIG: Record<PoseKey, Rig> = {
  sit: {
    head: [372, 235, 108],
    neck: [385, 338],
    eyes: [
      [326, 224, 27, 18],
      [419, 188, 22, 21],
    ],
    tail: { base: [245, 565], c: [165, 472], r: 96, amp: 0.07 },
    ground: 597,
    cx: 380,
    blink: true,
    hb: [190, 560, 40],
  },
  wave: {
    head: [395, 232, 108],
    neck: [400, 305],
    eyes: [
      [352, 216, 28, 17],
      [446, 176, 21, 20],
    ],
    tail: { base: [225, 525], c: [160, 422], r: 96, amp: 0.07 },
    ground: 612,
    cx: 380,
    blink: true,
    hb: [210, 515, 25],
    hAmp: 0.5,
    sway: 0.018,
  },
  cheer: {
    head: [390, 202, 102],
    neck: [400, 268],
    eyes: [
      [355, 190, 23, 16],
      [428, 156, 17, 16],
    ],
    tail: { base: [250, 485], c: [190, 402], r: 88, amp: 0.12, spd: 3.2 },
    ground: 625,
    cx: 385,
    blink: true,
    bounce: true,
    fx: 'spark',
    hb: [0, 0, 0],
    noHead: true,
  },
  cook: {
    head: [375, 212, 102],
    neck: [380, 282],
    eyes: [
      [332, 194, 27, 17],
      [417, 156, 18, 19],
    ],
    tail: { base: [240, 522], c: [180, 432], r: 92, amp: 0.07 },
    ground: 632,
    cx: 380,
    blink: true,
    hb: [205, 460, 25],
    hAmp: 0.5,
    sway: 0.01,
    // stirring: the spoon paw circles while the spoon's tip stays in the batter
    limb: { piv: [470, 250], c: [468, 246, 52], move: { rot: 0, dx: 7, dy: 3.5, spd: 1.6 } },
  },
  paint: {
    head: [345, 217, 102],
    neck: [340, 283],
    eyes: [
      [315, 237, 25, 15],
      [386, 197, 13, 18],
    ],
    tail: { base: [178, 442], c: [105, 342], r: 82, amp: 0.07 },
    ground: 588,
    cx: 290,
    blink: true,
    hb: [180, 420, 25],
    hAmp: 0.6,
    // brush strokes: the painting arm swings from the shoulder
    limb: { piv: [378, 320], c: [455, 290, 82], move: { rot: 0.07, dx: 0, dy: 0, spd: 1.5 } },
  },
  think: {
    head: [382, 262, 108],
    neck: [395, 335],
    eyes: [
      [322, 210, 21, 20],
      [406, 247, 26, 19],
    ],
    tail: { base: [240, 582], c: [160, 472], r: 92, amp: 0.06 },
    ground: 602,
    cx: 375,
    blink: true,
    hb: [200, 550, 25],
    hAmp: 0.4,
    limb: { piv: [545, 95], c: [545, 95, 110] }, // the thought cloud bobs
  },
  sleep: {
    head: [470, 360, 90],
    neck: [470, 360],
    eyes: null,
    tail: { base: [345, 432], c: [418, 472], r: 55, amp: 0.05, spd: 0.8 },
    ground: 470,
    cx: 385,
    sleep: true,
    noHead: true,
    hb: [0, 0, 0],
    fx: 'z',
    breathAmp: 2.4,
    breathSpd: 0.55,
  },
  neutral: { ...SHEET, blink: true },
  laugh: { ...SHEET, fx: 'spark' },
  wink: { ...SHEET },
  cry: {
    ...SHEET,
    blink: true,
    eyes: [
      [319, 252, 32, 28],
      [439, 230, 30, 26],
    ],
  },
  grumpy: { ...SHEET, tail: { base: [238, 585], c: [178, 492], r: 96, amp: 0.08, spd: 4 } },
  surprised: {
    ...SHEET,
    blink: true,
    eyes: [
      [324, 251, 30, 28],
      [439, 229, 32, 28],
    ],
  },
  love: { ...SHEET, fx: 'heart' },
  star: { ...SHEET, fx: 'spark' },
  smug: { ...SHEET },
};

/**
 * Transition frames between poses (for you to draw later).
 * Key "from>to" → frame sequence played before landing on `to`.
 * Empty for now: poses crossfade. Example once art exists:
 *   'sit>sleep': ['sit_lie_1', 'sit_lie_2'],
 */
export const TRANSITIONS: Partial<Record<`${PoseKey}>${PoseKey}`, PoseKey[]>> = {};

/** Hit test in rig units (0..700): is this point on Rusty's head? */
export function hitsHead(pose: PoseKey, x700: number, y700: number): boolean {
  const [hx, hy, r] = RIG[pose].head;
  return Math.hypot(x700 - hx, y700 - hy) < r * 1.25;
}
