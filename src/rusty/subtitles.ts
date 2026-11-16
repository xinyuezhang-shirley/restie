/**
 * The little line above the room saying what Rusty is up to, like Mycoto's
 * narration: specific, a bit silly, never "Rusty is idle". Lines rotate every
 * couple of minutes within an activity (stable in between, so no flicker),
 * and some are about you: the hobby you share, the step due today.
 */
import { alive, useStore } from '@/data/store';
import type { HobbyIcon } from '@/data/types';
import type { Condition, Phase } from '@/world/world';

const HOBBY: Record<HobbyIcon, string[]> = {
  drawing: [
    'painting a tree that looks a lot like broccoli',
    'mixing a color he’s named “sunset nap”',
    'signing his painting with one paw print',
    'squinting at his painting from very far away',
    'painting the view, but with more fish in it',
    'washing his brush in the wrong cup again',
  ],
  baking: [
    'guarding the dough while it rises',
    'measuring flour with great confidence and no spoon',
    'taste-testing. for science',
    'reading a recipe upside down',
    'waiting by the oven like it owes him money',
  ],
  guitar: [
    'tuning the same string for the fifth time',
    'writing a song about the rug',
    'practicing a chord, mostly with his claws',
    'playing one note very dramatically',
    'humming the part he can’t play yet',
  ],
  reading: [
    'reading the same page again (he dozed off)',
    'using his book as a pillow. technically still reading',
    'guessing the ending out loud',
    'reading the exciting part very slowly',
  ],
  writing: [
    'writing a poem that rhymes “cat” with “cat”',
    'chewing his pen thoughtfully',
    'crossing out a word and feeling powerful',
    'writing the first line, again',
  ],
  gardening: [
    'telling the little plant about his day',
    'counting the leaves. still four',
    'giving the plant exactly one sip of water',
    'checking if the plant grew while he blinked',
  ],
  other: [
    'tinkering with something small and important',
    'starting a project he will definitely finish',
    'sorting his things into piles of one',
  ],
};

/** Shared with you: the hobby's step that's due today. */
const TOGETHER = [(step: string) => `practicing “${step}” too, so you’re not alone`, (step: string) => `saving you a spot for “${step}”`];

const WINDOW: Record<Condition, string[]> = {
  clear: ['watching a bird he will never catch', 'counting clouds and losing count', 'warming one ear in the sun', 'chattering at a very rude pigeon'],
  cloudy: ['finding shapes in the clouds (mostly fish)', 'waiting for the sun to come back', 'judging the clouds, kindly'],
  fog: ['waiting for the fog to finish its sentence', 'pretending he can see through the fog'],
  rain: ['racing raindrops down the glass', 'listening to the rain tell a long story', 'glad he’s inside, smugly'],
  snow: ['trying to catch snowflakes through the glass', 'counting snowflakes. one, one, one…'],
  storm: ['being very brave about the thunder', 'keeping an eye on the storm for you'],
};
const WINDOW_NIGHT = ['looking for the moon', 'wishing on a star (it might be a plane)', 'watching the streetlights blink on', 'saying goodnight to the birds'];

const THINK = [
  'wondering what clouds taste like',
  'trying to remember a dream about fish',
  'thinking about snacks, mostly',
  'planning something. he won’t say what',
  'having a quiet, important thought',
  'wondering where the red dot went',
];
const NAP = [
  'napping in his bed',
  'dreaming of chasing a very slow mouse',
  'asleep with one ear listening for you',
  'snoring very politely',
  'napping in a perfect circle',
];
const NIGHT_SLEEP = ['asleep. it’s late (you could be too)', 'fast asleep, paws twitching', 'dreaming about tomorrow'];
const SIT = [
  'grooming one very specific spot',
  'having a staring contest with the lamp',
  'doing absolutely nothing, beautifully',
  'listening to the house hum',
  'stretching one leg at a time',
  'sitting like a loaf of bread',
];
const DOOR = ['listening at the door for adventures', 'wondering where the door goes', 'waiting for the mail. there is no mail', 'plotting his next little trip'];
const ASKED = ['sitting right where you asked, very proudly', 'checking out the spot you picked. good spot', 'wondering why here. he likes it, though'];

/** A stable pick from a list: same seed → same line. */
const at = <T,>(list: T[], seed: number) => list[Math.abs(seed) % list.length];

export function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export interface SubtitleContext {
  kind: string;
  pose: string;
  spot: string;
  icon?: HobbyIcon;
  condition: Condition;
  phase: Phase;
  /** changes every couple of minutes within an activity */
  seed: number;
}

export function subtitleFor(c: SubtitleContext): string {
  const say = (t: string) => `Rusty is ${t}`;
  const night = c.phase === 'night' || c.phase === 'dusk';
  if (c.kind === 'tour') return 'Rusty is waiting to meet you';
  if (c.kind === 'asked' && c.pose === 'sleep') return 'Rusty is napping in his bed (you said so)';
  if (c.kind === 'asked') return say(at(ASKED, c.seed));
  if (c.pose === 'wave') return 'Rusty is waving hello';

  // A hobby: sometimes about your step for the same hobby, due today.
  const icon = c.kind === 'hobby' ? c.icon : c.pose === 'paint' ? 'drawing' : c.pose === 'cook' ? 'baking' : undefined;
  if (icon) {
    const s = useStore.getState();
    const today = new Date().toDateString();
    const yours = alive(s.tasks).find(
      (t) => t.status === 'open' && t.dueAt && new Date(t.dueAt).toDateString() === today && t.hobbyId && s.hobbies[t.hobbyId]?.icon === icon,
    );
    if (yours && c.seed % 3 === 0) return say(at(TOGETHER, c.seed)(yours.title.charAt(0).toLowerCase() + yours.title.slice(1)));
    return say(at(HOBBY[icon] ?? HOBBY.other, c.seed));
  }
  if (c.kind === 'sleep') return say(at(NIGHT_SLEEP, c.seed));
  if (c.pose === 'sleep') return say(at(night ? NIGHT_SLEEP : NAP, c.seed));
  if (c.kind === 'window' || (c.spot === 'window' && c.pose === 'sit')) return say(at(night ? WINDOW_NIGHT : WINDOW[c.condition], c.seed));
  if (c.pose === 'think') return say(c.spot === 'bed' ? at(['daydreaming in his bed', ...THINK], c.seed) : at(THINK, c.seed));
  if (c.spot === 'door') return say(at(DOOR, c.seed));
  return say(at(SIT, c.seed));
}
