/**
 * Shown when every step of an unfinished milestone is done. Rusty asks
 * instead of deciding: milestones are only ever marked done by the person
 * (and that can be undone too).
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { ofCount } from '@/copy';
import { setMilestoneDone } from '@/data/actions';
import { milestoneCount } from '@/data/selectors';
import { showToast, useDerived, useStore } from '@/data/store';
import { colors, space } from '@/theme/tokens';

import { Button, Card, ProgressBar, Row, RustyAvatar, T } from './ui';

export function MilestoneReady({
  milestoneId,
  onAddStep,
  onDecided,
}: {
  milestoneId: string;
  /** "Not yet — add another step" */
  onAddStep?: () => void;
  onDecided?: (done: boolean) => void;
}) {
  const m = useStore((s) => s.milestones[milestoneId]);
  const count = useDerived((s) => (m ? milestoneCount(s, m.hobbyId, m.id) : { done: 0, total: 0 }), [milestoneId]);
  if (!m || m.deletedAt) return null;

  if (m.doneAt) {
    return (
      <Card style={{ gap: space.sm, backgroundColor: colors.successSurface, borderColor: colors.done }}>
        <Row gap={space.md}>
          <RustyAvatar pose="celebrate" size={52} />
          <View style={{ flex: 1 }}>
            <T v="title2">Milestone reached!</T>
            <T v="callout">{m.title}</T>
          </View>
        </Row>
        <Button variant="secondary" small icon="camera" onPress={() => router.push({ pathname: '/camera', params: { hobbyId: m.hobbyId } })}>
          Save a keepsake for this milestone
        </Button>
        <Button
          variant="tertiary"
          small
          onPress={() => {
            setMilestoneDone(m.id, false);
            onDecided?.(false);
          }}
        >
          Undo: it’s not done yet
        </Button>
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.md, backgroundColor: '#FFF9F3' }}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <RustyAvatar pose="think" size={52} />
        <View style={{ flex: 1, gap: space.xs }}>
          <T v="title2">That was every step in “{m.title}”</T>
          <ProgressBar done={count.done} total={count.total} label={ofCount(count)} />
          <T v="callout" color={colors.inkSoft}>
            Is the milestone done, or does it need another step?
          </T>
        </View>
      </Row>
      {/* stacked, full width: both labels fit on one line, and the choice reads top-down */}
      <View style={{ gap: space.sm }}>
        <Button
          small
          icon="check"
          onPress={() => {
            setMilestoneDone(m.id, true);
            showToast(`Milestone reached: ${m.title}`, () => setMilestoneDone(m.id, false));
            onDecided?.(true);
          }}
        >
          Mark milestone done
        </Button>
        {onAddStep && (
          <Button small variant="secondary" icon="plus" onPress={onAddStep}>
            Add another step
          </Button>
        )}
      </View>
    </Card>
  );
}
