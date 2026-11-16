/**
 * Talking to Rusty's brain (the `rusty` Supabase Edge Function → Claude).
 *
 * Every call has a hand-written fallback, so Rusty still answers when the
 * network or the API key isn't there. The context we send is a short plain-
 * text summary of the person's hobbies and week — never photos or location.
 */
import { hobbyIcons } from '@/assets';
import {
  checkinOf,
  hobbiesOf,
  openTasks,
  progressOf,
  recentActivity,
  skipSuggestionOf,
} from '@/data/selectors';
import { useStore } from '@/data/store';
import type { ChatMessage, Hobby, HobbyIcon, RustySuggestion } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { ago, greeting, whenLabel } from '@/lib/time';
import { useWorld } from '@/world/world';

import { pick } from '@/rusty/personality';

const TIMEOUT_MS = 15_000;

async function call<T>(mode: string, body: Record<string, unknown>): Promise<T | null> {
  if (!supabase) return null;
  try {
    const result = await Promise.race([
      supabase.functions.invoke('rusty', { body: { mode, context: buildContext(), ...body } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    if (result.error) throw result.error;
    return (result.data ?? null) as T | null;
  } catch (e) {
    console.warn(`[restie] rusty/${mode} fell back:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Plain-text snapshot of what Rusty knows right now. */
export function buildContext(): string {
  const s = useStore.getState();
  const w = useWorld.getState();
  const parts: string[] = [];
  const nowD = new Date();
  parts.push(
    `Person: ${s.profile.name || 'friend'}. It's ${nowD.toLocaleDateString('en-US', { weekday: 'long' })}, ` +
      `${greeting(nowD).toLowerCase()} (${nowD.getHours()}:${`${nowD.getMinutes()}`.padStart(2, '0')}). ` +
      `Outside: ${w.condition}, ${w.tempF ?? '?'}°F, ${w.phase}.`,
  );
  const hobbies = hobbiesOf(s);
  if (hobbies.length) {
    parts.push(
      'Hobbies:\n' +
        hobbies
          .map((h) => {
            const p = progressOf(s, h.id);
            let line = `- ${h.name} (${h.status}): `;
            line += h.kind === 'goal' ? `goal "${h.goal}"` : `keeping it in their life${h.rhythm ? `, ${h.rhythm}` : ''}`;
            if (p.milestones.length) line += `; ${p.milestonesDone}/${p.milestones.length} milestones done`;
            if (p.current) line += `; current milestone "${p.current.title}" (${p.stepsDone}/${p.stepsTotal} steps done)`;
            if (h.why) line += `; why: ${h.why}`;
            line += `; last worked on: ${ago(h.lastDoneAt).toLowerCase()}`;
            return line;
          })
          .join('\n'),
    );
  } else parts.push('No hobbies set up yet.');
  const open = openTasks(s).slice(0, 12);
  if (open.length) {
    parts.push(
      'Open list (hobby steps and to-dos):\n' +
        open
          .map((t) => {
            const h = t.hobbyId ? s.hobbies[t.hobbyId]?.name : null;
            return `- ${t.title}${h ? ` [${h} step]` : ' [to-do]'} · ${whenLabel(t.dueAt)}${t.priority !== 'normal' ? ` · ${t.priority} priority` : ''}${t.notYetCount ? ` · "not yet" ×${t.notYetCount}` : ''}`;
          })
          .join('\n'),
    );
  }
  const check = checkinOf(s);
  if (check) parts.push(`Due now: "${check.title}".`);
  const skip = skipSuggestionOf(s);
  if (skip) parts.push(`What could wait today: "${skip.task.title}" — ${skip.reason}`);
  const recent = recentActivity(s, undefined, 5);
  if (recent.length) parts.push('Recently:\n' + recent.map((a) => `- ${ago(a.createdAt)}: ${a.text}`).join('\n'));
  if (s.profile.mind.lessons.length) parts.push('You learned:\n' + s.profile.mind.lessons.map((l) => `- ${l}`).join('\n'));
  return parts.join('\n\n');
}

/* --------------------------------------------------------------------- chat */

export interface ChatReply {
  reply: string;
  suggestion: RustySuggestion | null;
  quickReplies: string[];
}

export async function chat(history: ChatMessage[], text: string): Promise<ChatReply> {
  const messages = history.slice(-16).map((m) => ({ role: m.role === 'rusty' ? 'assistant' : 'user', content: m.text }));
  const res = await call<{
    reply: string;
    suggestion: { type: 'focus' | 'plan' | 'none'; title: string; minutes: number; hobby: string };
    quickReplies: string[];
  }>('chat', { messages, text });
  if (res?.reply) {
    const s = useStore.getState();
    const hobby = hobbiesOf(s).find((h) => h.name.toLowerCase() === res.suggestion?.hobby?.toLowerCase());
    const suggestion =
      res.suggestion && res.suggestion.type !== 'none' && res.suggestion.title
        ? { type: res.suggestion.type, title: res.suggestion.title, minutes: res.suggestion.minutes || 5, hobbyId: hobby?.id ?? null }
        : null;
    return { reply: res.reply, suggestion, quickReplies: (res.quickReplies ?? []).slice(0, 3) };
  }
  return offlineChat(text);
}

/** Scripted Rusty for when the brain is offline (matches the med-fi script). */
function offlineChat(text: string): ChatReply {
  const s = useStore.getState();
  const t = text.toLowerCase();
  const hobbies = hobbiesOf(s);
  // Prefer the hobby whose step is due (what the person is probably stuck on),
  // then the one that's gone longest without attention.
  const due = checkinOf(s);
  const stale =
    (due?.hobbyId ? s.hobbies[due.hobbyId] : undefined) ??
    [...hobbies].sort((a, b) => (a.lastDoneAt ?? '').localeCompare(b.lastDoneAt ?? ''))[0];
  const step = stale ? (progressOf(s, stale.id).current?.title ?? stale.goal ?? stale.name) : null;
  if (/start|stuck|where|begin|procrast|motivat|can'?t|don'?t know/.test(t) && stale) {
    const tiny = firstTinyStep(stale, step ?? stale.name);
    return {
      reply: `let’s make it tiny. just ${tiny.toLowerCase()}. 5 minutes?`,
      suggestion: { type: 'focus', title: tiny, minutes: 5, hobbyId: stale.id },
      quickReplies: ['Maybe later', 'Something else'],
    };
  }
  if (/busy|tired|overwhelm|too much|stress|exhaust/.test(t)) {
    const skip = skipSuggestionOf(s);
    return {
      reply: skip
        ? `that sounds like a lot. honestly, "${skip.task.title}" can wait. want to move it to later and just rest a bit?`
        : 'that sounds like a lot. rest counts too. want to do one 5-minute thing, or just hang out with me?',
      suggestion: null,
      quickReplies: ['Just hang out', 'One small thing'],
    };
  }
  if (/day|you|doing|how are/.test(t)) {
    return {
      reply: pick([
        'I tried painting today! I think I like the messy part best. how was yours?',
        'I napped in the sunbeam, then I napped somewhere else. big day.',
        'I found a crumb under the desk. that was the highlight. what about you?',
      ]),
      suggestion: null,
      quickReplies: ['Pretty good', 'Kind of busy'],
    };
  }
  if (/plan|week|schedule|time/.test(t) && stale) {
    return {
      reply: `how about one tiny ${stale.name.toLowerCase()} step this weekend? small enough that it’s easy to say yes.`,
      suggestion: { type: 'plan', title: firstTinyStep(stale, step ?? stale.name), minutes: 10, hobbyId: stale.id },
      quickReplies: [],
    };
  }
  return {
    reply: pick([
      'mm, I’m listening. want to talk it through, or should we pick one tiny thing to try?',
      'okay! tell me more. I’m a very good listener (I have big ears).',
    ]),
    suggestion: null,
    quickReplies: ['Don’t know where to start', 'I’m pretty busy', 'How was your day?'],
  };
}

function firstTinyStep(h: Hobby, milestone: string): string {
  const byIcon: Partial<Record<HobbyIcon, string>> = {
    guitar: 'Play the first line',
    drawing: 'Do one quick sketch',
    baking: 'Read one recipe',
    reading: 'Read two pages',
    writing: 'Write three sentences',
    gardening: 'Water and check the plants',
  };
  return byIcon[h.icon] ?? `Spend 5 minutes on ${milestone.toLowerCase()}`;
}

/* ------------------------------------------------------- new hobby helpers */

export async function suggestGoals(hobby: string): Promise<string[]> {
  const res = await call<{ goals: string[] }>('goals', { hobby });
  if (res?.goals?.length) return res.goals.slice(0, 3);
  const fallback: Record<string, string[]> = {
    baking: ['Bake sourdough from scratch', 'Make my grandma’s cookies', 'Bake a birthday cake'],
    guitar: ['Play the movie song', 'Learn 3 campfire songs', 'Write my own little tune'],
    drawing: ['Sketch my neighborhood', 'Fill one sketchbook', 'Draw my friends'],
    reading: ['Read one book a month', 'Finish the book on my nightstand', 'Read a classic'],
    writing: ['Write a short story', 'Journal three times a week', 'Write a poem for a friend'],
    gardening: ['Grow my own herbs', 'Keep a plant alive all winter', 'Grow tomatoes'],
  };
  return fallback[hobby.toLowerCase()] ?? [`Get comfortable with ${hobby.toLowerCase()}`, `Make my first ${hobby.toLowerCase()} project`];
}

export interface PathSuggestion {
  milestones: string[];
  firstSteps: string[];
}

export async function suggestPath(hobby: string, goal: string): Promise<PathSuggestion> {
  const res = await call<PathSuggestion>('path', { hobby, goal });
  if (res?.milestones?.length) return { milestones: res.milestones.slice(0, 5), firstSteps: res.firstSteps.slice(0, 3) };
  return offlinePath(hobby, goal);
}

/**
 * Hand-written paths for when Claude isn't reachable. Matched on the goal
 * first (most specific), then the hobby; the last milestone is always the
 * person's own goal.
 */
const OFFLINE_PATHS: { match: RegExp; milestones: string[]; firstSteps: string[] }[] = [
  {
    match: /sourdough/i,
    milestones: ['Keep a starter alive for a week', 'Bake a simple yeasted loaf', 'Shape and score a boule'],
    firstSteps: ['Order a kitchen scale', 'Watch one starter video', 'Mix flour and water'],
  },
  {
    match: /cake|birthday/i,
    milestones: ['Bake a one-bowl snack cake', 'Make a smooth buttercream', 'Stack and frost two layers'],
    firstSteps: ['Pick a beginner cake recipe', 'Check my pans and tins'],
  },
  {
    match: /cookie|grandma/i,
    milestones: ['Ask for the original recipe', 'Bake a test batch', 'Tweak it until it tastes right'],
    firstSteps: ['Text family for the recipe', 'Buy butter and brown sugar'],
  },
  {
    match: /bak|bread|pastr/i,
    milestones: ['Bake a no-knead loaf', 'Learn to knead by hand', 'Bake a braided loaf'],
    firstSteps: ['Choose a no-knead recipe', 'Buy flour and yeast'],
  },
  {
    match: /song|guitar|chord|tune|campfire/i,
    milestones: ['Play G, C, D and Em cleanly', 'Strum a steady down-up pattern', 'Switch chords in rhythm', 'Play the verse along with the song'],
    firstSteps: ['Tune the guitar', 'Learn the G chord shape', 'Look up the song’s chords'],
  },
  {
    match: /sketch|draw|neighborhood|sketchbook|friends/i,
    milestones: ['Draw simple shapes from life', 'Shade one object with light', 'Sketch a scene in 15 minutes'],
    firstSteps: ['Draw my mug for 5 minutes', 'Sharpen a pencil and pick a spot'],
  },
  {
    match: /read|book|novel|classic/i,
    milestones: ['Pick a book I’m excited about', 'Read 10 pages most days', 'Finish the first half'],
    firstSteps: ['Put the book by my bed', 'Read just two pages'],
  },
  {
    match: /story|write|poem|journal/i,
    milestones: ['Write 100 words three times', 'Finish a rough first draft', 'Revise one draft', 'Share it with a friend'],
    firstSteps: ['Write three sentences', 'Choose one idea to try'],
  },
  {
    match: /herb|garden|plant|tomato|grow/i,
    milestones: ['Choose easy plants for my light', 'Pot them in good soil', 'Water on a simple schedule', 'Harvest the first leaves'],
    firstSteps: ['Check which window gets sun', 'Buy one basil plant'],
  },
];

function offlinePath(hobby: string, goal: string): PathSuggestion {
  const hit = OFFLINE_PATHS.find((p) => p.match.test(goal)) ?? OFFLINE_PATHS.find((p) => p.match.test(hobby));
  if (hit) {
    const end = hit.milestones.at(-1)?.toLowerCase() === goal.toLowerCase() ? [] : [goal];
    return { milestones: [...hit.milestones, ...end].slice(0, 5), firstSteps: hit.firstSteps };
  }
  const h = hobby.toLowerCase();
  return {
    milestones: [`Learn the basics of ${h}`, `Finish one small ${h} project`, `Do ${h} weekly for a month`, goal],
    firstSteps: [`Watch one beginner ${h} video`, `Gather what I need for ${h}`],
  };
}

/** Next tiny steps for a milestone, or a smaller version of a step. */
export async function suggestSteps(hobby: Hobby, milestone: string, smallerThan?: string): Promise<{ title: string; minutes: number }[]> {
  const res = await call<{ steps: { title: string; minutes: number }[] }>('steps', {
    hobby: hobby.name,
    goal: hobby.goal,
    milestone,
    smallerThan: smallerThan ?? null,
  });
  if (res?.steps?.length) return res.steps.slice(0, 3);
  if (smallerThan) return [{ title: `Just 5 minutes of: ${smallerThan.toLowerCase()}`, minutes: 5 }, { title: `Get things out for ${hobby.name.toLowerCase()}`, minutes: 2 }];
  return [
    { title: firstTinyStep(hobby, milestone), minutes: 10 },
    { title: `Watch one video about ${milestone.toLowerCase()}`, minutes: 10 },
  ];
}

/* --------------------------------------------------------------- daily lines */

export interface DailyLines {
  lines: string[];
  trip: { caption: string; line: string } | null;
}

/** A handful of fresh things for Rusty to say today (cached per day). */
export async function dailyLines(): Promise<DailyLines | null> {
  return call<DailyLines>('lines', {});
}

export const iconImage = (icon: HobbyIcon) => hobbyIcons[icon];

/* ------------------------------------------------------------------ diary */

/** Rusty's diary page about a day, from the facts of that day (null → offline). */
export async function diaryPage(facts: string): Promise<{ title: string; entry: string } | null> {
  const res = await call<{ title: string; entry: string }>('diary', { text: facts });
  return res?.entry ? res : null;
}
