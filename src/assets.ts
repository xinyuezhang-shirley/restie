/** Every bundled image, in one place (Metro needs static require calls). */
import type { HobbyIcon } from '@/data/types';

export const hobbyIcons: Record<HobbyIcon, number> = {
  guitar: require('../assets/hobbies/guitar.png'),
  drawing: require('../assets/hobbies/drawing.png'),
  baking: require('../assets/hobbies/baking.png'),
  reading: require('../assets/hobbies/reading.png'),
  writing: require('../assets/hobbies/writing.png'),
  gardening: require('../assets/hobbies/gardening.png'),
  other: require('../assets/hobbies/other.png'),
};

export const hobbyChoices: { name: string; icon: HobbyIcon }[] = [
  { name: 'Guitar', icon: 'guitar' },
  { name: 'Drawing', icon: 'drawing' },
  { name: 'Baking', icon: 'baking' },
  { name: 'Reading', icon: 'reading' },
  { name: 'Writing', icon: 'writing' },
  { name: 'Gardening', icon: 'gardening' },
];

/** Guess an icon for a hobby someone typed in ("Piano" → other). */
export function iconFor(name: string): HobbyIcon {
  const n = name.toLowerCase();
  if (/guitar|ukulele|bass|piano|music|sing|song|violin|drum/.test(n)) return 'guitar';
  if (/draw|sketch|paint|art|watercolor|illustrat|design/.test(n)) return 'drawing';
  if (/bak|cook|bread|sourdough|pastry|kitchen/.test(n)) return 'baking';
  if (/read|book|novel/.test(n)) return 'reading';
  if (/writ|journal|poem|poetry|blog|story/.test(n)) return 'writing';
  if (/garden|plant|flower|grow/.test(n)) return 'gardening';
  return 'other';
}

/** Rusty's poses (transparent cutouts from the med-fi art). */
export const poses = {
  idle: require('../assets/rusty/poses/idle.png'),
  wave: require('../assets/rusty/poses/wave.png'),
  think: require('../assets/rusty/poses/think.png'),
  celebrate: require('../assets/rusty/poses/celebrate.png'),
  painting: require('../assets/rusty/poses/painting.png'),
  baking: require('../assets/rusty/poses/baking.png'),
  sleep: require('../assets/rusty/poses/sleep.png'),
} as const;
export type PoseImage = keyof typeof poses;

/** Stickers for keepsakes Rusty or the seed data creates. */
export const stickers: Record<string, number> = {
  notebook: require('../assets/objects/notebook.png'),
  guitar: require('../assets/objects/guitar.png'),
  sourdough: require('../assets/objects/sourdough.png'),
  'rusty-sleep': poses.sleep,
  // Rusty's diary pages and the cards he makes you
  'rusty-diary': poses.think,
  'rusty-card': poses.celebrate,
  'rusty-celebrate': poses.celebrate,
  ...Object.fromEntries(Object.entries(hobbyIcons).map(([k, v]) => [`hobby-${k}`, v])),
};
