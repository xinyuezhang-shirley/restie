/**
 * Domain model. Every synced entity mirrors a Supabase table (see
 * supabase/migrations). Field names are camelCase here and snake_case in
 * Postgres; src/data/sync.ts converts between them.
 *
 * Words the app uses with people — one vocabulary everywhere (src/copy.ts):
 *   Hobby → Goal → Milestones → Steps → Substeps
 *   a Paw promise is a step with a day/time you promised Rusty
 *   a To-do is an everyday, non-hobby thing
 * Never "tasks" or "productivity" in the UI.
 */

export type ISO = string;

export interface Synced {
  id: string;
  updatedAt: ISO;
  deletedAt?: ISO | null;
}

export type HobbyIcon =
  | 'guitar'
  | 'drawing'
  | 'baking'
  | 'reading'
  | 'writing'
  | 'gardening'
  | 'other';

export interface Hobby extends Synced {
  name: string;
  icon: HobbyIcon;
  /** goal = working toward something; keep = keep it in my life */
  kind: 'goal' | 'keep';
  goal?: string | null;
  why?: string | null;
  /** for "keep" hobbies: how often feels nice */
  rhythm?: string | null;
  status: 'active' | 'paused' | 'done';
  createdAt: ISO;
  lastDoneAt?: ISO | null;
  /** Rusty's drawing for it (generated, kept by you): path in the `generated` bucket */
  artPath?: string | null;
}

export interface Milestone extends Synced {
  hobbyId: string;
  title: string;
  position: number;
  /** @deprecated progress now counts the milestone's real steps (kept for the DB column) */
  stepsTarget: number;
  /** set only when the person marks it done (never automatically) */
  doneAt?: ISO | null;
}

/** A checklist item inside a step ("Tune the low E" inside "Practice verse 3"). */
export interface Substep {
  id: string;
  title: string;
  done: boolean;
}

/**
 * One list for everything Rusty helps you juggle:
 *  - kind "promise": a hobby **step** (has hobbyId, usually a milestoneId).
 *    With a dueAt it is a **paw promise**; without, it's planned "someday".
 *  - kind "todo": an everyday obligation (homework, chores) — what Rusty
 *    suggests pushing to later so the hobby step fits.
 */
export interface Task extends Synced {
  kind: 'promise' | 'todo';
  hobbyId?: string | null;
  milestoneId?: string | null;
  title: string;
  minutes?: number | null;
  /** when it is planned for; null = someday */
  dueAt?: ISO | null;
  /** true when the person picked a specific time (we notify then) */
  timed?: boolean;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'done' | 'let_go';
  /** answers of "Not yet" — drives the check-in ladder */
  notYetCount: number;
  /** times Rusty moved it later */
  deferCount: number;
  /** person said "keep it" to a skip suggestion — never suggest again */
  keptAt?: ISO | null;
  note?: string | null;
  /** checklist inside a step (hobby steps only) */
  substeps?: Substep[];
  doneAt?: ISO | null;
  createdAt: ISO;
}

export interface Keepsake extends Synced {
  kind: 'photo' | 'note' | 'rusty';
  hobbyId?: string | null;
  taskId?: string | null;
  caption: string;
  note?: string | null;
  /** path in the Supabase "keepsakes" storage bucket */
  photoPath?: string | null;
  /** bundled art key, for Rusty's souvenirs and notes */
  sticker?: string | null;
  pinned: boolean;
  createdAt: ISO;
  /** Rusty's illustration of it (generated, kept by you) */
  artPath?: string | null;
}

export interface Activity extends Synced {
  hobbyId?: string | null;
  kind:
    | 'step_done'
    | 'progress'
    | 'session'
    | 'milestone_done'
    | 'hobby_started'
    | 'promise_made'
    | 'note';
  text: string;
  createdAt: ISO;
}

export interface ChatMessage extends Synced {
  role: 'user' | 'rusty';
  text: string;
  /** suggestion card attached to Rusty's reply */
  suggestion?: RustySuggestion | null;
  createdAt: ISO;
}

export interface RustySuggestion {
  type: 'focus' | 'plan';
  title: string;
  minutes: number;
  hobbyId?: string | null;
}

export interface FocusSession extends Synced {
  hobbyId?: string | null;
  taskId?: string | null;
  label: string;
  minutes: number;
  startedAt: ISO;
  endedAt?: ISO | null;
  outcome?: 'did_it' | 'progress' | 'not_today' | null;
}

export interface RustyMind {
  /** one skip decision per day: date (yyyy-mm-dd) → decision */
  skipLedger: { date: string; taskId: string; decision: 'later' | 'keep' | 'let_go' }[];
  lastTripAt?: ISO | null;
  /** the day (yyyy-mm-dd) his planned trip's souvenir was handed over */
  tripDone?: string | null;
  /** the last day (yyyy-mm-dd) Rusty wrote a diary page about */
  diaryFor?: string | null;
  /** today's souvenir idea from the AI (used when he gets back) */
  tripIdea?: { date: string; caption: string; line: string } | null;
  /** @deprecated replaced by `notes` (kept so older synced profiles still load) */
  lessons: string[];
  /** What Rusty remembers about you: told in chat, or added by you (Settings → What Rusty knows) */
  notes?: RustyNote[];
  /** ids of "I noticed" patterns you said aren't true, so he stops using them */
  hiddenNoticed?: string[];
  /** drawings Rusty made that are waiting for you to keep or not */
  artOffers?: ArtOffer[];
  /** cached AI lines for the day */
  lines?: { date: string; lines: string[] } | null;
  /** "Something's not right?" reports (synced with the profile for the team) */
  reports?: { at: ISO; kind: string; text: string; screen?: string }[];
}

export interface ArtOffer {
  id: string;
  kind: 'hobby' | 'keepsake';
  /** the hobby or keepsake it's for */
  targetId: string;
  path: string;
  /** what he drew, in a few words */
  object: string;
  at: ISO;
}

export interface RustyNote {
  id: string;
  text: string;
  /** chat: Rusty picked it up from a conversation · you: you wrote it */
  source: 'chat' | 'you';
  at: ISO;
}

export interface Profile {
  id: string;
  name: string;
  onboardedAt?: ISO | null;
  tutorialDoneAt?: ISO | null;
  settings: {
    notifications: boolean;
    location: boolean;
    /** focus timer runs 20× faster — for usability tests and demos */
    demoSpeed: boolean;
  };
  mind: RustyMind;
  updatedAt: ISO;
}

export type TableName =
  | 'hobbies'
  | 'milestones'
  | 'tasks'
  | 'keepsakes'
  | 'activities'
  | 'messages'
  | 'focus_sessions';

export interface Tables {
  hobbies: Hobby;
  milestones: Milestone;
  tasks: Task;
  keepsakes: Keepsake;
  activities: Activity;
  messages: ChatMessage;
  focus_sessions: FocusSession;
}

export const TABLES: TableName[] = [
  'hobbies',
  'milestones',
  'tasks',
  'keepsakes',
  'activities',
  'messages',
  'focus_sessions',
];
