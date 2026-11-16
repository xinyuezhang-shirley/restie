/**
 * Rusty's moves between states, built from Shirley's sprite sheets by
 * scripts/build-sprites.py (sheets.gen.ts).
 *
 * Every move starts and ends on the puppet's own drawing (his sitting pose,
 * and for an activity the pose that takes over), so handing off between the
 * live puppet and a move never changes the picture. Between each pair of
 * drawings are two morphed in-betweens: the drawing distorted toward the next
 * one, so nothing jumps from frame to frame.
 *
 *   activity sheet: enter = sitting → doing it (played backwards to stop)
 *   walk sheet:     start = stand up facing the way, cycle = walk (looped by
 *                   distance walked), stop = sit back down
 */
import type { PoseKey } from './rig';
import { PUPPET_HEAD, R, SHEET_DATA, STEPS } from './sheets.gen';

export { PUPPET_HEAD, R };
/** Frames per original drawing (itself + its morphed in-betweens). */
export const STEP_FRAMES = STEPS;

export type SheetKey = keyof typeof SHEET_DATA;
export type Dir = 'left' | 'right' | 'up' | 'down';

/** [x, y, w, h] in the atlas (px) + where its top-left sits in the box (box units). */
export type Frame = readonly [number, number, number, number, number, number];

export interface Sheet {
  src: number;
  /** atlas size, px */
  w: number;
  h: number;
  frames: readonly Frame[];
  /** top-center of his head per frame, box units (badge + speech bubble) */
  head: readonly (readonly [number, number])[];
}

const sheet = (key: SheetKey, src: number): Sheet => {
  const d = SHEET_DATA[key];
  return { src, w: d.w, h: d.h, frames: d.frames, head: d.head };
};

export const SHEETS: Record<SheetKey, Sheet> = {
  paint: sheet('paint', require('../../assets/rusty/sheets/paint.webp')),
  think: sheet('think', require('../../assets/rusty/sheets/think.webp')),
  sleep: sheet('sleep', require('../../assets/rusty/sheets/sleep.webp')),
  cook: sheet('cook', require('../../assets/rusty/sheets/cook.webp')),
  walkLeft: sheet('walkLeft', require('../../assets/rusty/sheets/walk-left.webp')),
  walkRight: sheet('walkRight', require('../../assets/rusty/sheets/walk-right.webp')),
  walkUp: sheet('walkUp', require('../../assets/rusty/sheets/walk-up.webp')),
  walkDown: sheet('walkDown', require('../../assets/rusty/sheets/walk-down.webp')),
};

export const SHEET_KEYS = Object.keys(SHEETS) as SheetKey[];

/** Activities that have a sit → action move. Everything else is the puppet. */
export const ACTION_SHEET: Partial<Record<PoseKey, SheetKey>> = {
  paint: 'paint',
  cook: 'cook',
  sleep: 'sleep',
  think: 'think',
};

export const WALK_SHEET: Record<Dir, SheetKey> = { left: 'walkLeft', right: 'walkRight', up: 'walkUp', down: 'walkDown' };

export interface Clip {
  frames: readonly number[];
  fps: number;
  /** Slow in/out over the whole clip. */
  ease?: 'in' | 'out' | 'inOut';
}

const rev = (c: Clip): Clip => ({ ...c, frames: [...c.frames].reverse() });

/** fps per original drawing; each one is STEPS frames now (itself + morphs). */
const enter = (key: 'paint' | 'cook' | 'think' | 'sleep', fps: number): Clip => ({
  frames: SHEET_DATA[key].clips.enter,
  fps: fps * STEPS,
  ease: 'inOut',
});

/** sitting → doing it; EXIT is the same move backwards. */
export const ENTER: Partial<Record<SheetKey, Clip>> = {
  paint: enter('paint', 9),
  cook: enter('cook', 9),
  think: enter('think', 8),
  sleep: enter('sleep', 7),
};
export const EXIT: Partial<Record<SheetKey, Clip>> = Object.fromEntries(
  Object.entries(ENTER).map(([k, c]) => [k, rev(c)]),
) as Partial<Record<SheetKey, Clip>>;

/**
 * While he's doing an activity the puppet's own pose for it plays (breathing,
 * blinking, the brush arm / stirring paw moving). Sleep holds the move's last
 * frame and breathes (the puppet's sleep pose has a cushion the sheet doesn't).
 */
export const PUPPET_LOOP: Partial<Record<SheetKey, PoseKey>> = { paint: 'paint', cook: 'cook', think: 'think' };

/** A walk sheet's moves. The cycle is played by distance walked, not time. */
export function walkClips(key: SheetKey) {
  const c = (SHEET_DATA[key].clips as { start?: readonly number[]; cycle?: readonly number[]; stop?: readonly number[] });
  return {
    start: { frames: c.start ?? [0], fps: 9 * STEPS, ease: 'in' } as Clip,
    cycle: { frames: c.cycle ?? [0], fps: 8 * STEPS } as Clip,
    stop: { frames: c.stop ?? [0], fps: 9 * STEPS, ease: 'out' } as Clip,
  };
}

/** Distance covered per original walk drawing, in puppet-box units (before depth scale). */
export const WALK_STEP = 0.045;
/** The walk ends on this cycle entry (the original frame the stop move starts from). */
export const WALK_LAST = 3 * STEPS;

/** How long a one-shot clip takes (ms). */
export const clipMs = (c: Clip) => ((c.frames.length - 1) / c.fps) * 1000;

/** Points per second across the room (at the room's full width ~390pt). */
export const WALK_SPEED = 62;

/** Which way to walk: mostly sideways → left/right, else toward/away. */
export function walkDir(dx: number, dy: number): Dir {
  // Sideways unless clearly toward/away (the room is shallow, so diagonal
  // moves read best as a sideways walk).
  if (Math.abs(dx) >= Math.abs(dy) * 0.8) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
