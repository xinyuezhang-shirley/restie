/** Small, dependency-free date helpers used across the app. */

export const now = () => new Date().toISOString();

export function uuid(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[(Math.random() * 4) | 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

export function dayKey(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "2 days ago", "Sep 14" — for "last worked on" labels. */
export function ago(iso?: string | null): string {
  if (!iso) return 'Not yet';
  const d = new Date(iso);
  const n = daysBetween(d, new Date());
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return 'Last week';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Short label for when a step is planned: "Today", "Tue", "Sat 10am". */
export function whenLabel(iso?: string | null, timed = false): string {
  if (!iso) return 'Someday';
  const d = new Date(iso);
  const n = daysBetween(new Date(), d);
  let day: string;
  if (n < 0) day = n === -1 ? 'Yesterday' : 'Earlier';
  else if (n === 0) day = 'Today';
  else if (n === 1) day = 'Tomorrow';
  else if (n < 7) day = WEEKDAYS[d.getDay()];
  else day = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return timed ? `${day} ${timeLabel(d)}` : day;
}

export function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? `:${`${m}`.padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export type WhenChoice = 'today' | 'tomorrow' | 'weekend' | 'nextweek';

/** Turns a friendly choice into a concrete time (evening by default). */
export function resolveWhen(choice: WhenChoice, hour?: number, from: Date = new Date()): Date {
  const d = new Date(from);
  if (choice === 'today') {
    const h = hour ?? Math.max(d.getHours() + 2, 19);
    d.setHours(Math.min(h, 22), 0, 0, 0);
  } else if (choice === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(hour ?? 19, 0, 0, 0);
  } else if (choice === 'weekend') {
    const toSat = (6 - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (toSat === 0 && d.getHours() >= 12 ? 1 : toSat));
    d.setHours(hour ?? 10, 0, 0, 0);
  } else {
    const toMon = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + toMon);
    d.setHours(hour ?? 19, 0, 0, 0);
  }
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

/** Is this date within the next 7 days (or overdue)? */
export function isThisWeek(iso?: string | null): boolean {
  if (!iso) return false;
  return daysBetween(new Date(), new Date(iso)) <= 6;
}
