/**
 * One hobby step (or to-do) as a row:
 *   [✓]  Find chords for verse 3                     ›
 *        🐾 Today · 10 min · 1 of 3 substeps
 * The checkbox marks it done / undoes it (with an Undo toast). Tapping the
 * row opens the step to edit it, add substeps, change its day or milestone.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ofCount, plannedFor } from '@/copy';
import { toggleStep, type CompleteResult } from '@/data/actions';
import { substepCount } from '@/data/selectors';
import { useStore } from '@/data/store';
import type { Task } from '@/data/types';
import { ago, whenLabel } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { SubstepDots } from './Progress';
import { CHEVRON, T, Tag, tap } from './ui';

export function StepRow({
  task,
  showHobby,
  showMilestone,
  onOpen,
  onCompleted,
  flat,
  number,
}: {
  task: Task;
  showHobby?: boolean;
  showMilestone?: boolean;
  /** default: open the step sheet (hobby steps) */
  onOpen?: (t: Task) => void;
  /** after marking done (e.g. to ask "mark the milestone done?") */
  onCompleted?: (r: CompleteResult) => void;
  /** no card background (inside a milestone card) */
  flat?: boolean;
  /** its number in the milestone (matches the chunk of the milestone's bar) */
  number?: number;
}) {
  const hobby = useStore((s) => (task.hobbyId ? s.hobbies[task.hobbyId] : undefined));
  const milestone = useStore((s) => (task.milestoneId ? s.milestones[task.milestoneId] : undefined));
  const done = task.status === 'done';
  const subs = substepCount(task);

  const meta = [
    showHobby && hobby ? hobby.name : null,
    showMilestone && milestone && !milestone.deletedAt ? milestone.title : null,
    task.dueAt ? (task.kind === 'promise' ? plannedFor(task.dueAt, task.timed) : `Due ${whenLabel(task.dueAt).toLowerCase()}`) : task.kind === 'promise' ? 'No day yet' : 'Someday',
    task.minutes ? `${task.minutes} min` : null,
    subs.total && !flat ? ofCount(subs, 'substep') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const toggle = () => {
    tap(done ? 'light' : 'success');
    const r = toggleStep(task.id);
    if (r) onCompleted?.(r);
  };
  const open = () => (onOpen ? onOpen(task) : router.push(`/step/${task.id}`));

  return (
    <View style={[styles.row, flat && styles.flat, done && { opacity: 0.72 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${task.title}. ${meta}`}
        accessibilityHint={done ? 'Marks it not done' : 'Marks it done'}
        onPress={toggle}
        hitSlop={10}
        style={[styles.box, done && { backgroundColor: colors.done, borderColor: colors.done }]}
      >
        {done && <Icon name="check" size={16} color={colors.white} strokeWidth={3} />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [{ flex: 1, gap: space.xs, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.6 }]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Open ${task.title}`}
        accessibilityHint="Edit, add substeps or change the day"
      >
        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            {number != null && (
              <View style={[styles.num, done && { backgroundColor: colors.successSurface }]}>
                <T v="label" style={{ fontSize: 13, lineHeight: 16 }} color={done ? colors.successText : colors.actionText}>
                  {number}
                </T>
              </View>
            )}
            <T v="headline" style={[{ flex: 1 }, done ? { textDecorationLine: 'line-through' } : null]}>
              {task.title}
            </T>
          </View>
          {/* its substeps as little circles of progress */}
          {flat && !done && <SubstepDots subs={task.substeps ?? []} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <T v="caption">{done && task.doneAt ? doneLabel(task.doneAt) : meta}</T>
            {task.priority === 'high' && !done ? <Tag color="#FFD9C7">Important</Tag> : null}
          </View>
        </View>
        <Icon name="right" size={CHEVRON} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

/** "Done today", "Done 3 days ago", "Done Sep 19" */
export function doneLabel(iso: string) {
  const a = ago(iso);
  return `Done ${/^[A-Z][a-z]{2} \d/.test(a) ? a : a.toLowerCase()}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 60,
  },
  flat: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: space.sm, minHeight: 52 },
  num: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE8D9', marginTop: 1 },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D9C2A7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
