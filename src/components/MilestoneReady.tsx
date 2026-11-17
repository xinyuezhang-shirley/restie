/**
 * Shown when every step of an unfinished milestone is done. Rusty asks
 * instead of deciding: milestones are only ever marked done by the person
 * (and that can be undone too).
 *
 * "Add another step" happens right here: a field with Rusty's ideas for the
 * next step (one tap), so you never get sent somewhere else to do it.
 * `inline`: drawn inside the milestone's own card (no second card, no second
 * progress bar), used on the "Step done" screen.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { suggestSteps } from '@/ai/rusty';
import { ofCount } from '@/copy';
import { addStep, deleteStep, setMilestoneDone } from '@/data/actions';
import { milestoneCount } from '@/data/selectors';
import { showToast, useDerived, useStore } from '@/data/store';
import { colors, space } from '@/theme/tokens';

import { Button, Card, Chip, ChipRow, Field, ProgressBar, Row, RustyAvatar, T } from './ui';

export function MilestoneReady({
  milestoneId,
  onAddStep,
  onDecided,
  inline,
}: {
  milestoneId: string;
  /** "Not yet — add another step" (omit to add it right here) */
  onAddStep?: () => void;
  onDecided?: (done: boolean) => void;
  /** inside the milestone's card: just the question and the choices */
  inline?: boolean;
}) {
  const m = useStore((s) => s.milestones[milestoneId]);
  const hobby = useStore((s) => (m ? s.hobbies[m.hobbyId] : undefined));
  const count = useDerived((s) => (m ? milestoneCount(s, m.hobbyId, m.id) : { done: 0, total: 0 }), [milestoneId]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [ideas, setIdeas] = useState<string[] | null>(null);
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

  const openAdder = () => {
    if (onAddStep) return onAddStep();
    setAdding(true);
    if (!ideas && hobby) void suggestSteps(hobby, m.title).then((r) => setIdeas(r.map((x) => x.title)));
  };
  const add = (title: string) => {
    const t = title.trim();
    if (!t) return;
    const step = addStep({ hobbyId: m.hobbyId, milestoneId: m.id, title: t, dueAt: null });
    setDraft('');
    setAdding(false);
    showToast(`Added to “${m.title}”: ${t}`, () => deleteStep(step.id));
  };

  const controls = (
    <View style={{ gap: space.sm }}>
      {adding ? (
        <View style={{ gap: space.sm }}>
          <Field value={draft} onChangeText={setDraft} placeholder="What’s the next step?" autoFocus onSubmitEditing={() => add(draft)} returnKeyType="done" accessibilityLabel="New step" />
          {ideas === null ? (
            <T v="caption">Rusty is thinking of ideas…</T>
          ) : (
            ideas.length > 0 && (
              <ChipRow>
                {ideas.map((i) => (
                  <Chip key={i} icon="sparkle" onPress={() => add(i)}>
                    {i}
                  </Chip>
                ))}
              </ChipRow>
            )
          )}
          <Row>
            <Button small full={false} style={{ flex: 1 }} disabled={!draft.trim()} onPress={() => add(draft)}>
              {draft.trim() ? 'Add step' : 'Type or pick a step'}
            </Button>
            <Button small full={false} variant="tertiary" onPress={() => setAdding(false)}>
              Cancel
            </Button>
          </Row>
        </View>
      ) : (
        // side by side when inline (short labels), stacked in the card
        <View style={{ gap: space.sm, flexDirection: inline ? 'row' : 'column' }}>
          <Button
            small
            icon="check"
            full={!inline}
            style={inline ? { flex: 1 } : undefined}
            onPress={() => {
              setMilestoneDone(m.id, true);
              showToast(`Milestone reached: ${m.title}`, () => setMilestoneDone(m.id, false));
              onDecided?.(true);
            }}
          >
            {inline ? 'Yes, it’s done' : 'Mark milestone done'}
          </Button>
          <Button small variant="secondary" icon="plus" full={!inline} style={inline ? { flex: 1 } : undefined} onPress={openAdder}>
            {inline ? 'Add a step' : 'Add another step'}
          </Button>
        </View>
      )}
    </View>
  );

  if (inline) {
    return (
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, marginTop: space.xs, gap: space.sm }}>
        <T v="headline">{adding ? `What’s the next step for “${m.title}”?` : 'That was the last step. Is this milestone done?'}</T>
        {controls}
      </View>
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
      {controls}
    </Card>
  );
}
