/**
 * What Rusty knows about you, and how he learns it.
 *
 *   You told me   facts he picked up in chat (the AI returns 0–2 per reply),
 *                 or that you wrote yourself. Stored in profile.mind.notes,
 *                 synced with your account.
 *   I noticed     patterns worked out from what you actually do (when you
 *                 usually get to hobbies, how long you focus, what keeps
 *                 slipping). Recomputed every time, never guessed.
 *
 * Everything here is shown on "What Rusty knows" where you can correct or
 * delete it, and it's what his suggestions are built on (sent to the AI as
 * context, and used by the offline replies).
 */
import { alive, patchMind, useStore, type RestieState as State } from '@/data/store';
import type { RustyNote } from '@/data/types';
import { now, uuid } from '@/lib/time';

export interface Noticed {
  id: string;
  text: string;
  /** why he thinks so, in plain words */
  because: string;
}

type Bucket = 'morning' | 'afternoon' | 'evening' | 'late at night';
const bucketOf = (d: Date): Bucket => {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'late at night';
};
export const BUCKET_HOUR: Record<Bucket, number> = { morning: 9, afternoon: 14, evening: 19, 'late at night': 21 };

const DAY = 86_400_000;
const within = (iso: string, days: number) => Date.now() - new Date(iso).getTime() < days * DAY;

/** Patterns from real activity (only when there's enough to be fair). */
export function noticedOf(s: State): Noticed[] {
  const out: Noticed[] = [];
  const hidden = new Set(s.profile.mind.hiddenNoticed ?? []);
  const acts = alive(s.activities).filter((a) => within(a.createdAt, 60));
  const doing = acts.filter((a) => a.kind === 'step_done' || a.kind === 'session' || a.kind === 'progress');

  // When you usually get to your hobbies.
  if (doing.length >= 3) {
    const counts = new Map<Bucket, number>();
    for (const a of doing) counts.set(bucketOf(new Date(a.createdAt)), (counts.get(bucketOf(new Date(a.createdAt))) ?? 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / doing.length >= 0.5) out.push({ id: 'time', text: `You usually get to your hobbies in the ${top}`, because: `${n} of your last ${doing.length} were then` });
  }

  // Weekends vs weekdays.
  if (doing.length >= 4) {
    const weekend = doing.filter((a) => [0, 6].includes(new Date(a.createdAt).getDay())).length;
    if (weekend / doing.length >= 0.7) out.push({ id: 'weekend', text: 'Weekends are when your hobbies happen', because: `${weekend} of ${doing.length} were on a weekend` });
    else if (weekend === 0 && doing.length >= 5) out.push({ id: 'weekdays', text: 'You fit hobbies into weekdays more than weekends', because: `none of the last ${doing.length} were on a weekend` });
  }

  // How long you like to focus.
  const sessions = alive(s.focus_sessions).filter((f) => f.endedAt && within(f.startedAt, 60));
  if (sessions.length >= 2) {
    const mins = sessions.map((f) => f.minutes).sort((a, b) => a - b);
    const median = mins[Math.floor(mins.length / 2)];
    out.push({ id: 'length', text: `Short sessions work for you: about ${median} minutes`, because: `your last ${sessions.length} focus sessions` });
  }

  // What's getting your time lately.
  const done30 = alive(s.activities).filter((a) => a.kind === 'step_done' && a.hobbyId && within(a.createdAt, 30));
  if (done30.length >= 3) {
    const by = new Map<string, number>();
    for (const a of done30) by.set(a.hobbyId!, (by.get(a.hobbyId!) ?? 0) + 1);
    const [hid, n] = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
    const h = s.hobbies[hid];
    if (h && n / done30.length >= 0.6) out.push({ id: `favorite:${hid}`, text: `${h.name} is getting most of your time lately`, because: `${n} of ${done30.length} steps this month` });
  }

  // Steps that keep slipping (too big, or the wrong time).
  for (const t of alive(s.tasks).filter((t) => t.status === 'open' && t.notYetCount >= 2).slice(0, 2)) {
    out.push({ id: `stall:${t.id}`, text: `“${t.title}” keeps slipping. A smaller piece might help`, because: `“not yet” ${t.notYetCount} times` });
  }

  // How you handle a full week.
  const ledger = s.profile.mind.skipLedger.filter((l) => within(`${l.date}T12:00:00`, 60));
  const later = ledger.filter((l) => l.decision === 'later').length;
  const letGo = ledger.filter((l) => l.decision === 'let_go').length;
  if (later >= 2 && later > letGo) out.push({ id: 'later', text: 'When the week is full, you’d rather move things than drop them', because: `you chose “later” ${later} times` });
  if (letGo >= 2 && letGo >= later) out.push({ id: 'letgo', text: 'You’re good at letting things go when the week is full', because: `you let ${letGo} things go` });

  return out.filter((n) => !hidden.has(n.id));
}

export const notesOf = (s: State): RustyNote[] => s.profile.mind.notes ?? [];

/** For the AI context: everything he knows, one line each. */
export function knowledgeLines(s: State): string[] {
  return [...notesOf(s).map((n) => n.text), ...noticedOf(s).map((n) => `${n.text} (noticed: ${n.because})`)];
}

/** The hour he'd suggest for a plan, from when you usually do things. */
export function preferredHour(s: State): number | null {
  const t = noticedOf(s).find((n) => n.id === 'time');
  if (!t) return null;
  const b = (Object.keys(BUCKET_HOUR) as Bucket[]).find((k) => t.text.endsWith(k));
  return b ? BUCKET_HOUR[b] : null;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/** Save what he learned in chat; returns the notes that were new. */
export function remember(texts: string[], source: RustyNote['source'] = 'chat'): RustyNote[] {
  const notes = notesOf(useStore.getState());
  const seen = new Set(notes.map((n) => norm(n.text)));
  const fresh: RustyNote[] = [];
  for (const raw of texts) {
    const text = raw.trim().replace(/\.$/, '');
    if (!text || text.length > 140 || seen.has(norm(text))) continue;
    seen.add(norm(text));
    fresh.push({ id: uuid(), text, source, at: now() });
  }
  if (fresh.length) patchMind({ notes: [...notes, ...fresh].slice(-40) });
  return fresh;
}

export function editNote(id: string, text: string) {
  patchMind({ notes: notesOf(useStore.getState()).map((n) => (n.id === id ? { ...n, text: text.trim() } : n)) });
}

export function forgetNote(id: string) {
  patchMind({ notes: notesOf(useStore.getState()).filter((n) => n.id !== id) });
}

export function restoreNote(note: RustyNote) {
  const notes = notesOf(useStore.getState());
  if (!notes.some((n) => n.id === note.id)) patchMind({ notes: [...notes, note] });
}

export function hideNoticed(id: string) {
  const m = useStore.getState().profile.mind;
  patchMind({ hiddenNoticed: [...new Set([...(m.hiddenNoticed ?? []), id])] });
}

export function unhideNoticed(id: string) {
  const m = useStore.getState().profile.mind;
  patchMind({ hiddenNoticed: (m.hiddenNoticed ?? []).filter((x) => x !== id) });
}

export function forgetEverything() {
  patchMind({ notes: [], hiddenNoticed: [], lessons: [] });
}
