/**
 * Demo data: "Sam" from the med-fi, with Guitar and Drawing in progress.
 * Settings → "Load Sam's demo" uses this so usability-test participants can
 * run the three tasks exactly as written in the README.
 */
import { addDays, now, resolveWhen, uuid } from '@/lib/time';

import { patchProfile, put, resetLocal, useStore } from './store';

const daysAgo = (n: number, hour = 18) => {
  const d = addDays(new Date(), -n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export function seedDemo() {
  const keep = useStore.getState().profile;
  resetLocal();
  patchProfile({
    name: 'Sam',
    onboardedAt: now(),
    tutorialDoneAt: keep.tutorialDoneAt ?? null,
    settings: keep.settings,
  });

  // Guitar: two milestones done, on "Learn verse 3" with 2 of 4 steps done.
  const guitar = put('hobbies', {
    name: 'Guitar',
    icon: 'guitar',
    kind: 'goal',
    goal: 'Play the movie song',
    why: 'I want to play it for my sister',
    rhythm: null,
    status: 'active',
    createdAt: daysAgo(60),
    lastDoneAt: daysAgo(2),
  });
  const g = ['Tune the guitar', 'Learn verses 1–2', 'Learn verse 3', 'Play the whole song'].map((title, position) =>
    put('milestones', {
      hobbyId: guitar.id,
      title,
      position,
      stepsTarget: 3, // unused: progress counts the real steps below

      doneAt: position < 2 ? daysAgo(30 - position * 12) : null,
    }),
  );
  // Done milestones keep their steps, so the path reads as a real history.
  for (const [m, title, ago] of [
    [0, 'Buy a clip-on tuner', 45],
    [0, 'Tune all six strings', 44],
    [1, 'Learn the G, C and D chords', 35],
    [1, 'Play verse 1 slowly', 25],
    [1, 'Play verses 1–2 with the song', 19],
    [2, 'Listen to verse 3 a few times', 6],
    [2, 'Learn the first chord change', 2],
  ] as const) {
    put('tasks', doneTask(guitar.id, g[m].id, title, ago));
  }

  // Drawing: on "Sketch the park" with 1 of 3 steps done.
  const drawing = put('hobbies', {
    name: 'Drawing',
    icon: 'drawing',
    kind: 'goal',
    goal: 'Sketch my neighborhood',
    why: null,
    rhythm: null,
    status: 'active',
    createdAt: daysAgo(75),
    lastDoneAt: daysAgo(5),
  });
  const d = ['Sketch my street corner', 'Sketch the park', 'Sketch the corner café', 'Draw a neighborhood map'].map(
    (title, position) =>
      put('milestones', { hobbyId: drawing.id, title, position, stepsTarget: 3, doneAt: position < 1 ? daysAgo(20) : null }),
  );
  put('tasks', doneTask(drawing.id, d[0].id, 'Draw the corner in pencil', 24));
  put('tasks', doneTask(drawing.id, d[0].id, 'Add the street signs', 21));
  put('tasks', doneTask(drawing.id, d[1].id, 'Pick a bench to draw from', 5));

  // This week's promises (med-fi: "Chords · Tue", "Sketch · Sat").
  const today = new Date();
  today.setHours(19, 0, 0, 0);
  // "Learn verse 3" = 2 done + these 2 → "2 of 4 steps", so Task 1 (log the
  // chords) and Task 3 (play it with Rusty) both land on it, as in the med-fi.
  put('tasks', {
    ...openTask('promise', 'Find chords for verse 3', today, guitar.id, g[2].id, 10),
    substeps: [
      { id: uuid(), title: 'Look up the chord chart', done: true },
      { id: uuid(), title: 'Try each chord shape', done: false },
      { id: uuid(), title: 'Play the progression once', done: false },
    ],
  });
  put('tasks', { ...openTask('promise', 'Play verse 3 along with the song', null, guitar.id, g[2].id, 15), createdAt: new Date(Date.now() + 1000).toISOString() });
  put('tasks', openTask('promise', 'Sketch the park', resolveWhen('weekend'), drawing.id, d[1].id, 20));
  put('tasks', openTask('promise', 'Shade the trees', null, drawing.id, d[1].id, 15));

  // Everyday to-dos, so Rusty has something to suggest pushing later.
  put('tasks', { ...openTask('todo', 'Problem set 6', today), priority: 'high' });
  put('tasks', { ...openTask('todo', 'Reply to the club email', today), priority: 'normal' });
  put('tasks', { ...openTask('todo', 'Laundry', today), priority: 'low' });
  put('tasks', { ...openTask('todo', 'Grocery run', addDays(today, 1)), priority: 'low' });

  // History for the "Recent" lists.
  const act = (kind: 'step_done' | 'milestone_done' | 'hobby_started', text: string, hobbyId: string, ago: number) =>
    put('activities', { kind, text, hobbyId, createdAt: daysAgo(ago) });
  act('hobby_started', 'Started guitar', guitar.id, 60);
  act('milestone_done', 'Reached "Tune the guitar"', guitar.id, 30);
  act('milestone_done', 'Reached "Learn verses 1–2"', guitar.id, 18);
  act('step_done', 'Listen to verse 3 a few times', guitar.id, 6);
  act('step_done', 'Learn the first chord change', guitar.id, 2);
  act('hobby_started', 'Started drawing', drawing.id, 75);
  act('milestone_done', 'Reached "Sketch my street corner"', drawing.id, 20);
  act('step_done', 'Pick a bench to draw from', drawing.id, 5);

  // The four med-fi keepsakes.
  const ks = (caption: string, sticker: string, kind: 'note' | 'rusty' | 'photo', ago: number, hobbyId: string | null) =>
    put('keepsakes', {
      kind,
      caption,
      sticker,
      hobbyId,
      taskId: null,
      note: null,
      photoPath: null,
      pinned: false,
      createdAt: daysAgo(ago),
    });
  ks('Things I want to try', 'hobby-other', 'note', 66, null);
  ks('Found the chorus', 'guitar', 'note', 60, guitar.id);
  ks('Rest is part of it', 'rusty-sleep', 'rusty', 55, null);
  ks('A quiet page', 'notebook', 'note', 4, drawing.id);
}

function doneTask(hobbyId: string, milestoneId: string, title: string, ago: number) {
  return {
    id: uuid(),
    kind: 'promise' as const,
    hobbyId,
    milestoneId,
    title,
    minutes: 10,
    dueAt: daysAgo(ago),
    timed: false,
    priority: 'normal' as const,
    status: 'done' as const,
    notYetCount: 0,
    deferCount: 0,
    keptAt: null,
    note: null,
    doneAt: daysAgo(ago),
    createdAt: daysAgo(ago + 1),
  };
}

function openTask(
  kind: 'promise' | 'todo',
  title: string,
  due: Date | null,
  hobbyId: string | null = null,
  milestoneId: string | null = null,
  minutes: number | null = null,
) {
  return {
    kind,
    hobbyId,
    milestoneId,
    title,
    minutes,
    dueAt: due?.toISOString() ?? null,
    timed: false,
    priority: 'normal' as const,
    status: 'open' as const,
    notYetCount: 0,
    deferCount: 0,
    keptAt: null,
    note: null,
    doneAt: null,
    createdAt: now(),
  };
}
