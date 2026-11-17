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
/** His cat bed (front left): tap it and he goes for a nap. */
export const BED: Rect = { x: 30, y: 965, w: 330, h: 205 };
export const CLOCK: Rect = { x: 350, y: 580, w: 72, h: 72 };
export const DOOR: Rect = { x: 700, y: 528, w: 195, h: 357 };
/**
 * The three keepsake frames, drawn by the app (Room.tsx) over the painted
 * ones and ~25% bigger, so pinned keepsakes are easier to see. Each fully
 * covers its painted frame (measured: 682–798×232–383, 819–909×266–368,
 * 698–893×401–499).
 */
export const FRAMES: Rect[] = [
  { x: 664, y: 210, w: 140, h: 180 },
  { x: 816, y: 246, w: 112, h: 142 },
  { x: 672, y: 398, w: 240, h: 116 },
];
/** Wood + mat around each picture, in room px. */
export const FRAME_BORDER = 12;
/** Inside each frame, where a pinned keepsake goes. */
export const FRAME_SLOTS: Rect[] = FRAMES.map((f) => ({ x: f.x + FRAME_BORDER, y: f.y + FRAME_BORDER, w: f.w - FRAME_BORDER * 2, h: f.h - FRAME_BORDER * 2 }));
/** All three frames, for the Keepsakes button. */
export const FRAMES_AREA: Rect = { x: 664, y: 210, w: 264, h: 304 };
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
/*
 * Sizes follow real life, squeezed to fit Rusty's room (it's built to his
 * size, so big things are scaled down more than small ones): an easel or a
 * guitar on its stand stands about as tall as Rusty sitting; a guitar case is
 * longer than a stack of books; a single book is the smallest thing on the
 * floor. Nothing is drawn under ~50 room px, so everything reads on a phone.
 * The desk only has room for one thing between the clock and the lamp, so
 * writing lives on the windowsill, next to the plant.
 */
export const HOMES: Record<HobbyIcon, Home> = {
  // on the floor where he paints: his own easel lands here, so the room's
  // easel fades out while he's painting (sketchbook → easel → finished painting)
  drawing: { x: 309, bottom: 947, h: [100, 250, 250] },
  // windowsill: pot → sprout → flowering plant
  gardening: { x: 215, bottom: 655, h: [84, 104, 132] },
  // windowsill, left of the plant: notebook → open notebook → stack of notebooks
  writing: { x: 88, bottom: 655, h: [64, 50, 70] },
  // the desk, between the clock and the lamp: bowl → bowl + flour → jar + loaf
  baking: { x: 492, bottom: 649, h: [70, 66, 78], lit: true },
  // floor beside the bed: one book → a stack → a tall stack with a mug
  reading: { x: 470, bottom: 1052, h: [56, 104, 150] },
  // floor by the door: case → guitar on its stand → guitar + stool
  guitar: { x: 640, bottom: 906, h: [96, 250, 250], lit: true },
  // under the desk: a basket that fills up
  other: { x: 455, bottom: 898, h: [88, 92, 96], lit: true },
};
export { OBJECT_ASPECT };

/** Drawn back to front: things lower on the floor are in front. */
export const HOME_ORDER: HobbyIcon[] = ['gardening', 'writing', 'baking', 'other', 'guitar', 'drawing', 'reading'];
