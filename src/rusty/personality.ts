/**
 * Rusty's personality, offline edition.
 *
 * The full character prompt lives in supabase/functions/rusty/index.ts. These
 * hand-written lines are what he says when the AI isn't reachable, and for
 * the many tiny moments (being petted, waking up) that don't need a model.
 *
 * Who Rusty is: a curious, cozy orange tabby. He picks up your hobbies and is
 * cheerfully bad at them. Dramatic about tiny things (a leaf on the sill is
 * news). Loves naps, sunbeams and rain sounds. Brings back small treasures
 * from walks. Gently honest: he'll tell you what can wait. Never guilt.
 */
import type { Condition, Phase } from '@/world/world';

export const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export const lines = {
  greet: {
    dawn: ['you’re up early. the light is all pink on the floor.', 'morning. I saved you the sunny spot.'],
    day: ['oh hi! I was just about to do something important. probably.', 'hello! the room feels better with you in it.'],
    golden: ['the sun is doing the golden thing again. my favorite.', 'hi! everything looks like honey right now.'],
    dusk: ['evening already? I blinked and it got orange.', 'hi. good time for one tiny thing, then rest.'],
    night: ['it’s late. I’m mostly blanket right now.', 'shh, the moon is out. hi though.'],
  } satisfies Record<Phase, string[]>,
  weather: {
    clear: ['there’s a sunbeam on the rug and I am claiming it.', 'clear skies. the window is showing off.'],
    cloudy: ['clouds today. cozy weather for small projects.', 'it’s gray out. good day to stay in and make something.'],
    fog: ['the fog ate the trees outside. they’ll be back.', 'foggy. everything outside is a secret.'],
    rain: ['it’s raining! best sound in the world. I’m staying right here.', 'rain on the window. perfect weather for one tiny step.'],
    snow: ['snow?! I need to look at it for several hours.', 'it’s snowing. I am not going outside. you can’t make me.'],
    storm: ['thunder. I’m fine. I’m under the bed. I’m fine.', 'big storm. let’s stay in and do something small.'],
  } satisfies Record<Condition, string[]>,
  painting: ['I tried painting today! I think I like the messy part best.', 'I painted a tree. it looks like a broccoli. I love it.'],
  baking: ['I’m mixing something. I don’t know what yet.', 'flour is everywhere. this is how you know it’s going well.'],
  music: ['I’ve been practicing. mostly on the guitar strings with my claws.', 'I hummed your song all morning. the plant liked it.'],
  reading: ['I read two pages and then napped on the book. still counts.', 'this book has a cat in it. I approve.'],
  writing: ['I wrote a poem. it’s one word long. the word is “nap.”', 'I’m keeping a diary now. today: sunbeam.'],
  gardening: ['I talked to the plant today. it didn’t say much.', 'the little plant grew a new leaf! big news.'],
  thinking: ['hm. I’m thinking about snacks. and your project. mostly snacks.', 'I have an idea. it’s small. small ideas are the best ones.'],
  sleeping: ['zzz… (he’s asleep. tap to say hi.)'],
  pet: ['purrrr. okay, five more minutes of that.', 'hehe. right behind the ears. perfect.', 'that’s the spot. you can stay.', 'mrrp! hi!', '*happy slow blink*'],
  poke: ['hm? oh, hi!', 'you found me.', 'hehe, that tickles.', 'hello hello.', 'boop received.', '*tail swish*'],
  /** lots of taps in a row */
  tooMuch: ['okay okay! I’m awake! very awake!', 'that’s a lot of boops. I’m dizzy now.', 'hehe, stop, I’m ticklish!'],
  /** when he has a check-in and you tap instead of holding */
  holdHint: ['psst… tap the ! next to me (or hold me). I have something to ask you.', 'hold me for a sec? I wanted to check in.'],
  woken: ['mm? …oh, it’s you. hi.', '*yawns very big* I was only resting my eyes.', 'I was dreaming about fish. hi.'],
  celebrate: ['you did it! I’m doing a little dance.', 'look at you go. that’s a real step.', 'yay! another one for the wall.'],
  missing: ['no rush. I kept your spot warm.', 'hi again. we can start with something tiny.', 'it’s been a while — no pressure at all.'],
  trip: [
    { caption: 'A smooth pebble from the creek', line: 'I went on a walk and found this pebble. it looks like a bread roll. it’s yours now.' },
    { caption: 'A red leaf, perfectly crunchy', line: 'look what I found by the door! a leaf. the crunchiest one.' },
    { caption: 'A bottle cap that sparkles', line: 'treasure! I found it near the café. it sparkles if you tilt it.' },
    { caption: 'A tiny feather', line: 'a bird left this. I didn’t chase it. much.' },
  ],
};

/** What Rusty says about what he's doing, based on your hobbies. */
export function activityLine(icon: string | undefined): string {
  switch (icon) {
    case 'drawing':
      return pick(lines.painting);
    case 'baking':
      return pick(lines.baking);
    case 'guitar':
      return pick(lines.music);
    case 'reading':
      return pick(lines.reading);
    case 'writing':
      return pick(lines.writing);
    case 'gardening':
      return pick(lines.gardening);
    default:
      return pick(lines.thinking);
  }
}

/** The gentle check-in ladder, phrased in Rusty's voice. */
export const notYetLadder = {
  1: 'that’s okay! want to move it, or make it smaller?',
  2: 'still tricky? let’s shrink it way down, or do it together right now.',
  3: 'this one keeps slipping, and that’s information, not failure. keep trying, save it for later, or let it go?',
} as const;

/** "Find chords for verse 3" → "Did you find chords for verse 3?" */
export function checkinQuestion(title: string): string {
  const t = title.charAt(0).toLowerCase() + title.slice(1).replace(/[.!?]+$/, '');
  return `Did you ${t}?`;
}

/**
 * Tapping a hobby's object in his room: Rusty's working on his own version of
 * your hobby, at about the same stage you are. You're not doing this alone.
 */
const OBJECT_LINES: Record<string, [string[], string[], string[]]> = {
  drawing: [
    ['my sketchbook! I’m practicing circles. they’re mostly ovals. we’re both starting somewhere.', 'I draw a little every day too. today: one (1) leaf.'],
    ['I set up an easel like you! the canvas is still blank. blank is brave.', 'I’m working on a painting too. we can be beginners together.'],
    ['I finished one! you reached a milestone, so I pushed through mine too.', 'look at our painting corner. we made that, one small step at a time.'],
  ],
  baking: [
    ['my mixing bowl. I’m learning too — mostly how flour gets everywhere.', 'I stir a little every day. like you, but messier.'],
    ['I bought flour! big commitment. you’re doing yours, I’m doing mine.', 'I’m practicing my dough. it’s… shaped. we’re getting there.'],
    ['my first loaf! you hit a milestone, and look — so did I.', 'I made bread! it’s lopsided and perfect. like real progress.'],
  ],
  writing: [
    ['my notebook. I write one line a day. today’s was “nap.”', 'I’m writing too. small pages count.'],
    ['I’ve been writing! mostly about the window. you keep going, I’ll keep going.', 'two pages! we’re both filling notebooks.'],
    ['a whole stack of notebooks! we really kept at it, didn’t we.', 'I filled these one tiny entry at a time. same as you.'],
  ],
  reading: [
    ['my book. I’m on page two. we’re reading at the same pace, probably.', 'I read a little before naps. it counts.'],
    ['three books! I finish a chapter when you finish a step.', 'I’m reading too. a cat in this one is very brave.'],
    ['look at my stack. we’ve been reading a lot, you and me.', 'five books! I didn’t nap on all of them.'],
  ],
  guitar: [
    ['my guitar case. I haven’t opened it yet. you go first, then me.', 'I’m learning too. so far: one string, very loudly.'],
    ['I practice when you do. my claws are not ideal, but still.', 'I learned a chord! it’s mostly purring. we’re both learning.'],
    ['I play a little song now. you reached a milestone, so I learned one too.', 'my stool and songbook. we built a whole music corner.'],
  ],
  gardening: [
    ['I planted a seed! now we wait. waiting is part of it.', 'I water it every morning, like you showing up for yours.'],
    ['a sprout! small steps, see? both of us.', 'it grew a new leaf. I told it about your progress.'],
    ['it’s blooming! we grew this, slowly, together.', 'flowers! all from tiny, daily care. like yours.'],
  ],
  other: [
    ['my basket for little projects. I’m working on things too, just like you.', 'I keep my tries in here. tries count.'],
    ['two things in my basket now! you’re making progress, so am I.', 'I’m collecting small wins. like you.'],
    ['my basket is full! look how much we’ve both done.', 'so many little projects. none of them perfect. all of them ours.'],
  ],
};

export function objectLine(icon: string, stage: 1 | 2 | 3): string {
  return pick((OBJECT_LINES[icon] ?? OBJECT_LINES.other)[stage - 1]);
}
