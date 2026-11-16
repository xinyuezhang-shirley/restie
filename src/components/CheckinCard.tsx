/**
 * Rusty's check-in on a paw promise (a step with a day).
 *
 * Did it → the "Step done" screen (same as Log): the milestone's progress,
 *          Undo, and — if it was the last step — "mark the milestone done?".
 * Not yet → a gentle ladder instead of a dead end (A5 incident: "Not yet"
 * did nothing in the med-fi):
 *   1st: move it · make it smaller
 *   2nd: make it smaller · do it with me now
 *   3rd: keep trying · save for later · let it go
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { suggestSteps } from '@/ai/rusty';
import { completeTask, letGo, makeSmaller, notYet, reopenTask, reschedule } from '@/data/actions';
import { rustyBus } from '@/rusty/brain';
import { milestoneCount } from '@/data/selectors';
import { ofCount, plannedFor } from '@/copy';
import { showToast, useDerived, useStore } from '@/data/store';
import type { Task } from '@/data/types';
import { checkinQuestion, notYetLadder } from '@/rusty/personality';
import { colors, space } from '@/theme/tokens';

import { WhenPicker } from './WhenPicker';
import { MilestoneReady } from './MilestoneReady';
import { Button, Card, Chip, ChipRow, Eyebrow, ProgressBar, Row, RustyAvatar, T, tap } from './ui';

type Stage = 'ask' | 'done' | 'ladder' | 'when' | 'smaller';

export function CheckinCard({
  task,
  onDone,
  compact,
}: {
  task: Task;
  /** override what "Did it" does (e.g. go to the success screen) */
  onDone?: (task: Task) => void;
  compact?: boolean;
}) {
  const hobby = useStore((s) => (task.hobbyId ? s.hobbies[task.hobbyId] : undefined));
  const milestone = useStore((s) => (task.milestoneId ? s.milestones[task.milestoneId] : undefined));
  const count = useDerived((s) => (milestone ? milestoneCount(s, milestone.hobbyId, milestone.id) : { done: 0, total: 0 }), [milestone?.id]);
  const [stage, setStage] = useState<Stage>('ask');
  const [rung, setRung] = useState(Math.min(task.notYetCount, 3));
  const [smaller, setSmaller] = useState<{ title: string; minutes: number }[] | null>(null);

  const didIt = () => {
    tap('success');
    if (onDone) return onDone(task);
    completeTask(task.id);
    rustyBus.getState().queue('celebrate');
    router.push({ pathname: '/log-success', params: { taskId: task.id } });
  };

  const notYetPressed = () => {
    setRung(notYet(task.id));
    setStage('ladder');
  };

  const askSmaller = async () => {
    setStage('smaller');
    setSmaller(null);
    if (!hobby) return setSmaller([{ title: `Just 5 minutes of ${task.title.toLowerCase()}`, minutes: 5 }]);
    setSmaller(await suggestSteps(hobby, task.title, task.title));
  };

  return (
    // Peach with an orange edge so it stands apart from hobby cards (heuristic eval #34).
    <Card style={{ gap: space.md, backgroundColor: colors.bubbleRusty, borderColor: colors.action, borderWidth: 1.5 }}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <RustyAvatar pose={stage === 'done' ? 'celebrate' : stage === 'ask' ? 'think' : 'idle'} size={compact ? 48 : 60} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow>Rusty’s check-in · your paw promise</Eyebrow>
          {stage === 'done' ? (
            <>
              <T v="title2">Step done! I’m doing a little dance.</T>
              {milestone && count.total > 0 && (
                <>
                  <T v="caption">{milestone.title}</T>
                  <ProgressBar done={count.done} total={count.total} label={ofCount(count)} />
                </>
              )}
            </>
          ) : stage === 'ask' ? (
            <>
              <T v="title2">{checkinQuestion(task.title)}</T>
              <T v="caption">
                {[
                  hobby?.name,
                  milestone && !milestone.deletedAt ? `toward “${milestone.title}”` : null,
                  plannedFor(task.dueAt, task.timed),
                  task.minutes ? `${task.minutes} min` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </>
          ) : stage === 'ladder' ? (
            <T v="callout">{notYetLadder[rung as 1 | 2 | 3]}</T>
          ) : stage === 'when' ? (
            <T v="callout">when feels better?</T>
          ) : (
            <T v="callout">here are smaller versions. pick one:</T>
          )}
        </View>
      </Row>

      {stage === 'ask' && (
        <Row>
          <Button full={false} style={{ flex: 1 }} onPress={didIt}>
            Did it
          </Button>
          <Button full={false} style={{ flex: 1 }} variant="secondary" onPress={notYetPressed}>
            Not yet
          </Button>
        </Row>
      )}
      {stage === 'ask' && !compact && (
        <Button variant="tertiary" small onPress={() => router.push({ pathname: '/chat', params: { about: task.id } })}>
          Talk to Rusty
        </Button>
      )}

      {stage === 'done' && milestone && !milestone.doneAt && count.total > 0 && count.done === count.total && (
        <MilestoneReady milestoneId={milestone.id} />
      )}
      {stage === 'done' && (
        <Row>
          {hobby && (
            <Button full={false} small style={{ flex: 1 }} variant="secondary" onPress={() => router.push(`/hobby/${hobby.id}`)}>
              See the path
            </Button>
          )}
          <Button
            full={false}
            small
            style={{ flex: 1 }}
            variant="tertiary"
            onPress={() => {
              reopenTask(task.id);
              showToast(`“${task.title}” is open again.`);
              setStage('ask');
            }}
          >
            Undo
          </Button>
        </Row>
      )}

      {stage === 'ladder' && (
        <ChipRow>
          {rung === 1 && (
            <>
              <Chip onPress={() => { reschedule(task.id, 'tomorrow'); showToast('Moved to tomorrow. No rush.'); setStage('ask'); }}>Tomorrow</Chip>
              <Chip onPress={() => setStage('when')}>Pick a new time</Chip>
              <Chip onPress={askSmaller}>Make it smaller</Chip>
            </>
          )}
          {rung === 2 && (
            <>
              <Chip onPress={askSmaller}>Make it smaller</Chip>
              <Chip onPress={() => router.push({ pathname: '/focus/setup', params: { taskId: task.id, minutes: '5' } })}>
                Do it with me now
              </Chip>
              <Chip onPress={() => setStage('when')}>Move it</Chip>
            </>
          )}
          {rung >= 3 && (
            <>
              <Chip onPress={() => { reschedule(task.id, 'tomorrow'); showToast('Okay! Tomorrow it is.'); setStage('ask'); }}>Keep trying</Chip>
              <Chip onPress={() => { reschedule(task.id, 'nextweek'); showToast('Saved for next week.'); setStage('ask'); }}>Save for later</Chip>
              <Chip onPress={() => letGo(task.id)}>Let it go</Chip>
            </>
          )}
        </ChipRow>
      )}

      {stage === 'when' && (
        <WhenPicker
          onPick={(v) => {
            reschedule(task.id, v.date);
            showToast(`Moved to ${v.label.toLowerCase()}.`);
            setStage('ask');
          }}
        />
      )}

      {stage === 'smaller' && (
        <ChipRow>
          {smaller === null ? (
            <T v="caption">Rusty is thinking…</T>
          ) : (
            smaller.map((s) => (
              <Chip
                key={s.title}
                onPress={() => {
                  makeSmaller(task.id, s.title, s.minutes);
                  showToast('Smaller step saved. You’ve got this.');
                  setStage('ask');
                }}
              >
                {`${s.title} · ${s.minutes} min`}
              </Chip>
            ))
          )}
        </ChipRow>
      )}
      {stage !== 'ask' && stage !== 'done' && (
        <Button variant="tertiary" small onPress={() => setStage('ask')}>
          Never mind
        </Button>
      )}
    </Card>
  );
}

/** Shown in place of a check-in when nothing is due. */
export function NothingDueCard({ onPlan }: { onPlan: () => void }) {
  return (
    <Card style={{ gap: space.md, backgroundColor: '#FFF9F3' }}>
      <Row gap={space.md}>
        <RustyAvatar pose="sleep" size={56} />
        <View style={{ flex: 1 }}>
          <Eyebrow>Rusty check-in</Eyebrow>
          <T v="title2">Nothing due right now.</T>
          <T v="caption" color={colors.inkSoft}>
            Rest counts too. Want to give a step a day?
          </T>
        </View>
      </Row>
      <Button variant="secondary" small onPress={onPlan}>
        Promise a step
      </Button>
    </Card>
  );
}
