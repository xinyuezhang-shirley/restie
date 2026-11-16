/**
 * Log a step (Task 1): pick the step you did → it's marked done → the
 * "Step done" screen shows the progress it made (and Undo).
 *
 * Steps are grouped by hobby; each shows the milestone it counts toward, so
 * it's clear what the log will move. Paw promises (steps with a day) come
 * first, then the other open steps of the current milestone.
 * "Something else" logs an unplanned step under the milestone you pick.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Chip, ChipRow, Eyebrow, Field, OptionRow, T } from '@/components/ui';
import { completeTask, logFreeform } from '@/data/actions';
import { currentMilestone, hobbiesOf, milestonesOf, openSteps } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import type { Task } from '@/data/types';
import { plannedFor } from '@/copy';
import { rustyBus } from '@/rusty/brain';
import { colors, space } from '@/theme/tokens';

const PER_HOBBY = 4;

export default function LogSheet() {
  // From a hobby's page: only that hobby's steps (heuristic eval #11).
  const { hobbyId: only } = useLocalSearchParams<{ hobbyId?: string }>();
  const hobbies = useDerived(hobbiesOf).filter((h) => h.status === 'active' && (!only || h.id === only));
  const steps = useDerived(openSteps);
  const milestones = useStore((s) => s.milestones);
  const current = useDerived((s) => Object.fromEntries(hobbies.map((h) => [h.id, currentMilestone(s, h.id)?.id ?? null])), [hobbies.length]);
  const [other, setOther] = useState(false);
  const [text, setText] = useState('');
  const [hobbyId, setHobbyId] = useState<string | null>(hobbies[0]?.id ?? null);
  const [milestoneId, setMilestoneId] = useState<string | null | undefined>(undefined);
  const pickedMilestones = useDerived((s) => (hobbyId ? milestonesOf(s, hobbyId).filter((m) => !m.doneAt) : []), [hobbyId]);

  const done = (taskId: string) => {
    rustyBus.getState().queue('celebrate');
    router.replace({ pathname: '/log-success', params: { taskId } });
  };

  // Per hobby: paw promises first (by day), then current-milestone steps, then the rest.
  const groups = hobbies
    .map((h) => {
      const mine = steps.filter((t) => t.hobbyId === h.id);
      const rank = (t: Task) => (t.dueAt ? 0 : t.milestoneId === current[h.id] ? 1 : 2);
      const sorted = [...mine].sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
      return { hobby: h, steps: sorted.slice(0, PER_HOBBY), more: Math.max(0, sorted.length - PER_HOBBY) };
    })
    .filter((g) => g.steps.length > 0);

  return (
    <Sheet title={other ? 'Log something else' : 'Log a step'}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
        {!other ? (
          <>
            <T v="callout" color={colors.inkSoft}>
              {groups.length ? 'Which step did you do? Tap it to mark it done. You can undo on the next screen.' : 'No open steps right now. Log something you did anyway:'}
            </T>
            {groups.map((g) => (
              <View key={g.hobby.id} style={{ gap: space.sm }}>
                <Eyebrow color={colors.inkSoft}>{g.hobby.name}</Eyebrow>
                {g.steps.map((t) => {
                  const m = t.milestoneId ? milestones[t.milestoneId] : undefined;
                  const meta = [t.dueAt ? plannedFor(t.dueAt, t.timed) : null, m && !m.deletedAt ? `toward “${m.title}”` : null].filter(Boolean).join(' · ');
                  return (
                    <OptionRow
                      key={t.id}
                      title={t.title}
                      meta={meta || 'Step'}
                      onPress={() => {
                        completeTask(t.id);
                        done(t.id);
                      }}
                    />
                  );
                })}
                {g.more > 0 && (
                  <T v="caption">
                    {`+ ${g.more} more on ${g.hobby.name.toLowerCase()}’s path`}
                  </T>
                )}
              </View>
            ))}
            {hobbies.length > 0 && (
              <Button variant="secondary" icon="plus" small onPress={() => setOther(true)}>
                Something else
              </Button>
            )}
          </>
        ) : (
          <>
            <Eyebrow color={colors.inkSoft}>Which hobby?</Eyebrow>
            <ChipRow>
              {hobbies.map((h) => (
                <Chip
                  key={h.id}
                  selected={hobbyId === h.id}
                  onPress={() => {
                    setHobbyId(h.id);
                    setMilestoneId(undefined);
                  }}
                >
                  {h.name}
                </Chip>
              ))}
            </ChipRow>
            {pickedMilestones.length > 0 && (
              <>
                <Eyebrow color={colors.inkSoft}>Counts toward</Eyebrow>
                <ChipRow>
                  {pickedMilestones.map((m, i) => (
                    <Chip key={m.id} selected={milestoneId === m.id || (milestoneId === undefined && i === 0)} onPress={() => setMilestoneId(m.id)}>
                      {m.title}
                    </Chip>
                  ))}
                  <Chip selected={milestoneId === null} onPress={() => setMilestoneId(null)}>
                    No milestone
                  </Chip>
                </ChipRow>
              </>
            )}
            <Field label="What did you do?" value={text} onChangeText={setText} placeholder="e.g. Practiced scales for 10 min" autoFocus />
            <Button
              disabled={!text.trim() || !hobbyId}
              onPress={() => {
                const r = logFreeform(hobbyId!, text.trim(), milestoneId);
                if (r) done(r.task.id);
              }}
            >
              Log it
            </Button>
            <Button variant="tertiary" small onPress={() => setOther(false)}>
              Back to my steps
            </Button>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
