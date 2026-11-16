/**
 * One step, fully editable (heuristic eval: steps needed editing, refining,
 * clearer progress, and undo).
 *
 *   Guitar · Learn verse 3
 *   [Find chords for verse 3          ]   ← rename (saves as you type)
 *   [ Mark step done ]  /  ✓ Done today · Undo
 *   Substeps  ▓▓▓░░ 1 of 3                ← checklist: add, check, rename, reorder, remove
 *   Day       🐾 Today · Change · No day   ← paw promise or someday
 *   Milestone [Learn verse 3] [Play it all the way through] [None]
 *   Length    5 · 10 · 15 · 30 · 45 min
 *   Note
 *   Work on it with Rusty · Delete step
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { suggestSteps } from '@/ai/rusty';
import { ofCount } from '@/copy';
import { Icon } from '@/components/Icon';
import { MilestoneReady } from '@/components/MilestoneReady';
import { Sheet } from '@/components/Sheet';
import { dueAtOf, WhenField, whenSummary, type When } from '@/components/WhenField';
import { Button, Chip, ChipRow, Eyebrow, Field, IconButton, ProgressBar, Row, T, tap } from '@/components/ui';
import {
  addSubstep,
  deleteStep,
  moveStepToMilestone,
  moveSubstep,
  promiseStep,
  removeSubstep,
  renameSubstep,
  toggleStep,
  toggleSubstep,
  unschedule,
  updateTask,
} from '@/data/actions';
import { milestonesOf, substepCount } from '@/data/selectors';
import { showToast, useDerived, useStore } from '@/data/store';
import type { Substep, Task } from '@/data/types';
import { startOfDay, whenLabel } from '@/lib/time';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { doneLabel } from '@/components/StepRow';


export default function StepSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useStore((s) => s.tasks[id]);
  const hobby = useStore((s) => (task?.hobbyId ? s.hobbies[task.hobbyId] : undefined));
  const milestones = useDerived((s) => (task?.hobbyId ? milestonesOf(s, task.hobbyId) : []), [task?.hobbyId]);
  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [newSub, setNewSub] = useState('');
  const [askMilestone, setAskMilestone] = useState(false);
  const [ideas, setIdeas] = useState<string[] | null | 'loading'>(null);

  if (!task || task.deletedAt) {
    return (
      <Sheet title="Step">
        <T v="callout">This step isn’t here anymore.</T>
      </Sheet>
    );
  }

  const done = task.status === 'done';
  const subs = task.substeps ?? [];
  const subCount = substepCount(task);
  const milestone = task.milestoneId ? milestones.find((m) => m.id === task.milestoneId) : undefined;

  const markDone = () => {
    tap(done ? 'light' : 'success');
    const r = toggleStep(task.id);
    setAskMilestone(!!r?.milestoneReady);
  };

  const breakDown = async () => {
    if (!hobby) return;
    setIdeas('loading');
    const res = await suggestSteps(hobby, milestone?.title ?? hobby.goal ?? hobby.name, task.title);
    setIdeas(res.map((r) => r.title));
  };

  return (
    <Sheet title={undefined}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
        {/* where this step lives */}
        <View style={{ gap: space.xs }}>
          <Eyebrow>{[hobby?.name, milestone?.title].filter(Boolean).join(' · ') || 'Step'}</Eyebrow>
          <TextInput
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (t.trim()) updateTask(task.id, { title: t.trim() });
            }}
            onBlur={() => !title.trim() && setTitle(task.title)}
            multiline
            submitBehavior="blurAndSubmit"
            accessibilityLabel="Step name"
            style={styles.title}
          />
        </View>

        {/* done / undo */}
        {done ? (
          <Row style={styles.doneBanner}>
            <View style={styles.doneDot}>
              <Icon name="check" size={16} color={colors.white} strokeWidth={3} />
            </View>
            <T v="headline" color={colors.successText} style={{ flex: 1 }}>
              {task.doneAt ? doneLabel(task.doneAt) : 'Done'}
            </T>
            <Button full={false} small variant="secondary" onPress={markDone}>
              Undo
            </Button>
          </Row>
        ) : (
          <Button icon="check" onPress={markDone}>
            {subCount.total > 0 && subCount.done === subCount.total ? 'All substeps done · Mark step done' : 'Mark step done'}
          </Button>
        )}
        {askMilestone && milestone && (
          <MilestoneReady
            milestoneId={milestone.id}
            onAddStep={() => {
              setAskMilestone(false);
              router.back();
            }}
          />
        )}

        {/* substeps */}
        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="title2" accessibilityRole="header">
              Substeps
            </T>
            {subCount.total > 0 && <T v="caption">{ofCount(subCount, 'substep')}</T>}
          </Row>
          {subCount.total > 0 && <ProgressBar done={subCount.done} total={subCount.total} />}
          {subs.map((x, i) => (
            <SubstepRow key={x.id} taskId={task.id} sub={x} first={i === 0} last={i === subs.length - 1} />
          ))}
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                value={newSub}
                onChangeText={setNewSub}
                placeholder="+ Add a substep"
                onSubmitEditing={() => {
                  addSubstep(task.id, newSub);
                  setNewSub('');
                }}
                submitBehavior="submit"
                returnKeyType="done"
                accessibilityLabel="New substep"
              />
            </View>
            <IconButton
              name="plus"
              label="Add substep"
              bg={colors.muted}
              color={colors.actionText}
              onPress={() => {
                addSubstep(task.id, newSub);
                setNewSub('');
              }}
            />
          </Row>
          {ideas === null ? (
            subs.length === 0 && hobby ? (
              <Button variant="tertiary" small icon="sparkle" onPress={breakDown}>
                Break it down with Rusty
              </Button>
            ) : null
          ) : ideas === 'loading' ? (
            <T v="caption">Rusty is thinking…</T>
          ) : (
            <View style={{ gap: space.xs }}>
              <T v="caption">Tap to add as substeps:</T>
              <ChipRow>
                {ideas.map((t) => (
                  <Chip
                    key={t}
                    onPress={() => {
                      addSubstep(task.id, t);
                      setIdeas((cur) => (Array.isArray(cur) ? cur.filter((x) => x !== t) : cur));
                    }}
                  >
                    {`+ ${t}`}
                  </Chip>
                ))}
              </ChipRow>
            </View>
          )}
        </View>

        {/* its own little card: promise to work on it (day, time, how long) */}
        {!done && <PromiseCard task={task} />}

        {/* milestone */}
        {milestones.length > 0 && (
          <View style={{ gap: space.sm }}>
            <T v="title2" accessibilityRole="header">
              Milestone
            </T>
            <ChipRow>
              {milestones.map((m) => (
                <Chip key={m.id} selected={task.milestoneId === m.id} onPress={() => moveStepToMilestone(task.id, m.id)}>
                  {m.doneAt ? `✓ ${m.title}` : m.title}
                </Chip>
              ))}
              <Chip selected={!milestone} onPress={() => moveStepToMilestone(task.id, null)}>
                None
              </Chip>
            </ChipRow>
          </View>
        )}

        <Field
          label="Note"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            updateTask(task.id, { note: t.trim() || null });
          }}
          placeholder="Anything to remember…"
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top', paddingTop: space.md }}
        />

        <View style={{ gap: space.xs }}>
          {!done && (
            <Button
              variant="secondary"
              icon="clock"
              onPress={() => {
                router.back();
                router.push({ pathname: '/focus/setup', params: { taskId: task.id, hobbyId: task.hobbyId ?? '' } });
              }}
            >
              Work on it with Rusty
            </Button>
          )}
          <Button
            variant="tertiary"
            small
            icon="trash"
            onPress={() => {
              router.back();
              deleteStep(task.id);
            }}
          >
            Delete step
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

function SubstepRow({ taskId, sub, first, last }: { taskId: string; sub: Substep; first: boolean; last: boolean }) {
  const [text, setText] = useState(sub.title);
  return (
    <Row gap={space.sm}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: sub.done }}
        accessibilityLabel={sub.title}
        hitSlop={10}
        onPress={() => {
          tap(sub.done ? 'light' : 'success');
          toggleSubstep(taskId, sub.id);
        }}
        style={[styles.subBox, sub.done && { backgroundColor: colors.done, borderColor: colors.done }]}
      >
        {sub.done && <Icon name="check" size={14} color={colors.white} strokeWidth={3} />}
      </Pressable>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (t.trim()) renameSubstep(taskId, sub.id, t.trim());
        }}
        onBlur={() => !text.trim() && setText(sub.title)}
        accessibilityLabel="Substep name"
        style={[styles.subInput, sub.done && { textDecorationLine: 'line-through', color: colors.inkSoft }]}
      />
      {!first && <IconButton name="up" label={`Move ${sub.title} up`} size={32} onPress={() => moveSubstep(taskId, sub.id, -1)} />}
      {!last && <IconButton name="down" label={`Move ${sub.title} down`} size={32} onPress={() => moveSubstep(taskId, sub.id, 1)} />}
      <IconButton name="trash" label={`Remove ${sub.title}`} size={32} onPress={() => removeSubstep(taskId, sub.id)} />
    </Row>
  );
}

/**
 * "Promise to work on it": a step with a day is a paw promise (Rusty checks in
 * then). Collapsed it says what's promised; open it to pick a day on the
 * calendar, a time on the wheel and about how long.
 */
function PromiseCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const [when, setWhen] = useState<When>(() => ({
    day: due ? startOfDay(due) : startOfDay(),
    time: due && task.timed ? { h: due.getHours(), m: due.getMinutes() } : null,
    minutes: task.minutes ?? 15,
  }));
  const save = () => {
    const d = dueAtOf(when);
    if (!d) return;
    promiseStep(task.id, d, !!when.time, when.minutes);
    showToast(`🐾 Promised · ${whenSummary(when)}`);
    setOpen(false);
  };
  return (
    <View style={styles.promise}>
      <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
        <Icon name="paw" size={22} color={colors.accent} />
        <View style={{ flex: 1, gap: space.xs }}>
          <T v="headline">{task.dueAt ? `Promised for ${whenLabel(task.dueAt, task.timed)}` : 'Promise to work on it'}</T>
          <T v="caption">
            {task.dueAt
              ? `${task.minutes ? `About ${task.minutes} min. ` : ''}Rusty will check in then.`
              : 'Pick a day and Rusty will check in then. No pressure if plans change.'}
          </T>
        </View>
      </Row>
      {open ? (
        <View style={{ gap: space.md }}>
          <WhenField value={when} onChange={setWhen} askLength />
          <Button variant="paw" onPress={save}>
            {`Promise · ${whenSummary(when)}`}
          </Button>
          <Button variant="tertiary" small onPress={() => setOpen(false)}>
            Cancel
          </Button>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button variant={task.dueAt ? 'secondary' : 'paw'} small onPress={() => setOpen(true)}>
            {task.dueAt ? 'Change day or time' : 'Promise a day'}
          </Button>
          {task.dueAt && (
            <Button
              variant="tertiary"
              small
              onPress={() => {
                const before = { dueAt: task.dueAt, timed: task.timed };
                unschedule(task.id);
                showToast('Day removed. It’s a someday step now.', () => updateTask(task.id, before));
              }}
            >
              Remove the day
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  promise: { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: '#FFF4EA', borderWidth: 1, borderColor: '#F6DCC6' },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    backgroundColor: colors.muted,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  doneBanner: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.input,
    padding: space.md,
    gap: space.md,
  },
  doneDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.done, alignItems: 'center', justifyContent: 'center' },
  subBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D9C2A7', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  subInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
