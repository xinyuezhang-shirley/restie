/**
 * Focus timer setup: what are we doing, and for how long?
 *
 * Starting counts as a promise to Rusty, made on the spot:
 *   - one of your steps          → promised for now (it shows up as today's)
 *   - something of your own      → with a hobby: a new step promised for now;
 *                                  without one: a to-do for today
 *   - just hang out              → no plan, rest counts too
 * "Did it" at the end then checks it off like any promise.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, ChipRow, Eyebrow, Field, NavBar, OptionRow, Screen, T } from '@/components/ui';
import { WheelPicker } from '@/components/WheelPicker';
import { addPromise, addTodo, promiseStep, startSession } from '@/data/actions';
import { hobbiesOf, openSteps } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import { RustyPuppet } from '@/rusty/RustyPuppet';
import { colors, space } from '@/theme/tokens';

interface Option {
  key: string;
  label: string;
  meta?: string;
  taskId?: string;
  hobbyId?: string | null;
}

const MINUTES = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => ({ label: `${m} min`, value: m }));

export default function FocusSetup() {
  const params = useLocalSearchParams<{ taskId?: string; title?: string; minutes?: string; hobbyId?: string }>();
  const steps = useDerived(openSteps);
  const hobbies = useStore((s) => s.hobbies);
  const active = useDerived(hobbiesOf).filter((h) => h.status === 'active');

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    if (params.title) list.push({ key: 'suggested', label: params.title, meta: hobbies[params.hobbyId ?? '']?.name, hobbyId: params.hobbyId || null });
    // The step you came from first, then paw promises (by day), then other steps.
    const rank = (t: (typeof steps)[number]) => (t.id === params.taskId ? 0 : t.dueAt ? 1 : 2);
    // Started from a hobby (or a chat about one)? Only that hobby's steps (eval #47).
    const mine = params.hobbyId ? steps.filter((t) => t.hobbyId === params.hobbyId) : steps;
    const ordered = [...mine].sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    for (const t of ordered.slice(0, 4)) {
      list.push({ key: t.id, label: t.title, meta: t.hobbyId ? hobbies[t.hobbyId]?.name : undefined, taskId: t.id, hobbyId: t.hobbyId });
    }
    return list;
  }, [params.title, params.hobbyId, params.taskId, steps, hobbies]);

  const [choice, setChoice] = useState(options[0]?.key ?? 'own');
  const [own, setOwn] = useState('');
  const [ownHobby, setOwnHobby] = useState<string | null>(params.hobbyId || null);
  const [minutes, setMinutes] = useState(Number(params.minutes) || 10);
  const [wheel, setWheel] = useState(false);
  const picked = options.find((o) => o.key === choice);
  const ready = choice !== 'own' || !!own.trim();

  const start = () => {
    if (!ready) return;
    const now = new Date();
    let taskId: string | null = picked?.taskId ?? null;
    let hobbyId: string | null = picked?.hobbyId ?? null;
    let label = picked?.label ?? 'Quiet time';
    if (choice === 'suggested' && picked?.hobbyId) {
      taskId = addPromise({ hobbyId: picked.hobbyId, title: picked.label, minutes, dueAt: now, timed: true }).id;
    } else if (choice === 'own') {
      label = own.trim();
      hobbyId = ownHobby;
      taskId = ownHobby ? addPromise({ hobbyId: ownHobby, title: label, minutes, dueAt: now, timed: true }).id : addTodo(label, now, 'normal', true).id;
    } else if (taskId) {
      // a step you're doing now is a promise kept on the spot
      const t = useStore.getState().tasks[taskId];
      if (t && !t.dueAt) promiseStep(taskId, now, true, minutes);
    }
    if (choice === 'hang') {
      taskId = null;
      hobbyId = null;
      label = 'Quiet time';
    }
    const s = startSession(label, minutes, taskId, hobbyId);
    router.replace({ pathname: '/focus/timer', params: { sessionId: s.id } });
  };

  return (
    <Screen
      nav={<NavBar title="Focus timer" backLabel="Back" />}
      tab="index"
      footer={
        <Button onPress={start} disabled={!ready}>
          {`Start ${minutes} min`}
        </Button>
      }
    >
      <View style={{ gap: space.sm }}>
        <Eyebrow>What are we doing?</Eyebrow>
        {options.map((o) => (
          <OptionRow key={o.key} radio selected={choice === o.key} title={o.label} meta={o.meta} onPress={() => setChoice(o.key)} />
        ))}
        <OptionRow radio selected={choice === 'own'} title="Something of my own" meta="Type it, and pick a hobby if it’s for one" onPress={() => setChoice('own')} />
        {choice === 'own' && (
          <View style={{ gap: space.sm, paddingLeft: space.md }}>
            <Field value={own} onChangeText={setOwn} placeholder="e.g. Sketch the view from my window" autoFocus accessibilityLabel="What you’ll work on" />
            <T v="caption">For a hobby? (optional)</T>
            <ChipRow>
              <Chip selected={!ownHobby} onPress={() => setOwnHobby(null)}>
                Not a hobby
              </Chip>
              {active.map((h) => (
                <Chip key={h.id} selected={ownHobby === h.id} onPress={() => setOwnHobby(h.id)}>
                  {h.name}
                </Chip>
              ))}
            </ChipRow>
          </View>
        )}
        <OptionRow radio selected={choice === 'hang'} title="Just hang out with Rusty" meta="No plan. Rest counts too." onPress={() => setChoice('hang')} />
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>How long?</Eyebrow>
        <ChipRow>
          {[5, 10, 25].map((m) => (
            <Chip
              key={m}
              selected={!wheel && minutes === m}
              onPress={() => {
                setWheel(false);
                setMinutes(m);
              }}
            >
              {`${m} min`}
            </Chip>
          ))}
          <Chip custom icon="clock" selected={wheel} onPress={() => setWheel((w) => !w)}>
            {wheel || ![5, 10, 25].includes(minutes) ? `${minutes} min` : 'Other'}
          </Chip>
        </ChipRow>
        {wheel && <WheelPicker label="How long" items={MINUTES} value={MINUTES.some((m) => m.value === minutes) ? minutes : 10} onChange={setMinutes} />}
      </View>

      <View style={{ alignItems: 'center', gap: space.xs }}>
        <RustyPuppet pose="sleep" size={180} quiet accessibilityLabel="Rusty curled up, ready to keep you company" />
        <T v="callout" color={colors.inkSoft} center>
          {choice === 'hang' ? 'Rusty will keep you company.' : 'Starting counts as a promise to Rusty for today. He’ll work quietly beside you.'}
        </T>
      </View>
    </Screen>
  );
}
