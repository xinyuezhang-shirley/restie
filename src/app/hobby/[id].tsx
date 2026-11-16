/**
 * One hobby, laid out as its path (heuristic eval: logging needed better
 * editing, clearer progress and undo).
 *
 *   Goal card ............ goal (editable) · "1 of 4 milestones" bar · Next step
 *   Rusty check-in ....... when a paw promise is due
 *   Path ................. milestones in order; each shows "2 of 4 steps".
 *     ✓ Tune the guitar                         (tap ○/✓ to mark done / undo)
 *     ● Learn verse 3     ▓▓▓░ 2 of 4 steps     ← current, open by default
 *         [✓] Learn the chord shapes            ← tap box: done / undo
 *         [ ] Find chords for verse 3  🐾 Today ← tap row: edit, substeps, day
 *         + Add a step · Step ideas from Rusty
 *     ○ Play it with the song
 *     Edit path → rename / reorder / add / delete milestones
 *   Recent · Keepsakes · Rest / Delete
 *
 * Nothing completes by itself: when every step of a milestone is done, Rusty
 * asks whether the milestone is done. Every change has an Undo.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { suggestSteps } from '@/ai/rusty';
import { hobbyIcons } from '@/assets';
import { CheckinCard } from '@/components/CheckinCard';
import { Icon } from '@/components/Icon';
import { KeepsakeImage } from '@/components/KeepsakeImage';
import { MilestoneReady } from '@/components/MilestoneReady';
import { SegmentBar } from '@/components/Progress';
import { StepRow } from '@/components/StepRow';
import { Button, Card, CHEVRON, Chip, ChipRow, Eyebrow, Field, IconButton, NavBar, ProgressBar, Row, Screen, T, Tag, tap } from '@/components/ui';
import { lastWorked, ofCount, plannedFor, plural } from '@/copy';
import {
  addMilestone,
  addStep,
  deleteHobby,
  deleteMilestone,
  deleteTask,
  moveMilestone,
  renameMilestone,
  setHobbyStatus,
  toggleMilestone,
  updateHobby,
} from '@/data/actions';
import { keepsakesOf, milestoneCount, nextStepOf, openPromises, progressOf, recentActivity, stepsOf } from '@/data/selectors';
import { patch, showToast, useDerived, useStore } from '@/data/store';
import type { Hobby, Milestone } from '@/data/types';
import { ago, dateLabel, dayKey } from '@/lib/time';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function HobbyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hobby = useStore((s) => s.hobbies[id]);
  const progress = useDerived((s) => progressOf(s, id), [id]);
  const loose = useDerived((s) => stepsOf(s, id, null), [id]);
  const next = useDerived((s) => nextStepOf(s, id), [id]);
  const due = useDerived((s) => openPromises(s, id).find((t) => t.dueAt && dayKey(new Date(t.dueAt)) <= dayKey()), [id]);
  const recent = useDerived((s) => recentActivity(s, id, 6), [id]);
  const keeps = useDerived((s) => keepsakesOf(s).filter((k) => k.hobbyId === id).slice(0, 6), [id]);
  const [editPath, setEditPath] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [goal, setGoal] = useState(hobby?.goal ?? '');
  const [newMs, setNewMs] = useState('');
  // Which milestones are open. Default: just the current one.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!hobby || hobby.deletedAt) {
    return (
      <Screen nav={<NavBar backLabel="Hobbies" />} tab="hobbies">
        <T>This hobby isn’t here anymore.</T>
      </Screen>
    );
  }

  const isOpen = (m: Milestone, i: number) => open[m.id] ?? i === progress.currentIndex;
  const total = progress.milestones.length;

  const saveGoal = () => {
    updateHobby(hobby.id, { goal: goal.trim() || hobby.goal });
    setEditGoal(false);
  };

  const finishEditing = () => {
    // keep a milestone that was typed but not added yet
    if (newMs.trim()) addMilestone(hobby.id, newMs.trim());
    setNewMs('');
    setEditPath(false);
  };

  const confirmDelete = () => {
    const go = () => {
      deleteHobby(hobby.id);
      showToast(`${hobby.name} removed.`);
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Delete ${hobby.name}?`, 'Its milestones and steps go too. Keepsakes stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen nav={<NavBar title={hobby.name} backLabel="Hobbies" />} tab="hobbies">
      {/* Goal + overall progress */}
      <Card style={{ gap: space.md }}>
        <Row gap={space.md} style={{ alignItems: 'center' }}>
          <Image source={hobbyIcons[hobby.icon]} style={{ width: 64, height: 64 }} contentFit="contain" />
          <View style={{ flex: 1, gap: space.xs }}>
            <Eyebrow>{hobby.kind === 'goal' ? 'Goal' : 'Just for fun'}</Eyebrow>
            {editGoal ? (
              <Field value={goal} onChangeText={setGoal} autoFocus onSubmitEditing={saveGoal} accessibilityLabel="Goal" />
            ) : (
              <T v="title1">{hobby.kind === 'goal' ? hobby.goal : (hobby.rhythm ?? 'Whenever feels nice')}</T>
            )}
            <T v="caption">
              Started {dateLabel(hobby.createdAt)} · {lastWorked(ago(hobby.lastDoneAt)).toLowerCase()}
            </T>
          </View>
          {hobby.kind === 'goal' && (
            <IconButton
              name={editGoal ? 'check' : 'pencil'}
              label={editGoal ? 'Save goal' : 'Edit goal'}
              onPress={() => (editGoal ? saveGoal() : setEditGoal(true))}
            />
          )}
        </Row>
        {total > 0 && (
          <ProgressBar
            done={progress.milestonesDone}
            total={total}
            label={progress.milestonesDone === total ? 'Goal reached 🎉' : ofCount({ done: progress.milestonesDone, total }, 'milestone')}
            height={10}
          />
        )}
        {next && (
          <Pressable
            onPress={() => router.push(`/step/${next.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Next step: ${next.title}`}
            style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Eyebrow color={colors.actionText}>Next step</Eyebrow>
              <T v="headline">{next.title}</T>
              <T v="caption">{next.dueAt ? plannedFor(next.dueAt, next.timed) : 'No day yet · tap to promise one'}</T>
            </View>
            <Icon name="right" size={CHEVRON} color={colors.inkSoft} />
          </Pressable>
        )}
      </Card>

      {due && <CheckinCard task={due} compact />}

      {/* log or promise right here, without going back to Home (eval #11) */}
      <View style={{ gap: space.sm }}>
        <Button icon="check" onPress={() => router.push({ pathname: '/log', params: { hobbyId: hobby.id } })}>
          {`Log a ${hobby.name.toLowerCase()} step`}
        </Button>
        <Button variant="secondary" icon="paw" onPress={() => router.push({ pathname: '/promise', params: { hobbyId: hobby.id } })}>
          {`Promise a ${hobby.name.toLowerCase()} step`}
        </Button>
      </View>

      {hobby.kind === 'keep' && total === 0 && (
        <Button variant="secondary" icon="sparkle" onPress={() => router.push({ pathname: '/new-hobby', params: { hobbyId: hobby.id } })}>
          Set a goal with Rusty
        </Button>
      )}

      {/* Path */}
      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="title2" accessibilityRole="header">
              {total > 0 ? 'Path' : 'Steps'}
            </T>
            <T v="caption">{total > 0 ? 'Milestones in order. Tap one to see its steps.' : 'Small things you can do in one sitting.'}</T>
          </View>
          {total > 0 || editPath ? (
            <Button
              full={false}
              small
              variant={editPath ? 'primary' : 'secondary'}
              icon={editPath ? 'check' : 'pencil'}
              onPress={() => (editPath ? finishEditing() : setEditPath(true))}
            >
              {editPath ? 'Done' : 'Edit path'}
            </Button>
          ) : null}
        </Row>

        {progress.milestones.map((m, i) => (
          <MilestoneBlock
            key={m.id}
            hobby={hobby}
            m={m}
            index={i}
            count={total}
            current={i === progress.currentIndex}
            open={isOpen(m, i) && !editPath}
            editing={editPath}
            onToggleOpen={() => setOpen((o) => ({ ...o, [m.id]: !isOpen(m, i) }))}
          />
        ))}

        {editPath && (
          <Card style={{ gap: space.sm }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Field
                  value={newMs}
                  onChangeText={setNewMs}
                  placeholder="+ Add a milestone"
                  accessibilityLabel="New milestone"
                  onSubmitEditing={() => {
                    if (newMs.trim()) addMilestone(hobby.id, newMs.trim());
                    setNewMs('');
                  }}
                />
              </View>
              <IconButton
                name="plus"
                label="Add milestone"
                bg={colors.muted}
                color={colors.actionText}
                onPress={() => {
                  if (newMs.trim()) addMilestone(hobby.id, newMs.trim());
                  setNewMs('');
                }}
              />
            </Row>
            <T v="caption">Rename, reorder or remove milestones. Their steps are kept.</T>
          </Card>
        )}

        {/* Steps that aren't under a milestone (or every step, for hobbies without one) */}
        {(loose.length > 0 || total === 0) && !editPath && (
          <Card style={{ gap: 0 }}>
            {total > 0 && <Eyebrow color={colors.inkSoft}>Other steps</Eyebrow>}
            {loose.map((t) => (
              <StepRow key={t.id} task={t} flat />
            ))}
            <AddStep hobby={hobby} milestoneId={null} label={total > 0 ? 'Other steps' : hobby.name} />
          </Card>
        )}
        {total === 0 && !editPath && (
          <Button variant="tertiary" small icon="plus" onPress={() => setEditPath(true)}>
            Add milestones (optional)
          </Button>
        )}
      </View>

      <Button
        variant="secondary"
        icon="clock"
        onPress={() => router.push({ pathname: '/focus/setup', params: { taskId: next?.id ?? '', hobbyId: hobby.id } })}
      >
        Work on it with Rusty now
      </Button>

      {/* Recent */}
      {recent.length > 0 && (
        <Card style={{ gap: space.sm }}>
          <Eyebrow>Recent</Eyebrow>
          {recent.map((a) => (
            <T key={a.id} v="callout">
              <T v="callout" style={{ fontFamily: fonts.bodyBold }}>
                {ago(a.createdAt)}
              </T>
              {` · ${a.text}`}
            </T>
          ))}
        </Card>
      )}

      {keeps.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow color={colors.inkSoft}>Keepsakes</Eyebrow>
          <Row style={{ flexWrap: 'wrap' }}>
            {keeps.map((k) => (
              <Pressable key={k.id} onPress={() => router.push(`/keepsake/${k.id}`)} accessibilityRole="button" accessibilityLabel={k.caption}>
                <KeepsakeImage keepsake={k} style={{ width: 76, height: 76, borderRadius: radius.input - 4, backgroundColor: colors.canvas }} />
              </Pressable>
            ))}
          </Row>
        </View>
      )}

      <View style={{ gap: space.xs, marginTop: space.md }}>
        <Button
          variant="tertiary"
          small
          onPress={() => {
            const before = hobby.status;
            const nextStatus = before === 'active' ? 'paused' : 'active';
            setHobbyStatus(hobby.id, nextStatus);
            showToast(
              nextStatus === 'paused' ? `${hobby.name} is resting. It’ll be here when you’re ready.` : `Welcome back, ${hobby.name.toLowerCase()}!`,
              () => setHobbyStatus(hobby.id, before),
            );
          }}
        >
          {hobby.status === 'active' ? 'Rest this hobby for now' : 'Pick it back up'}
        </Button>
        <Button variant="tertiary" small icon="trash" onPress={confirmDelete}>
          Delete hobby
        </Button>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------ milestone */

function MilestoneBlock({
  hobby,
  m,
  index,
  count,
  current,
  open,
  editing,
  onToggleOpen,
}: {
  hobby: Hobby;
  m: Milestone;
  index: number;
  count: number;
  current: boolean;
  open: boolean;
  editing: boolean;
  onToggleOpen: () => void;
}) {
  const steps = useDerived((s) => stepsOf(s, hobby.id, m.id), [hobby.id, m.id]);
  const c = useDerived((s) => milestoneCount(s, hobby.id, m.id), [hobby.id, m.id]);
  const [adding, setAdding] = useState(false);
  const done = !!m.doneAt;
  const ready = !done && c.total > 0 && c.done === c.total;

  const remove = () => {
    const go = () => {
      deleteMilestone(m.id);
      showToast(
        c.total ? `Removed “${m.title}”. Its ${plural(c.total, 'step')} moved to Other steps.` : `Removed “${m.title}”.`,
        () => patch('milestones', m.id, { deletedAt: null }),
      );
    };
    if (Platform.OS === 'web' || c.total === 0) return go();
    Alert.alert(`Remove “${m.title}”?`, `Its ${plural(c.total, 'step')} will move to Other steps.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Card style={[{ gap: space.sm, paddingVertical: space.md }, current && !editing && styles.currentCard]}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        {/* done / undo */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Milestone ${index + 1} of ${count}: ${m.title}`}
          accessibilityHint={done ? 'Marks it not done' : 'Marks the milestone done'}
          onPress={() => {
            tap(done ? 'light' : 'success');
            toggleMilestone(m.id);
          }}
          hitSlop={10}
          style={[
            styles.circle,
            (done || current) && { borderColor: done ? colors.done : colors.action },
            done && { backgroundColor: colors.done },
          ]}
        >
          {done ? (
            <Icon name="check" size={15} color={colors.white} strokeWidth={3} />
          ) : (
            <T v="label" color={current ? colors.actionText : colors.inkSoft}>
              {index + 1}
            </T>
          )}
        </Pressable>

        {editing ? (
          <View style={{ flex: 1, gap: space.xs }}>
            <MilestoneTitle id={m.id} title={m.title} />
            <T v="caption">{c.total ? `${plural(c.total, 'step')} inside` : 'No steps yet'}</T>
          </View>
        ) : (
          <Pressable
            style={{ flex: 1, gap: space.sm }}
            onPress={onToggleOpen}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${m.title}, ${c.total ? ofCount(c) : 'no steps yet'}`}
            accessibilityHint={open ? 'Hides its steps' : 'Shows its steps'}
          >
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: space.xs }}>
                <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                  <T v="title2" color={done ? colors.inkSoft : colors.ink}>
                    {m.title}
                  </T>
                  {current && <Tag color="#FFD9C7">Now</Tag>}
                </Row>
                {done && m.doneAt ? (
                  <T v="caption" color={colors.successText}>
                    Reached {dateLabel(m.doneAt)}
                  </T>
                ) : null}
              </View>
              <Icon name={open ? 'up' : 'down'} size={CHEVRON} color={colors.inkSoft} />
            </Row>
            {/* the milestone as a bar made of its steps (numbers match the steps below) */}
            <SegmentBar steps={steps} numbered={open} label={`${m.title}: ${c.total ? ofCount(c) : 'no steps yet'}`} />
            <T v="caption" color={c.total && c.done === c.total ? colors.successText : colors.inkSoft}>
              {c.total ? ofCount(c) : `No steps yet${open ? '' : ' · tap to add one'}`}
            </T>
          </Pressable>
        )}

        {editing && (
          <Row gap={0}>
            <IconButton name="up" label={`Move ${m.title} up`} size={34} onPress={() => moveMilestone(hobby.id, m.id, -1)} />
            <IconButton name="down" label={`Move ${m.title} down`} size={34} onPress={() => moveMilestone(hobby.id, m.id, 1)} />
            <IconButton name="trash" label={`Remove ${m.title}`} size={34} onPress={remove} />
          </Row>
        )}
      </Row>

      {open && (
        <View style={{ paddingLeft: 30 + space.md }}>
          {steps.map((t, i) => (
            <StepRow key={t.id} task={t} flat number={i + 1} />
          ))}
          {ready && (
            <View style={{ marginTop: space.sm, marginBottom: space.md }}>
              <MilestoneReady milestoneId={m.id} onAddStep={() => setAdding(true)} />
            </View>
          )}
          <AddStep hobby={hobby} milestoneId={m.id} label={m.title} autoFocus={adding} />
        </View>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- add step */

function AddStep({ hobby, milestoneId, label, autoFocus }: { hobby: Hobby; milestoneId: string | null; label: string; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<{ title: string; minutes: number }[] | null | 'loading'>(null);
  const milestone = useStore((s) => (milestoneId ? s.milestones[milestoneId] : undefined));

  const add = (title: string, minutes?: number) => {
    if (!title.trim()) return;
    const t = addStep({ hobbyId: hobby.id, milestoneId, title: title.trim(), minutes, dueAt: null });
    showToast(`Step added to “${milestone?.title ?? label}”.`, () => deleteTask(t.id));
  };

  return (
    <View style={{ gap: space.sm, paddingTop: space.xs }}>
      <Row>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="+ Add a step"
          placeholderTextColor={colors.inkSoft}
          autoFocus={autoFocus}
          onSubmitEditing={() => {
            add(text);
            setText('');
          }}
          submitBehavior="submit"
          returnKeyType="done"
          accessibilityLabel={`New step for ${label}`}
          style={styles.addInput}
        />
        <IconButton
          name="plus"
          label={`Add step to ${label}`}
          size={40}
          bg={colors.muted}
          color={colors.actionText}
          onPress={() => {
            add(text);
            setText('');
          }}
        />
      </Row>
      {ideas === null ? (
        <Pressable
          onPress={async () => {
            setIdeas('loading');
            setIdeas(await suggestSteps(hobby, milestone?.title ?? hobby.goal ?? hobby.name));
          }}
          accessibilityRole="button"
          hitSlop={6}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs }}
        >
          <Icon name="sparkle" size={16} color={colors.actionText} />
          <T v="label" color={colors.actionText}>
            Step ideas from Rusty
          </T>
        </Pressable>
      ) : ideas === 'loading' ? (
        <T v="caption">Rusty is thinking…</T>
      ) : (
        <ChipRow>
          {ideas.map((i) => (
            <Chip
              key={i.title}
              onPress={() => {
                add(i.title, i.minutes);
                setIdeas((cur) => (Array.isArray(cur) ? cur.filter((x) => x.title !== i.title) : cur));
              }}
            >
              {`+ ${i.title} · ${i.minutes} min`}
            </Chip>
          ))}
          <Chip onPress={() => setIdeas(null)}>Hide ideas</Chip>
        </ChipRow>
      )}
    </View>
  );
}

/** Saves as you type (an empty box keeps the old title). */
function MilestoneTitle({ id, title }: { id: string; title: string }) {
  const [text, setText] = useState(title);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        if (t.trim()) renameMilestone(id, t.trim());
      }}
      onBlur={() => !text.trim() && setText(title)}
      multiline
      submitBehavior="blurAndSubmit"
      accessibilityLabel="Milestone name"
      style={styles.msInput}
    />
  );
}

const styles = StyleSheet.create({
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#FFF4EA',
    borderRadius: radius.input,
    padding: space.md,
  },
  currentCard: { borderColor: '#F8C9AE', borderWidth: 1.5 },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#E3C9AE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  addInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  msInput: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.muted,
    borderRadius: 10,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 40,
  },
});
