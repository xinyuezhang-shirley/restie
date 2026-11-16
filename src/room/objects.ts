/** Hobby objects, 3 growth stages each (scripts/build-room.py). Static requires for Metro. */
import type { HobbyIcon } from '@/data/types';

export const OBJECTS: Record<HobbyIcon, readonly [number, number, number]> = {
  drawing: [
    require('../../assets/room/objects/drawing-1.webp'),
    require('../../assets/room/objects/drawing-2.webp'),
    require('../../assets/room/objects/drawing-3.webp'),
  ],
  gardening: [
    require('../../assets/room/objects/gardening-1.webp'),
    require('../../assets/room/objects/gardening-2.webp'),
    require('../../assets/room/objects/gardening-3.webp'),
  ],
  baking: [
    require('../../assets/room/objects/baking-1.webp'),
    require('../../assets/room/objects/baking-2.webp'),
    require('../../assets/room/objects/baking-3.webp'),
  ],
  writing: [
    require('../../assets/room/objects/writing-1.webp'),
    require('../../assets/room/objects/writing-2.webp'),
    require('../../assets/room/objects/writing-3.webp'),
  ],
  reading: [
    require('../../assets/room/objects/reading-1.webp'),
    require('../../assets/room/objects/reading-2.webp'),
    require('../../assets/room/objects/reading-3.webp'),
  ],
  guitar: [
    require('../../assets/room/objects/guitar-1.webp'),
    require('../../assets/room/objects/guitar-2.webp'),
    require('../../assets/room/objects/guitar-3.webp'),
  ],
  other: [
    require('../../assets/room/objects/other-1.webp'),
    require('../../assets/room/objects/other-2.webp'),
    require('../../assets/room/objects/other-3.webp'),
  ],
};

export const ROOM_DAY = require('../../assets/room/day.webp');
export const ROOM_NIGHT = require('../../assets/room/night.webp');
export const VIEW = require('../../assets/room/view.webp');
export const VIEW_DARK = require('../../assets/room/view-dark.webp');
export const BED_RIM_DAY = require('../../assets/room/bed-rim-day.webp');
export const BED_RIM_NIGHT = require('../../assets/room/bed-rim-night.webp');
