/**
 * Where everything is in Rusty's room, in room-image px (941 × 1672; measured
 * from art/visual-refresh/room/room-day.png). Room.tsx scales these to the
 * screen. The room is built to Rusty's size: a sitting Rusty's head is level
 * with the desk top and the windowsill.
 *
 *   wall  (y < 900):  window (weather) · corkboard (Hobbies, To-dos) over the
 *                     desk · clock on the desk (Focus) · frames (Keepsakes)
 *                     over the arched door (walks)
 *   floor (y > 900):  cat bed front left, rug in the middle. Everything that
 *                     matters stays above y ≈ 1395 (the "Gentle plans" card).
 */
import type { HobbyIcon } from '@/data/types';

import { BED_RIM, GLASS, OBJECT_ASPECT } from './room.gen';

export { BED_RIM, GLASS };
export const IMG = { w: 941, h: 1672 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BOARD: Rect = { x: 328, y: 254, w: 312, h: 312 };
export const NOTES = {
  hobbies: { x: 350, y: 280, w: 150, h: 125, rotate: '-3deg' },
  todos: { x: 474, y: 408, w: 148, h: 125, rotate: '2.5deg' },
} as const;
export const CLOCK: Rect = { x: 350, y: 580, w: 72, h: 72 };
export const DOOR: Rect = { x: 700, y: 528, w: 195, h: 357 };
/** All three frames, for the Keepsakes button. */
export const FRAMES_AREA: Rect = { x: 676, y: 226, w: 238, h: 280 };
/** Inside each frame, where a pinned keepsake goes. */
export const FRAME_SLOTS: Rect[] = [
  { x: 693, y: 243, w: 94, h: 129 },
  { x: 829, y: 277, w: 68, h: 80 },
  { x: 709, y: 411, w: 173, h: 78 },
];
/** Where the floor meets the wall, and the sun lands through the window. */
export const FLOOR_Y = 902;

/**
 * Each hobby's home: bottom-center of the object, and its height per growth
 * stage (1 = just added, 2 = first milestone, 3 = three milestones).
 * `lit` = inside the desk lamp's glow at night.
 */
export interface Home {
  x: number;
  bottom: number;
  h: readonly [number, number, number];
  lit?: boolean;
}
export const HOMES: Record<HobbyIcon, Home> = {
  // on the floor where he paints: his own easel lands here, so the room's
  // easel fades out while he's painting
  drawing: { x: 309, bottom: 947, h: [70, 190, 190] },
  gardening: { x: 205, bottom: 655, h: [62, 78, 110] },
  writing: { x: 452, bottom: 649, h: [34, 36, 52], lit: true },
  baking: { x: 516, bottom: 649, h: [40, 44, 56], lit: true },
  reading: { x: 404, bottom: 1052, h: [36, 62, 100] },
  guitar: { x: 666, bottom: 906, h: [44, 190, 172], lit: true },
  other: { x: 484, bottom: 898, h: [64, 66, 70], lit: true },
};
export { OBJECT_ASPECT };

/** Drawn back to front: things lower on the floor are in front. */
export const HOME_ORDER: HobbyIcon[] = ['gardening', 'writing', 'baking', 'other', 'guitar', 'drawing', 'reading'];
