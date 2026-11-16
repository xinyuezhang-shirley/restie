/**
 * Rusty writes things for you (like Mycoto's diary pages and souvenirs):
 *
 *   Diary   once a day he writes a page about yesterday: what you did (or that
 *           you rested), what he did (his hobbies, naps, a trip and what he
 *           found). The AI writes it when it's connected; otherwise a
 *           hand-made page from the same facts. It becomes one of his keepsakes.
 *   Cards   when you reach a milestone he makes you a little card.
 *
 * Everything is built from what really happened, never invented.
 */
import { useEffect } from 'react';

import { diaryPage } from '@/ai/rusty';
import { addKeepsake } from '@/data/actions';
import { alive, patchMind, useStore } from '@/data/store';
import type { HobbyIcon, Milestone } from '@/data/types';
import { addDays, dayKey, daysBetween } from '@/lib/time';

import { planDay } from './life';
import { pick } from './personality';

const short = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1).replace(/[.!?]+$/, '');

const RUSTY_DID: Record<string, string> = {
  drawing: 'painted by the window',
  baking: 'made a mess at the desk (baking)',
  guitar: 'practiced guitar, mostly with my claws',
  reading: 'read in my bed',
  writing: 'wrote in my notebook',
  gardening: 'talked to my little plant',
  other: 'worked on a little project',
};

/** The facts of one day, for the page. */
function factsOf(day: Date) {
  const s = useStore.getState();
  const key = dayKey(day);
  const acts = alive(s.activities).filter((a) => dayKey(new Date(a.createdAt)) === key);
  const did = acts.filter((a) => a.kind === 'step_done').map((a) => a.text);
  const promised = acts.filter((a) => a.kind === 'promise_made').map((a) => a.text.replace(/^Paw promise: /, ''));
  const sessions = acts.filter((a) => a.kind === 'session').length;
  const icons = [...new Set(alive(s.hobbies).filter((h) => h.status === 'active').map((h) => h.icon))] as HobbyIcon[];
  const plan = planDay({ date: new Date(`${key}T12:00:00`), icons, condition: 'clear', canTrip: true });
  const hobbyKinds = [...new Set(plan.blocks.filter((b) => b.kind === 'hobby' && b.icon).map((b) => b.icon!))].slice(0, 2);
  const naps = plan.blocks.filter((b) => b.kind === 'nap').length;
  const trip = s.profile.mind.tripDone === key || (s.profile.mind.lastTripAt && dayKey(new Date(s.profile.mind.lastTripAt)) === key);
  const souvenir = alive(s.keepsakes).find((k) => k.kind === 'rusty' && k.sticker === 'hobby-other' && dayKey(new Date(k.createdAt)) === key);
  return { key, did, promised, sessions, hobbyKinds, naps, mood: plan.mood, trip: !!trip, souvenir: souvenir?.caption };
}

/** A hand-made page from the facts (used when the AI isn't connected). */
function offlinePage(f: ReturnType<typeof factsOf>): string {
  const you = f.did.length
    ? `you did “${lower(f.did[0])}”${f.did.length > 1 ? ` and ${f.did.length - 1} more` : ''}. I watched. I was very proud, quietly.`
    : f.sessions
      ? 'we sat together for a while and you worked on something. that counts.'
      : f.promised.length
        ? `you promised to ${lower(f.promised[0])}. I wrote it on my paw.`
        : 'you rested. resting counts. I checked.';
  const me = [
    ...f.hobbyKinds.map((i) => RUSTY_DID[i] ?? RUSTY_DID.other),
    f.naps > 3 ? 'took more naps than I can count' : f.naps > 1 ? `took ${f.naps} naps` : f.naps === 1 ? 'took one very good nap' : null,
  ].filter(Boolean) as string[];
  const mine = me.length ? `I ${me.join(', and ')}.` : 'I sat on the rug and thought about things.';
  const trip = f.trip ? ` I went out exploring${f.souvenir ? ` and brought back ${lower(f.souvenir)}` : ''}.` : '';
  const end = pick(['tomorrow: one small thing, then snacks.', 'goodnight, room. goodnight, sunbeam spot.', 'I hope tomorrow has rain sounds.', 'more tomorrow. maybe.']);
  return `dear diary. ${you} ${mine}${trip} ${end}`;
}

/** Write the page about `day` (once), as one of Rusty's keepsakes. */
export async function writeDiary(day: Date, say?: (t: string, ms?: number) => void) {
  const f = factsOf(day);
  if (useStore.getState().profile.mind.diaryFor === f.key) return;
  patchMind({ diaryFor: f.key }); // claim it first, so it's only ever written once
  const facts = [
    `Date: ${short(day)}.`,
    f.did.length ? `They finished: ${f.did.join('; ')}.` : 'They didn’t log a step (they may have rested).',
    f.promised.length ? `They promised: ${f.promised.join('; ')}.` : '',
    f.sessions ? `Focus sessions with you: ${f.sessions}.` : '',
    `What you (Rusty) did: ${f.hobbyKinds.map((i) => RUSTY_DID[i]).join(', ') || 'sat around'}; naps: ${f.naps}; mood: ${f.mood}.`,
    f.trip ? `You went on a trip${f.souvenir ? ` and brought back ${f.souvenir}` : ''}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const ai = await diaryPage(facts);
  addKeepsake({
    kind: 'rusty',
    caption: `Rusty’s diary · ${short(day)}${ai?.title ? ` · ${ai.title}` : ''}`,
    note: ai?.entry ?? offlinePage(f),
    sticker: 'rusty-diary',
  });
  say?.('I wrote in my diary about yesterday. it’s in your keepsakes, if you want to read it.', 7000);
}

/** When you reach a milestone, Rusty makes you a card (once per milestone). */
export function milestoneCard(m: Milestone) {
  const s = useStore.getState();
  const hobby = s.hobbies[m.hobbyId];
  const exists = alive(s.keepsakes).some((k) => k.sticker === 'rusty-card' && k.taskId === m.id);
  if (exists) return;
  const line = pick([
    `you did it: “${lower(m.title)}”. I made you this card. the glitter is mostly fur.`,
    `a whole milestone! “${lower(m.title)}”. I drew us celebrating. you’re the tall one.`,
    `“${lower(m.title)}”, done. I’m putting this card on the fridge. we don’t have a fridge. still.`,
  ]);
  addKeepsake({ kind: 'rusty', caption: `A card from Rusty: ${m.title}`, note: line, sticker: 'rusty-card', hobbyId: hobby?.id ?? null, taskId: m.id });
}

/**
 * On Home, once a day: the diary page about yesterday (from his second day
 * on — the first day there's nothing to write about yet).
 */
export function useRustyJournal(visible: boolean, say: (t: string, ms?: number) => void) {
  useEffect(() => {
    if (!visible) return;
    const p = useStore.getState().profile;
    if (!p.onboardedAt || daysBetween(new Date(p.onboardedAt), new Date()) < 1) return;
    const yesterday = addDays(new Date(), -1);
    if (p.mind.diaryFor === dayKey(yesterday)) return;
    const t = setTimeout(() => void writeDiary(yesterday, say), 4000);
    return () => clearTimeout(t);
  }, [visible, say]);
}

/** Cards for milestones you reach (after the Undo window, so an undo doesn't leave a card). */
export function useMilestoneCards() {
  const reached = useStore((s) =>
    Object.values(s.milestones)
      .filter((m) => m.doneAt && !m.deletedAt && Date.now() - new Date(m.doneAt).getTime() < 10 * 60_000)
      .map((m) => m.id)
      .join(','),
  );
  useEffect(() => {
    if (!reached) return;
    const t = setTimeout(() => {
      for (const id of reached.split(',')) {
        const m = useStore.getState().milestones[id];
        if (m?.doneAt && !m.deletedAt) milestoneCard(m);
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [reached]);
}
