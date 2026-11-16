/**
 * Make a paw promise — the one place to promise anything, from anywhere
 * (Home, To-dos, a step, a hobby).
 *
 *   1. What's it for?   one of your hobbies, or "Something else"
 *   2. What exactly?    the hobby's likely next steps first (with their next
 *                       small part), Rusty's ideas, or your own words.
 *                       Typing filters your existing steps, so you don't
 *                       make a duplicate by accident.
 *   3. When?            Today / Tomorrow / This weekend / a calendar; any time
 *                       or a time wheel; about how long on a wheel.
 *
 * Nothing is preselected that you didn't choose: the hobby only comes filled
 * in when you came from that hobby (or you have just one).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Chip, ChipRow, Eyebrow, Field, OptionRow, T } from '@/components/ui';
import { dueAtOf, WhenField, whenSummary, type When } from '@/components/WhenField';
import { suggestSteps } from '@/ai/rusty';
import { addPromise, addTodo, promiseStep } from '@/data/actions';
import { currentMilestone, hobbiesOf, openTasks, stepsOf } from '@/data/selectors';
import { showToast, useDerived, useStore } from '@/data/store';
import type { Task } from '@/data/types';
import { dayKey, startOfDay, whenLabel } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

type Pick = { type: 'step'; id: string } | { type: 'idea'; title: string; minutes: number } | { type: 'own' } | null;
const OTHER = 'other';

export default function PromiseSheet() {
  const params = useLocalSearchParams<{ hobbyId?: string; taskId?: string; day?: string }>();
  const hobbies = useDerived(hobbiesOf).filter((h) => h.status === 'active');
  const preTask = useStore((s) => (params.taskId ? s.tasks[params.taskId] : undefined));
  const [forId, setForId] = useState<string | null>(
    preTask ? (preTask.hobbyId ?? OTHER) : (params.hobbyId ?? (hobbies.length === 1 ? hobbies[0].id : null)),
  );
  const hobby = useStore((s) => (forId && forId !== OTHER ? s.hobbies[forId] : undefined));
  const [pick, setPick] = useState<Pick>(preTask ? { type: 'step', id: preTask.id } : null);
  const [text, setText] = useState(preTask && !preTask.hobbyId ? preTask.title : '');
  const [ideas, setIdeas] = useState<{ title: string; minutes: number }[] | 'loading' | null>(null);
  const [when, setWhen] = useState<When>(() => ({
    day: preTask?.dueAt ? startOfDay(new Date(preTask.dueAt)) : params.day ? startOfDay(new Date(`${params.day}T12:00:00`)) : startOfDay(),
    time: preTask?.dueAt && preTask.timed ? { h: new Date(preTask.dueAt).getHours(), m: new Date(preTask.dueAt).getMinutes() } : null,
    minutes: preTask?.minutes ?? 15,
  }));

  // The hobby's likely next steps: the current milestone's open steps first,
  // then the rest; ones already promised last.
  const current = useDerived((s) => (forId && forId !== OTHER ? currentMilestone(s, forId) : undefined), [forId]);
  const milestones = useStore((s) => s.milestones);
  const steps = useDerived((s) => (forId && forId !== OTHER ? stepsOf(s, forId).filter((t) => t.status === 'open') : []), [forId]);
  const ranked = useMemo(() => {
    const rank = (t: Task) => (t.dueAt ? 2 : t.milestoneId === current?.id ? 0 : 1);
    return [...steps].sort((a, b) => rank(a) - rank(b));
  }, [steps, current?.id]);
  const q = text.trim().toLowerCase();
  const matches = q ? ranked.filter((t) => t.title.toLowerCase().includes(q)) : ranked.slice(0, 4);

  // Dots on the calendar for days that already have plans.
  const marks = useDerived((s) => {
    const m: Record<string, number> = {};
    for (const t of openTasks(s)) if (t.dueAt) m[dayKey(new Date(t.dueAt))] = (m[dayKey(new Date(t.dueAt))] ?? 0) + 1;
    return m;
  });

  const other = forId === OTHER;
  const ownTitle = text.trim();
  const ready = other ? !!ownTitle : !!forId && (pick?.type === 'step' || pick?.type === 'idea' || (pick?.type === 'own' && !!ownTitle));
  const due = dueAtOf(when);

  const save = () => {
    if (!ready) return;
    const timed = !!when.time;
    if (other) {
      if (preTask && !preTask.hobbyId) {
        if (due) promiseStep(preTask.id, due, timed);
      } else addTodo(ownTitle, due, 'normal', timed);
      showToast(due ? `Added to To-dos · ${whenSummary({ ...when, minutes: null })}` : 'Added to To-dos.');
    } else if (pick?.type === 'step' && due) {
      promiseStep(pick.id, due, timed, when.minutes);
      showToast(`🐾 Promised · ${whenSummary(when)}`);
    } else if (forId) {
      const title = pick?.type === 'idea' ? pick.title : ownTitle;
      addPromise({ hobbyId: forId, title, minutes: when.minutes ?? undefined, dueAt: due, timed });
      showToast(`🐾 Promised · ${whenSummary(when)}`);
    }
    router.back();
  };

  const subLine = (t: Task) => {
    const subs = t.substeps ?? [];
    const next = subs.find((x) => !x.done);
    const bits = [
      t.milestoneId && milestones[t.milestoneId] ? `${t.milestoneId === current?.id ? 'Next in' : 'In'} “${milestones[t.milestoneId].title}”` : null,
      subs.length ? `${subs.filter((x) => x.done).length} of ${subs.length} parts done${next ? ` · next: ${next.title}` : ''}` : null,
      t.dueAt ? `already promised for ${whenLabel(t.dueAt, t.timed)}` : null,
    ];
    return bits.filter(Boolean).join(' · ');
  };

  return (
    <Sheet title="Make a paw promise">
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
        {/* 1. what for */}
        <View style={{ gap: space.sm }}>
          <Eyebrow color={colors.inkSoft}>What’s it for?</Eyebrow>
          <ChipRow>
            {hobbies.map((h) => (
              <Chip
                key={h.id}
                selected={forId === h.id}
                onPress={() => {
                  setForId(h.id);
                  setPick(null);
                  setIdeas(null);
                }}
              >
                {h.name}
              </Chip>
            ))}
            <Chip
              icon="plus"
              selected={other}
              onPress={() => {
                setForId(OTHER);
                setPick({ type: 'own' });
              }}
            >
              Something else
            </Chip>
          </ChipRow>
        </View>

        {/* 2. what exactly */}
        {forId && !other && hobby && (
          <View style={{ gap: space.sm }}>
            <Eyebrow color={colors.inkSoft}>Which step?</Eyebrow>
            {matches.map((t) => (
              <OptionRow
                key={t.id}
                radio
                selected={pick?.type === 'step' && pick.id === t.id}
                title={t.title}
                meta={subLine(t) || undefined}
                onPress={() => {
                  setPick({ type: 'step', id: t.id });
                  if (t.minutes) setWhen((w) => ({ ...w, minutes: t.minutes! }));
                }}
              />
            ))}
            {Array.isArray(ideas) &&
              ideas.map((i) => (
                <OptionRow
                  key={i.title}
                  radio
                  selected={pick?.type === 'idea' && pick.title === i.title}
                  title={i.title}
                  meta={`Rusty’s idea · about ${i.minutes} min`}
                  onPress={() => {
                    setPick({ type: 'idea', title: i.title, minutes: i.minutes });
                    setWhen((w) => ({ ...w, minutes: i.minutes }));
                  }}
                />
              ))}
            {ideas === null && (
              <Button
                variant="tertiary"
                small
                icon="sparkle"
                onPress={async () => {
                  setIdeas('loading');
                  setIdeas(await suggestSteps(hobby, current?.title ?? hobby.goal ?? hobby.name));
                }}
              >
                Ask Rusty for ideas
              </Button>
            )}
            {ideas === 'loading' && <T v="caption">Rusty is thinking…</T>}
            <Field
              label="Or write your own"
              value={text}
              onChangeText={(v) => {
                setText(v);
                setPick(v.trim() ? { type: 'own' } : null);
              }}
              placeholder="e.g. Play the first line slowly"
              returnKeyType="done"
            />
            {q && matches.length > 0 && pick?.type === 'own' && (
              <T v="caption" color={colors.actionText}>
                You already have {matches.length === 1 ? 'a step' : 'steps'} like this above. Tap one to use it, or keep typing to make a new one.
              </T>
            )}
          </View>
        )}
        {other && (
          <View style={{ gap: space.xs }}>
            <Field label="What is it?" value={text} onChangeText={setText} placeholder="e.g. Call grandma" autoFocus={!preTask} returnKeyType="done" />
            <T v="caption">Not a hobby, so it goes in your To-dos (with a reminder if you set a time).</T>
          </View>
        )}

        {/* 3. when */}
        {forId && <WhenField value={when} onChange={setWhen} askLength={!other} allowSomeday={other} marks={marks} />}
      </ScrollView>

      <Button variant={other ? 'primary' : 'paw'} disabled={!ready} onPress={save}>
        {!forId
          ? 'Pick what it’s for'
          : other
            ? ownTitle
              ? `Add to To-dos · ${whenSummary({ ...when, minutes: null })}`
              : 'Write what it is'
            : !ready
              ? 'Pick a step above (or write one)'
              : `Promise · ${whenSummary(when)}`}
      </Button>
    </Sheet>
  );
}
