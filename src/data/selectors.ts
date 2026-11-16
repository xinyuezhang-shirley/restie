/** Derived views of the store. Pure functions: (state, …) → value. */
import { daysBetween, dayKey, isThisWeek } from '@/lib/time';

import { alive, type RestieState } from './store';
import type { Activity, Hobby, Keepsake, Milestone, Task } from './types';

export const hobbiesOf = (s: RestieState): Hobby[] =>
  alive(s.hobbies)
    .filter((h) => h.status !== 'done')
    .sort((a, b) => {
      // Brand-new hobbies float to the top (med-fi: the new Baking card).
      const fresh = (h: Hobby) => daysBetween(new Date(h.createdAt), new Date()) < 1 ? 1 : 0;
      if (fresh(a) !== fresh(b)) return fresh(b) - fresh(a);
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return (b.lastDoneAt ?? b.createdAt).localeCompare(a.lastDoneAt ?? a.createdAt);
    });

export const milestonesOf = (s: RestieState, hobbyId: string): Milestone[] =>
  alive(s.milestones)
    .filter((m) => m.hobbyId === hobbyId)
    .sort((a, b) => a.position - b.position);

export const currentMilestone = (s: RestieState, hobbyId: string): Milestone | undefined =>
  milestonesOf(s, hobbyId).find((m) => !m.doneAt);

const byCreated = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt);

/**
 * A hobby's steps, in the order they were added (done ones stay in place so
 * progress is visible and undo is one tap away). Let-go steps are hidden.
 *   milestoneId undefined → every step of the hobby
 *   milestoneId null      → steps not under any (existing) milestone
 */
export function stepsOf(s: RestieState, hobbyId: string, milestoneId?: string | null): Task[] {
  return alive(s.tasks)
    .filter((t) => t.kind === 'promise' && t.hobbyId === hobbyId && t.status !== 'let_go')
    .filter((t) => {
      if (milestoneId === undefined) return true;
      const m = t.milestoneId ? s.milestones[t.milestoneId] : undefined;
      const home = m && !m.deletedAt ? m.id : null;
      return home === milestoneId;
    })
    .sort(byCreated);
}

export interface Count {
  done: number;
  total: number;
}

/** "2 of 4 steps" — counts the milestone's real steps. */
export const milestoneCount = (s: RestieState, hobbyId: string, milestoneId: string): Count => {
  const steps = stepsOf(s, hobbyId, milestoneId);
  return { done: steps.filter((t) => t.status === 'done').length, total: steps.length };
};

export const substepCount = (t: Task): Count => {
  const list = t.substeps ?? [];
  return { done: list.filter((x) => x.done).length, total: list.length };
};

export interface HobbyProgress {
  milestones: Milestone[];
  currentIndex: number; // == milestones.length when everything is done
  current?: Milestone;
  milestonesDone: number;
  /** steps in the current milestone */
  stepsDone: number;
  stepsTotal: number;
}

export function progressOf(s: RestieState, hobbyId: string): HobbyProgress {
  const milestones = milestonesOf(s, hobbyId);
  const idx = milestones.findIndex((m) => !m.doneAt);
  const currentIndex = idx === -1 ? milestones.length : idx;
  const current = milestones[currentIndex];
  const count = current ? milestoneCount(s, hobbyId, current.id) : { done: 0, total: 0 };
  return {
    milestones,
    currentIndex,
    current,
    milestonesDone: milestones.filter((m) => m.doneAt).length,
    stepsDone: count.done,
    stepsTotal: count.total,
  };
}

/** The step to show as "Next" for a hobby: earliest paw promise, else the
 *  first open step in the current milestone, else any open step. */
export function nextStepOf(s: RestieState, hobbyId: string): Task | undefined {
  // Steps left open under a milestone you already marked done look finished,
  // so they're never "next".
  const open = stepsOf(s, hobbyId).filter((t) => t.status === 'open' && !(t.milestoneId && s.milestones[t.milestoneId]?.doneAt));
  const promised = open.filter((t) => t.dueAt).sort(byDue)[0];
  if (promised) return promised;
  const cur = currentMilestone(s, hobbyId);
  return open.find((t) => t.milestoneId === cur?.id) ?? open[0];
}

const byDue = (a: Task, b: Task) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');

export const openTasks = (s: RestieState): Task[] =>
  alive(s.tasks).filter((t) => t.status === 'open').sort(byDue);

/** Open hobby steps (with or without a day). */
export const openSteps = (s: RestieState, hobbyId?: string): Task[] =>
  openTasks(s).filter((t) => t.kind === 'promise' && (!hobbyId || t.hobbyId === hobbyId));

/** Paw promises: open hobby steps that have a day. */
export const openPromises = (s: RestieState, hobbyId?: string): Task[] =>
  openSteps(s, hobbyId).filter((t) => !!t.dueAt);

/** "This week" plans on Home: promises due in the next 7 days (or overdue). */
export const thisWeekPlans = (s: RestieState): Task[] =>
  openPromises(s).filter((t) => isThisWeek(t.dueAt));

export interface UpNext {
  task: Task;
  /** why it's here: late, today, this week, or a hobby's next step with no day */
  when: 'late' | 'today' | 'week' | 'anytime';
}

/**
 * Home's "Up next": the go-to list for what's most immediate. Everything that
 * has a day this week — paw promises and everyday to-dos alike — late first,
 * then each hobby's next step that has no day yet ("Anytime"), so a step you
 * just added always shows up somewhere.
 */
export function upNextOf(s: RestieState): UpNext[] {
  const today = dayKey();
  const dated: UpNext[] = openTasks(s)
    .filter((t) => isThisWeek(t.dueAt))
    .map((t) => {
      const d = dayKey(new Date(t.dueAt!));
      return { task: t, when: d < today ? 'late' : d === today ? 'today' : 'week' };
    });
  const seen = new Set(dated.map((u) => u.task.id));
  const anytime: UpNext[] = hobbiesOf(s)
    .filter((h) => h.status === 'active')
    .map((h) => nextStepOf(s, h.id))
    .filter((t): t is Task => !!t && !t.dueAt && !seen.has(t.id))
    .map((t) => ({ task: t, when: 'anytime' }));
  return [...dated, ...anytime];
}

/** The one promise Rusty asks about: the most overdue one due by today. */
export function checkinOf(s: RestieState): Task | undefined {
  const today = dayKey();
  return openPromises(s).find((t) => t.dueAt && dayKey(new Date(t.dueAt)) <= today);
}

/** Everything that lands on today: due today or overdue, both kinds. */
export const todaysLoad = (s: RestieState): Task[] => {
  const today = dayKey();
  return openTasks(s).filter((t) => t.dueAt && dayKey(new Date(t.dueAt)) <= today);
};

export interface SkipSuggestion {
  task: Task;
  reason: string;
}

const PRIORITY_WEIGHT = { low: 3, normal: 1.4, high: 0 } as const;

/**
 * "You have a lot going on — this can wait."
 * One decision a day. Only when the day is actually full. Never something
 * the person already chose to keep, and never a high-priority to-do.
 * Rusty prefers moving everyday chores so the hobby step fits, which is the
 * point of Restie; a hobby promise is suggested only when it was already
 * pushed back or the day is overloaded.
 */
export function skipSuggestionOf(s: RestieState): SkipSuggestion | undefined {
  const today = dayKey();
  if (s.profile.mind.skipLedger.some((l) => l.date === today)) return undefined;
  const load = todaysLoad(s);
  const week = openTasks(s).filter((t) => isThisWeek(t.dueAt));
  const busy = load.length >= 3 || week.length >= 6;
  if (!busy) return undefined;

  const declined = s.profile.mind.skipLedger.filter((l) => l.decision === 'keep').length;
  // Only everyday to-dos are ever suggested — paw promises are what we're
  // making room for (same rule as Mycoto).
  const candidates = (load.length >= 2 ? load : week).filter(
    (t) => t.kind === 'todo' && !t.keptAt && t.priority !== 'high',
  );
  if (candidates.length === 0) return undefined;
  const score = (t: Task) =>
    PRIORITY_WEIGHT[t.priority] + t.deferCount * 0.5 + (t.minutes && t.minutes >= 45 ? 1 : 0) - declined * 0.2;
  const task = [...candidates].sort((a, b) => score(b) - score(a))[0];
  const hobbyStep = load.find((t) => t.kind === 'promise');
  const reason = hobbyStep
    ? `You have ${load.length} things on today. "${task.title}" isn't urgent. Moving it to later makes room for "${hobbyStep.title}".`
    : `You have ${load.length} things on today. "${task.title}" isn't urgent, so it can move to later this week.`;
  return { task, reason };
}

export const recentActivity = (s: RestieState, hobbyId?: string, n = 6): Activity[] =>
  alive(s.activities)
    .filter((a) => !hobbyId || a.hobbyId === hobbyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, n);

export const keepsakesOf = (s: RestieState): Keepsake[] =>
  alive(s.keepsakes).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const pinnedKeepsakes = (s: RestieState): Keepsake[] =>
  keepsakesOf(s).filter((k) => k.pinned).slice(0, 3);

/** Is there something Rusty wants to bring up? Drives the "!" over his head. */
export function rustyHasNews(s: RestieState): 'checkin' | 'skip' | null {
  if (checkinOf(s)) return 'checkin';
  if (skipSuggestionOf(s)) return 'skip';
  return null;
}

/**
 * What each hobby has grown into in Rusty's room: 1 when it's added, 2 at its
 * first finished milestone, 3 at three. Paused hobbies keep theirs; two hobbies
 * with the same icon show the further-along one.
 */
export function roomHomesOf(s: RestieState): Partial<Record<Hobby['icon'], 1 | 2 | 3>> {
  const out: Partial<Record<Hobby['icon'], 1 | 2 | 3>> = {};
  for (const h of hobbiesOf(s)) {
    const done = milestonesOf(s, h.id).filter((m) => m.doneAt).length;
    const stage = done >= 3 ? 3 : done >= 1 ? 2 : 1;
    out[h.icon] = Math.max(out[h.icon] ?? 1, stage) as 1 | 2 | 3;
  }
  return out;
}
