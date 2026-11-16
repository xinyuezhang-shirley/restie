import { View } from 'react-native';

import { lastWorked, ofCount, plannedFor } from '@/copy';
import { nextStepOf, progressOf } from '@/data/selectors';
import { useDerived } from '@/data/store';
import type { Hobby } from '@/data/types';
import { ago, daysBetween } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

import { HobbyArt, useOfferFor } from './HobbyArt';
import { Card, ProgressBar, Row, T, Tag } from './ui';

/** Hobby sticker, name, last activity, goal, milestone dots, what's next. */
export function HobbyCard({ hobby, onPress }: { hobby: Hobby; onPress: () => void }) {
  const progress = useDerived((s) => progressOf(s, hobby.id), [hobby.id]);
  const next = useDerived((s) => nextStepOf(s, hobby.id), [hobby.id]);
  const offer = useOfferFor(hobby.id);
  const isNew = daysBetween(new Date(hobby.createdAt), new Date()) < 1;
  const doneToday = hobby.lastDoneAt && daysBetween(new Date(hobby.lastDoneAt), new Date()) === 0;
  const label = `${hobby.name}. ${hobby.kind === 'goal' ? `Goal: ${hobby.goal}.` : ''} Last worked on ${ago(hobby.lastDoneAt)}.`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
        doneToday && { borderColor: colors.done, borderWidth: 2, backgroundColor: '#FBFFF4' },
        hobby.status === 'paused' && { opacity: 0.7 },
      ]}
    >
      <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
        <HobbyArt hobby={hobby} size={50} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        {/* Name wraps (never runs off the card); tags sit after it; when you
            last worked on it gets its own line so long names can't push it out. */}
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <T v="title2">{hobby.name}</T>
          {isNew && <Tag>New</Tag>}
          {hobby.status === 'paused' && <Tag color={colors.border}>Resting</Tag>}
          {offer && <Tag color={colors.bubbleRusty}>Rusty drew something</Tag>}
        </Row>
        <T v="caption">{isNew && !hobby.lastDoneAt ? 'Started today' : lastWorked(ago(hobby.lastDoneAt))}</T>
        <T v="callout" color={colors.inkSoft} numberOfLines={2}>
          {hobby.kind === 'goal' ? `Goal: ${hobby.goal}` : `Just for fun${hobby.rhythm ? ` · ${hobby.rhythm}` : ''}`}
        </T>
        {progress.milestones.length > 0 && (
          <ProgressBar
            done={progress.milestonesDone}
            total={progress.milestones.length}
            label={ofCount({ done: progress.milestonesDone, total: progress.milestones.length }, 'milestone')}
            style={{ marginTop: space.xs }}
          />
        )}
        {progress.current ? (
          <T v="caption">
            Now: {progress.current.title}
            {progress.stepsTotal ? ` · ${ofCount({ done: progress.stepsDone, total: progress.stepsTotal })}` : ''}
          </T>
        ) : progress.milestones.length > 0 ? (
          <T v="caption" color={colors.successText}>
            Goal reached 🎉
          </T>
        ) : null}
        {next ? (
          <T v="caption" color={colors.actionText}>
            Next step: {next.title}
            {next.dueAt ? ` · ${plannedFor(next.dueAt, next.timed)}` : ''}
          </T>
        ) : progress.milestones.length === 0 ? (
          // nothing planned yet: say what tapping does (instead of a dead end)
          <T v="caption" color={colors.actionText}>
            No next step yet · tap to add one ›
          </T>
        ) : null}
      </View>
    </Card>
  );
}
