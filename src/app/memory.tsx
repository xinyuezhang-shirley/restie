/** After a focus session: "You're back!" + offer to save a keepsake (Task 3). */
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { MilestoneReady } from '@/components/MilestoneReady';
import { Button, Eyebrow, NavBar, ProgressBar, Screen, T } from '@/components/ui';
import { ofCount } from '@/copy';
import { milestoneCount } from '@/data/selectors';
import { reopenTask } from '@/data/actions';
import { showToast, useDerived, useStore } from '@/data/store';
import { RustyPuppet } from '@/rusty/RustyPuppet';
import { colors, space } from '@/theme/tokens';

export default function Memory() {
  const { outcome, taskId, hobbyId } = useLocalSearchParams<{ outcome: string; taskId?: string; hobbyId?: string }>();
  const task = useStore((s) => (taskId ? s.tasks[taskId] : undefined));
  const milestone = useStore((s) => (task?.milestoneId ? s.milestones[task.milestoneId] : undefined));
  const count = useDerived((s) => (milestone ? milestoneCount(s, milestone.hobbyId, milestone.id) : { done: 0, total: 0 }), [milestone?.id]);
  const didIt = outcome === 'did_it';

  return (
    <Screen
      nav={<NavBar title="Session done" close onBack={() => router.dismissTo('/')} />}
      contentStyle={{ alignItems: 'center' }}
      tab="index"
      footer={
        <>
          <Button icon="camera" onPress={() => router.push({ pathname: '/camera', params: { taskId: taskId ?? '', hobbyId: hobbyId ?? '' } })}>
            Save a keepsake
          </Button>
          <Button variant="tertiary" onPress={() => router.dismissTo('/')}>
            Done
          </Button>
        </>
      }
    >
      <View style={{ backgroundColor: '#FFEBD8', borderRadius: 999, padding: space.md, marginTop: space.lg }}>
        <RustyPuppet pose="cheer" size={230} accessibilityLabel="Rusty cheering" />
      </View>
      <Eyebrow>{didIt ? 'You’re back!' : 'Every bit counts'}</Eyebrow>
      <T v="title1" center>
        {milestone
          ? milestone.doneAt
            ? `You finished “${milestone.title}”!`
            : `One more step toward “${milestone.title}”`
          : didIt
            ? 'You did the thing.'
            : 'You made progress. That’s real.'}
      </T>
      {milestone && count.total > 0 && (
        <ProgressBar done={count.done} total={count.total} label={ofCount(count)} height={12} style={{ alignSelf: 'stretch', marginHorizontal: space.xl }} />
      )}
      {milestone && !milestone.doneAt && count.total > 0 && count.done === count.total && (
        <View style={{ alignSelf: 'stretch' }}>
          <MilestoneReady milestoneId={milestone.id} />
        </View>
      )}
      <T v="callout" color={colors.inkSoft} center>
        Save a keepsake (a photo or a note) so you can look back on it.
      </T>
      {task && task.status === 'done' && (
        <Button
          variant="tertiary"
          small
          onPress={() => {
            reopenTask(task.id);
            showToast(`“${task.title}” is open again.`);
          }}
        >
          Not actually done? Undo
        </Button>
      )}
    </Screen>
  );
}
