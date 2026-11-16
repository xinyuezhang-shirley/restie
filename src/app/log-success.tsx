/**
 * "Step done" — after logging (Log sheet, check-in "Did it", Rusty's menu).
 *
 * Shows exactly what changed: the step, the milestone it counts toward with
 * every step listed (this one highlighted) and "3 of 4 steps". If it was the
 * last step, Rusty asks whether the milestone is done (never automatic).
 * Undo puts everything back. A note and a keepsake can be added here.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MilestoneReady } from '@/components/MilestoneReady';
import { Button, Card, Eyebrow, Field, NavBar, ProgressBar, Row, Screen, T } from '@/components/ui';
import { ofCount } from '@/copy';
import { reopenTask, updateTask } from '@/data/actions';
import { milestoneCount, progressOf, stepsOf } from '@/data/selectors';
import { showToast, useDerived, useStore } from '@/data/store';
import { RustyPuppet } from '@/rusty/RustyPuppet';
import { colors, space } from '@/theme/tokens';

export default function LogSuccess() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const task = useStore((s) => s.tasks[taskId]);
  const hobby = useStore((s) => (task?.hobbyId ? s.hobbies[task.hobbyId] : undefined));
  const name = useStore((s) => s.profile.name);
  const milestone = useStore((s) => (task?.milestoneId ? s.milestones[task.milestoneId] : undefined));
  const progress = useDerived((s) => (hobby ? progressOf(s, hobby.id) : null), [hobby?.id]);
  const count = useDerived((s) => (milestone ? milestoneCount(s, milestone.hobbyId, milestone.id) : { done: 0, total: 0 }), [milestone?.id]);
  const siblings = useDerived((s) => (milestone ? stepsOf(s, milestone.hobbyId, milestone.id) : []), [milestone?.id]);
  const [note, setNote] = useState(task?.note ?? '');
  const isDone = task?.status === 'done';
  const milestoneDone = !!milestone?.doneAt;
  const ready = !!milestone && !milestoneDone && count.total > 0 && count.done === count.total;

  const home = () => router.dismissTo('/');

  const undo = () => {
    if (!task) return;
    reopenTask(task.id);
    showToast(`Undone. “${task.title}” is open again.`);
    if (router.canGoBack()) router.back();
    else home();
  };

  return (
    <Screen
      nav={<NavBar backLabel="Home" onBack={home} />}
      contentStyle={{ alignItems: 'stretch' }}
      tab="hobbies"
      footer={
        <>
          {hobby && (
            <Button onPress={() => router.replace(`/hobby/${hobby.id}`)}>{`See ${hobby.name.toLowerCase()}’s path`}</Button>
          )}
          <Button
            variant="secondary"
            icon="camera"
            onPress={() => router.push({ pathname: '/camera', params: { taskId, hobbyId: hobby?.id ?? '' } })}
          >
            Save a keepsake
          </Button>
        </>
      }
    >
      <View style={{ alignItems: 'center' }}>
        <RustyPuppet pose={isDone ? 'cheer' : 'sit'} size={190} accessibilityLabel="Rusty celebrating" />
        <Eyebrow>{name ? `Nice work, ${name}` : 'Nice work'}</Eyebrow>
        <T v="display" center>
          {!isDone ? 'Step reopened' : milestoneDone ? 'Milestone reached!' : 'Step done'}
        </T>
        {task && (
          <T v="body" center color={colors.inkSoft}>
            {task.title}
          </T>
        )}
        {task && isDone && (
          <Button variant="tertiary" small full={false} onPress={undo} accessibilityLabel="Undo, mark the step not done">
            Not done after all? Undo
          </Button>
        )}
      </View>

      {/* the milestone this step counts toward, with every step listed */}
      {milestone && (
        <Card style={{ gap: space.sm }}>
          <Eyebrow>{hobby ? `${hobby.name} · milestone` : 'Milestone'}</Eyebrow>
          <T v="title2">{milestone.title}</T>
          <ProgressBar done={count.done} total={count.total} label={ofCount(count)} height={10} />
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            {siblings.map((t) => {
              const done = t.status === 'done';
              const me = t.id === task?.id;
              return (
                <Row key={t.id} gap={space.sm}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: done ? colors.done : '#D9C2A7',
                      backgroundColor: done ? colors.done : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done && <Icon name="check" size={12} color={colors.white} strokeWidth={3} />}
                  </View>
                  <T v={me ? 'headline' : 'callout'} color={done && !me ? colors.inkSoft : colors.ink} style={{ flex: 1 }}>
                    {t.title}
                    {me ? '  ← just now' : ''}
                  </T>
                </Row>
              );
            })}
          </View>
        </Card>
      )}

      {(ready || milestoneDone) && (
        <MilestoneReady
          milestoneId={milestone!.id}
          onAddStep={() => (hobby ? router.replace(`/hobby/${hobby.id}`) : undefined)}
        />
      )}
      {milestoneDone && progress?.current && (
        <T v="callout" center>
          Next up: {progress.current.title}
        </T>
      )}

      {task && isDone && (
        <Field
          label="Add a note (optional)"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            updateTask(task.id, { note: t.trim() || null });
          }}
          placeholder="How did it go?"
        />
      )}

    </Screen>
  );
}
