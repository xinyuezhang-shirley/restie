/**
 * One vocabulary for the whole app (heuristic eval: "unify the syntax").
 *
 *   Hobby       something you love doing                 Guitar
 *   Goal        what you're working toward               Play the movie song
 *   Milestone   a stage on the way to the goal           Learn verse 3
 *   Step        one small thing you can do in a sitting  Find chords for verse 3
 *   Substep     a checklist item inside a step           Look up the bridge chords
 *   Paw promise a step with a day you promised Rusty     🐾 Sat · 10 min
 *   To-do       an everyday, non-hobby thing             Problem set 6
 *
 * Verbs: "Log a step" / "Mark done" → "Step done" (+ Undo) · "Promise" (give a
 * step a day) · "Edit path" (change milestones). Rusty may say "tiny" in his
 * own voice, but labels always use the words above.
 */
import type { Count } from '@/data/selectors';
import { whenLabel } from '@/lib/time';

export const WORDS = {
  goal: 'Goal',
  milestone: 'Milestone',
  milestones: 'Milestones',
  step: 'Step',
  steps: 'Steps',
  substep: 'Substep',
  substeps: 'Substeps',
  promise: 'Paw promise',
  promises: 'Paw promises',
  todo: 'To-do',
  todos: 'To-dos',
  path: 'Path',
  /** photos & notes you save (never "memory") */
  keepsake: 'Keepsake',
  /** the clock on Home (never "Pomodoro" / "work-with-me session") */
  focus: 'Focus timer',
  /** hobbies with no finish line */
  forFun: 'Just for fun',
} as const;

/** "1 step", "3 steps" */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "2 of 4 steps" */
export const ofCount = (c: Count, word = 'step') => `${c.done} of ${c.total} ${word}${c.total === 1 ? '' : 's'}`;

/**
 * What a step's day means, said plainly (heuristic eval #36: "Today" alone was
 * ambiguous): "🐾 Planned for today", "🐾 Planned for Sat 10am".
 */
export function plannedFor(iso?: string | null, timed?: boolean): string {
  if (!iso) return 'No day yet';
  const w = whenLabel(iso, timed);
  if (w.startsWith('Earlier') || w.startsWith('Yesterday')) return '🐾 Still open from earlier';
  return `🐾 Planned for ${/^(Today|Tomorrow)/.test(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w}`;
}

/** "Last worked on today" / "Not started yet" */
export const lastWorked = (ago: string) => (ago === 'Not yet' ? 'Not started yet' : `Last worked on ${/^[A-Z][a-z]{2} \d/.test(ago) ? ago : ago.toLowerCase()}`);

/** Spoken version for screen readers: "2 of 4 steps done" */
export const ofCountA11y = (c: Count, word = 'step') => `${ofCount(c, word)} done`;
