/**
 * Everything a person can do, as plain functions. Screens call these; they
 * update the store (which syncs) and keep side effects (reminders) in step.
 */
import { cancelCheckin, scheduleCheckin } from '@/lib/notifications';
import { addDays, dayKey, now, resolveWhen, uuid, type WhenChoice } from '@/lib/time';

import { milestoneCount, milestonesOf, progressOf } from './selectors';
import { alive, patch, patchMind, put, remove, showToast, useStore } from './store';
import type { Hobby, HobbyIcon, Keepsake, Milestone, Substep, Task } from './types';

const notifyOn = () => useStore.getState().profile.settings.notifications;

export function logActivity(kind: Parameters<typeof put<'activities'>>[1]['kind'], text: string, hobbyId?: string | null) {
  return put('activities', { kind, text, hobbyId: hobbyId ?? null, createdAt: now() });
}

/** Undo removes the history line an action wrote (most recent match). */
function unlogActivity(kind: string, text: string, hobbyId?: string | null) {
  const hit = alive(useStore.getState().activities)
    .filter((a) => a.kind === kind && a.text === text && (a.hobbyId ?? null) === (hobbyId ?? null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (hit) remove('activities', hit.id);
}

/* ----------------------------------------------------------------- hobbies */

export interface NewHobbyInput {
  name: string;
  icon: HobbyIcon;
  kind: 'goal' | 'keep';
  goal?: string;
  why?: string;
  rhythm?: string;
  milestones: string[];
  firstStep?: { title: string; minutes?: number; dueAt: Date | null; timed?: boolean };
}

export function createHobby(input: NewHobbyInput): Hobby {
  const hobby = put('hobbies', {
    name: input.name,
    icon: input.icon,
    kind: input.kind,
    goal: input.goal ?? null,
    why: input.why ?? null,
    rhythm: input.rhythm ?? null,
    status: 'active',
    createdAt: now(),
    lastDoneAt: null,
  });
  const ms = input.milestones.map((title, position) =>
    put('milestones', { hobbyId: hobby.id, title, position, stepsTarget: 3, doneAt: null }),
  );
  logActivity('hobby_started', `Started ${input.name.toLowerCase()}`, hobby.id);
  if (input.firstStep) {
    addPromise({
      hobbyId: hobby.id,
      milestoneId: ms[0]?.id ?? null,
      title: input.firstStep.title,
      minutes: input.firstStep.minutes,
      dueAt: input.firstStep.dueAt,
      timed: input.firstStep.timed,
    });
  }
  return hobby;
}

export function updateHobby(id: string, changes: Partial<Hobby>) {
  patch('hobbies', id, changes);
}

export function setHobbyStatus(id: string, status: Hobby['status']) {
  patch('hobbies', id, { status });
  if (status !== 'active') {
    for (const t of alive(useStore.getState().tasks)) {
      if (t.hobbyId === id && t.status === 'open') void cancelCheckin(t.id);
    }
  }
}

export function deleteHobby(id: string) {
  const s = useStore.getState();
  for (const t of alive(s.tasks)) if (t.hobbyId === id) {
    remove('tasks', t.id);
    void cancelCheckin(t.id);
  }
  for (const m of alive(s.milestones)) if (m.hobbyId === id) remove('milestones', m.id);
  remove('hobbies', id);
}

/* -------------------------------------------------------------- milestones */

export function addMilestone(hobbyId: string, title: string): Milestone {
  const position = milestonesOf(useStore.getState(), hobbyId).length;
  return put('milestones', { hobbyId, title, position, stepsTarget: 3, doneAt: null });
}

export function renameMilestone(id: string, title: string) {
  patch('milestones', id, { title });
}

/** Deleting a milestone keeps its steps (they move to "Other steps"). */
export function deleteMilestone(id: string) {
  remove('milestones', id);
}

export function deleteMilestoneWithSteps(id: string) {
  for (const t of alive(useStore.getState().tasks)) if (t.milestoneId === id) deleteTask(t.id);
  remove('milestones', id);
}

export function moveMilestone(hobbyId: string, id: string, dir: -1 | 1) {
  const list = milestonesOf(useStore.getState(), hobbyId);
  const i = list.findIndex((m) => m.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  patch('milestones', list[i].id, { position: j });
  patch('milestones', list[j].id, { position: i });
}

/** Milestones are only ever marked done by the person (never automatically). */
export function setMilestoneDone(id: string, done: boolean) {
  const m = useStore.getState().milestones[id];
  if (!m || !!m.doneAt === done) return;
  patch('milestones', id, { doneAt: done ? now() : null });
  const text = `Reached "${m.title}"`;
  if (done) logActivity('milestone_done', text, m.hobbyId);
  else unlogActivity('milestone_done', text, m.hobbyId);
}

/** Checkbox on a milestone, with Undo. */
export function toggleMilestone(id: string) {
  const m = useStore.getState().milestones[id];
  if (!m) return;
  const done = !m.doneAt;
  setMilestoneDone(id, done);
  if (done) {
    const left = milestoneCount(useStore.getState(), m.hobbyId, id);
    const open = left.total - left.done;
    showToast(
      open > 0 ? `“${m.title}” done. ${open} open step${open === 1 ? '' : 's'} stay${open === 1 ? 's' : ''} in the list.` : `Milestone reached: ${m.title}`,
      () => setMilestoneDone(id, false),
    );
  } else showToast(`“${m.title}” is open again.`, () => setMilestoneDone(id, true));
}

/* ------------------------------------------------------- promises & to-dos */

export interface PromiseInput {
  hobbyId: string;
  /** undefined = the hobby's current milestone */
  milestoneId?: string | null;
  title: string;
  minutes?: number;
  /** a day makes it a paw promise; null = a step for "someday" */
  dueAt: Date | null;
  timed?: boolean;
  substeps?: string[];
}

/** Add a hobby step. With a day it's a paw promise (Rusty checks in then). */
export function addStep(input: PromiseInput): Task {
  return addPromise(input);
}

export function addPromise(input: PromiseInput): Task {
  const milestoneId =
    input.milestoneId === undefined
      ? progressOf(useStore.getState(), input.hobbyId).current?.id ?? null
      : input.milestoneId;
  const task = put('tasks', {
    kind: 'promise',
    hobbyId: input.hobbyId,
    milestoneId,
    title: input.title,
    minutes: input.minutes ?? null,
    dueAt: input.dueAt?.toISOString() ?? null,
    timed: input.timed ?? false,
    priority: 'normal',
    status: 'open',
    notYetCount: 0,
    deferCount: 0,
    keptAt: null,
    note: null,
    substeps: (input.substeps ?? []).map((title) => ({ id: uuid(), title, done: false })),
    doneAt: null,
    createdAt: now(),
  });
  if (input.dueAt) {
    logActivity('promise_made', `Paw promise: ${input.title.toLowerCase()}`, input.hobbyId);
    void scheduleCheckin(task, notifyOn());
  }
  return task;
}

export function addTodo(title: string, dueAt: Date | null, priority: Task['priority'] = 'normal', timed = false): Task {
  return put('tasks', {
    kind: 'todo',
    hobbyId: null,
    milestoneId: null,
    title,
    minutes: null,
    dueAt: dueAt?.toISOString() ?? null,
    timed,
    priority,
    status: 'open',
    notYetCount: 0,
    deferCount: 0,
    keptAt: null,
    note: null,
    doneAt: null,
    createdAt: now(),
  });
}

export function updateTask(id: string, changes: Partial<Task>) {
  patch('tasks', id, changes);
  const t = useStore.getState().tasks[id];
  if (t?.kind !== 'promise' || !('dueAt' in changes || 'status' in changes)) return;
  if (t.dueAt && t.status === 'open') void scheduleCheckin(t, notifyOn());
  else void cancelCheckin(id);
}

export function moveStepToMilestone(id: string, milestoneId: string | null) {
  updateTask(id, { milestoneId });
}

/** Remove the day: a paw promise goes back to a "someday" step. */
export function unschedule(id: string) {
  updateTask(id, { dueAt: null, timed: false });
}

/* ---------------------------------------------------------------- substeps */

const subsOf = (taskId: string): Substep[] => useStore.getState().tasks[taskId]?.substeps ?? [];

export function addSubstep(taskId: string, title: string) {
  if (!title.trim()) return;
  patch('tasks', taskId, { substeps: [...subsOf(taskId), { id: uuid(), title: title.trim(), done: false }] });
}

export function renameSubstep(taskId: string, subId: string, title: string) {
  patch('tasks', taskId, { substeps: subsOf(taskId).map((x) => (x.id === subId ? { ...x, title } : x)) });
}

export function toggleSubstep(taskId: string, subId: string) {
  patch('tasks', taskId, { substeps: subsOf(taskId).map((x) => (x.id === subId ? { ...x, done: !x.done } : x)) });
}

export function removeSubstep(taskId: string, subId: string) {
  const before = subsOf(taskId);
  const gone = before.find((x) => x.id === subId);
  patch('tasks', taskId, { substeps: before.filter((x) => x.id !== subId) });
  if (gone) showToast(`Removed “${gone.title}”.`, () => patch('tasks', taskId, { substeps: before }));
}

export function moveSubstep(taskId: string, subId: string, dir: -1 | 1) {
  const list = [...subsOf(taskId)];
  const i = list.findIndex((x) => x.id === subId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  patch('tasks', taskId, { substeps: list });
}

export function deleteTask(id: string) {
  remove('tasks', id);
  void cancelCheckin(id);
}

/** Delete with an Undo toast. */
export function deleteStep(id: string) {
  const t = useStore.getState().tasks[id];
  if (!t) return;
  deleteTask(id);
  showToast(`Deleted “${t.title}”.`, () => {
    patch('tasks', id, { deletedAt: null });
    if (t.dueAt && t.status === 'open') void scheduleCheckin(useStore.getState().tasks[id], notifyOn());
  });
}

export interface CompleteResult {
  task: Task;
  hobby?: Hobby;
  milestone?: Milestone;
  /** every step of an unfinished milestone is done → ask "mark it done?" */
  milestoneReady: boolean;
  stepsDone: number;
  stepsTotal: number;
}

/**
 * "Did it" — the most common action in the app (Task 1). Never completes a
 * milestone by itself; it reports `milestoneReady` so the screen can ask.
 */
export function completeTask(id: string, note?: string): CompleteResult | undefined {
  const s = useStore.getState();
  const task = s.tasks[id];
  if (!task) return;
  if (task.status !== 'done') {
    patch('tasks', id, { status: 'done', doneAt: now(), note: note ?? task.note ?? null });
    void cancelCheckin(id);
  }
  if (task.kind === 'todo') return { task, milestoneReady: false, stepsDone: 0, stepsTotal: 0 };

  const hobby = task.hobbyId ? s.hobbies[task.hobbyId] : undefined;
  if (hobby && task.status !== 'done') {
    patch('hobbies', hobby.id, { lastDoneAt: now() });
    logActivity('step_done', task.title, task.hobbyId);
  }
  const milestone = task.milestoneId ? useStore.getState().milestones[task.milestoneId] : undefined;
  const count = milestone && task.hobbyId ? milestoneCount(useStore.getState(), task.hobbyId, milestone.id) : { done: 0, total: 0 };
  return {
    task,
    hobby,
    milestone,
    milestoneReady: !!milestone && !milestone.doneAt && count.total > 0 && count.done === count.total,
    stepsDone: count.done,
    stepsTotal: count.total,
  };
}

/** Undo "done": the step is open again and its history line is removed. */
export function reopenTask(id: string) {
  const t = useStore.getState().tasks[id];
  if (!t) return;
  updateTask(id, { status: 'open', doneAt: null });
  if (t.kind === 'promise' && t.status === 'done') unlogActivity('step_done', t.title, t.hobbyId);
}

/** Checkbox on a step or to-do, with an Undo toast. */
export function toggleStep(id: string): CompleteResult | undefined {
  const t = useStore.getState().tasks[id];
  if (!t) return;
  if (t.status === 'done') {
    reopenTask(id);
    showToast(`“${t.title}” is open again.`, () => completeTask(id));
    return undefined;
  }
  const r = completeTask(id);
  const label = t.kind === 'todo' ? 'Checked off' : 'Step done';
  showToast(
    r?.milestone && r.stepsTotal ? `${label} · ${r.stepsDone} of ${r.stepsTotal} in “${r.milestone.title}”` : `${label}: ${t.title}`,
    () => reopenTask(id),
  );
  return r;
}

/** Log something that wasn't planned ("Something else" in the Log sheet). */
export function logFreeform(hobbyId: string, text: string, milestoneId?: string | null): CompleteResult | undefined {
  const t = addStep({ hobbyId, milestoneId, title: text, dueAt: null });
  return completeTask(t.id);
}

/** "Not yet" — returns which rung of the gentle ladder we're on (1..3). */
export function notYet(id: string): number {
  const t = useStore.getState().tasks[id];
  if (!t) return 1;
  const n = t.notYetCount + 1;
  patch('tasks', id, { notYetCount: n });
  return Math.min(n, 3);
}

export function reschedule(id: string, when: WhenChoice | Date) {
  const dueAt = when instanceof Date ? when : resolveWhen(when);
  updateTask(id, { dueAt: dueAt.toISOString(), timed: when instanceof Date });
}

/** Give an existing step a day (it becomes a paw promise), optionally a time and a length. */
export function promiseStep(id: string, dueAt: Date, timed: boolean, minutes?: number | null) {
  const t = useStore.getState().tasks[id];
  if (!t) return;
  updateTask(id, { dueAt: dueAt.toISOString(), timed, ...(minutes ? { minutes } : {}) });
  if (t.kind === 'promise') logActivity('promise_made', `Paw promise: ${t.title.toLowerCase()}`, t.hobbyId);
}

export function makeSmaller(id: string, title: string, minutes = 5) {
  updateTask(id, { title, minutes });
}

export function letGo(id: string) {
  updateTask(id, { status: 'let_go' });
  showToast('Let go for now. It can always come back.');
}

/* ------------------------------------------------------- skip suggestions */

export function decideSkip(taskId: string, decision: 'later' | 'keep' | 'let_go') {
  const s = useStore.getState();
  const t = s.tasks[taskId];
  if (!t) return;
  patchMind({ skipLedger: [...s.profile.mind.skipLedger, { date: dayKey(), taskId, decision }].slice(-60) });
  if (decision === 'later') {
    const sat = resolveWhen('weekend');
    const target = sat.getTime() - Date.now() > 36 * 3600_000 ? sat : addDays(new Date(), 2);
    updateTask(taskId, { dueAt: target.toISOString(), deferCount: t.deferCount + 1 });
    showToast(`Moved "${t.title}" to later. One less thing today.`);
  } else if (decision === 'keep') {
    updateTask(taskId, { keptAt: now() });
    showToast('Keeping it. You know your day best.');
  } else {
    letGo(taskId);
  }
}

/* -------------------------------------------------------------- keepsakes */

export interface KeepsakeInput {
  kind: Keepsake['kind'];
  caption: string;
  hobbyId?: string | null;
  taskId?: string | null;
  note?: string | null;
  sticker?: string | null;
  photoUri?: string | null;
  pinned?: boolean;
}

export function addKeepsake(input: KeepsakeInput): Keepsake {
  const id = uuid();
  if (input.photoUri) {
    useStore.setState((s) => ({ photoCache: { ...s.photoCache, [id]: input.photoUri! } }));
  }
  const k = put('keepsakes', {
    id,
    kind: input.kind,
    caption: input.caption,
    hobbyId: input.hobbyId ?? null,
    taskId: input.taskId ?? null,
    note: input.note ?? null,
    sticker: input.sticker ?? null,
    photoPath: null,
    pinned: false,
    createdAt: now(),
  });
  if (input.pinned) pinKeepsake(k.id, true);
  return k;
}

/** Rusty's wall has three frames; pinning a fourth unpins the oldest pin. */
export function pinKeepsake(id: string, pinned: boolean) {
  if (pinned) {
    const pins = alive(useStore.getState().keepsakes)
      .filter((k) => k.pinned && k.id !== id)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    if (pins.length >= 3) patch('keepsakes', pins[0].id, { pinned: false });
  }
  patch('keepsakes', id, { pinned });
}

export function updateKeepsake(id: string, changes: Partial<Keepsake>) {
  patch('keepsakes', id, changes);
}

export function deleteKeepsake(id: string) {
  remove('keepsakes', id);
}

/* ---------------------------------------------------------- focus sessions */

export function startSession(label: string, minutes: number, taskId?: string | null, hobbyId?: string | null) {
  return put('focus_sessions', {
    label,
    minutes,
    taskId: taskId ?? null,
    hobbyId: hobbyId ?? null,
    startedAt: now(),
    endedAt: null,
    outcome: null,
  });
}

export function endSession(id: string, outcome: 'did_it' | 'progress' | 'not_today') {
  const s = useStore.getState().focus_sessions[id];
  patch('focus_sessions', id, { endedAt: now(), outcome });
  if (!s) return undefined;
  if (outcome === 'progress') logActivity('progress', `Made progress: ${s.label.toLowerCase()}`, s.hobbyId);
  if (outcome !== 'not_today') logActivity('session', `${s.minutes} quiet minutes with Rusty`, s.hobbyId);
  if (outcome === 'did_it' && s.taskId) return completeTask(s.taskId);
  if (outcome === 'did_it' && s.hobbyId) return logFreeform(s.hobbyId, s.label);
  return undefined;
}
