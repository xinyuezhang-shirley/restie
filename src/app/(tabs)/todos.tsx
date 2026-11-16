/**
 * To-dos, by day.
 *
 *   ‹  Today is Sunday, Nov 15 · 5 things  ›     ← tap the date for a calendar
 *   [ Day | Week | Month ]
 *
 * Day:   that day's 🐾 paw promises and everyday to-dos (on today, anything
 *        late comes along under "From earlier"), "+ Promise" / "+ To-do" for
 *        that day, Rusty's "this can wait" suggestion, and "No day yet".
 * Week:  the seven days at a glance; tap one to open it.
 * Month: a calendar with a dot on busy days; tap one to open it.
 *
 * Paw promises and to-dos stay in separate sections (as in Mycoto). Rusty
 * only ever suggests moving an everyday to-do, never a paw promise.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { CalendarPicker } from '@/components/CalendarPicker';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { StepRow } from '@/components/StepRow';
import { Button, Card, Chip, ChipRow, Eyebrow, Field, NavBar, Row, RustyAvatar, Screen, T, tap } from '@/components/ui';
import { dueAtOf, WhenField, type When } from '@/components/WhenField';
import { addTodo, decideSkip, deleteStep, updateTask } from '@/data/actions';
import { openTasks, skipSuggestionOf } from '@/data/selectors';
import { alive, showToast, useDerived } from '@/data/store';
import type { Task } from '@/data/types';
import { addDays, dayKey, isSameDay, startOfDay } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';

type Mode = 'day' | 'week' | 'month';
type Editing = Task | { new: true; day: Date } | null;

const DOW = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });
const MDAY = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const things = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`;

export default function Todos() {
  const open = useDerived(openTasks);
  const skip = useDerived(skipSuggestionOf);
  const done = useDerived((s) => alive(s.tasks).filter((t) => t.status === 'done' && t.doneAt));
  const [day, setDay] = useState(() => startOfDay());
  const [mode, setMode] = useState<Mode>('day');
  const [cal, setCal] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

  const today = startOfDay();
  const isToday = isSameDay(day, today);
  const onDay = (d: Date) => open.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), d));
  const late = open.filter((t) => t.dueAt && new Date(t.dueAt) < today);
  const someday = open.filter((t) => !t.dueAt && t.kind === 'todo');
  const counts: Record<string, number> = {};
  for (const t of open) if (t.dueAt) counts[dayKey(new Date(t.dueAt))] = (counts[dayKey(new Date(t.dueAt))] ?? 0) + 1;

  const list = [...(isToday ? late : []), ...onDay(day)];
  const promises = list.filter((t) => t.kind === 'promise');
  const todos = list.filter((t) => t.kind === 'todo');
  const doneThatDay = done.filter((t) => isSameDay(new Date(t.doneAt!), day));
  const go = (d: Date) => {
    setDay(startOfDay(d));
    setMode('day');
    setCal(false);
  };
  const dayName = isToday ? 'today' : DOW(day);
  const dayTitle = isToday
    ? `Today is ${DOW(day)}, ${MDAY(day)}`
    : isSameDay(day, addDays(today, 1))
      ? `Tomorrow, ${DOW(day)} ${MDAY(day)}`
      : `${DOW(day)}, ${MDAY(day)}`;

  return (
    // Every page has a way back (to Home, where everything starts).
    <Screen nav={<NavBar backLabel="Home" onBack={() => router.navigate('/')} />}>
      <T v="display" accessibilityRole="header">
        To-dos
      </T>

      {/* the day you're looking at; tap it for a calendar */}
      <View style={{ gap: space.sm }}>
        <Row gap={space.xs}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => go(addDays(day, -1))} hitSlop={8} style={styles.arrow}>
            <Icon name="back" size={22} color={colors.actionText} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${dayTitle}, ${things(list.length)}. Pick another day`}
            onPress={() => {
              tap();
              setCal((c) => !c);
            }}
            style={({ pressed }) => [styles.dateBtn, pressed && { backgroundColor: colors.muted }]}
          >
            <T v="title2" numberOfLines={1}>
              {dayTitle}
            </T>
            <Row gap={space.xs}>
              <T v="caption">{things(list.length)}</T>
              <Icon name="calendar" size={14} color={colors.inkSoft} />
            </Row>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => go(addDays(day, 1))} hitSlop={8} style={styles.arrow}>
            <Icon name="right" size={22} color={colors.actionText} />
          </Pressable>
        </Row>
        {cal && (
          <Card>
            <CalendarPicker value={day} onChange={go} marks={counts} />
          </Card>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={styles.segment} accessibilityRole="tablist">
            {(['day', 'week', 'month'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  tap();
                  setMode(m);
                  setCal(false);
                }}
                style={[styles.segBtn, mode === m && styles.segOn]}
              >
                <T v="label" color={mode === m ? colors.white : colors.ink}>
                  {m[0].toUpperCase() + m.slice(1)}
                </T>
              </Pressable>
            ))}
          </View>
          {!isToday && (
            <Chip onPress={() => go(today)} icon="back">
              Back to today
            </Chip>
          )}
        </Row>
      </View>

      {mode === 'week' && <Week day={day} onDay={onDay} onOpen={go} />}
      {mode === 'month' && (
        <Card>
          <CalendarPicker value={day} onChange={go} marks={counts} />
        </Card>
      )}

      {mode === 'day' && (
        <>
          {skip && isToday && (
            <Card style={{ gap: space.md, backgroundColor: '#FFF9F3' }}>
              <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                <RustyAvatar pose="think" size={56} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Eyebrow>Rusty’s suggestion</Eyebrow>
                  <T v="title2">You have a lot going on today.</T>
                  <T v="callout" color={colors.inkSoft}>
                    {skip.reason}
                  </T>
                </View>
              </Row>
              <View style={{ gap: space.sm }}>
                <Button small onPress={() => decideSkip(skip.task.id, 'later')}>
                  Move it to later
                </Button>
                <Button small variant="secondary" onPress={() => decideSkip(skip.task.id, 'keep')}>
                  Keep it today
                </Button>
                <Button variant="tertiary" small onPress={() => decideSkip(skip.task.id, 'let_go')}>
                  Let it go
                </Button>
              </View>
            </Card>
          )}

          {/* ---- 🐾 Paw promises ---- */}
          <Card style={[styles.section, { backgroundColor: '#FFF4EA' }]}>
            <Row gap={space.sm}>
              <Icon name="paw" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T v="title2" accessibilityRole="header">
                  Paw promises
                </T>
                <T v="caption">Hobby steps you promised Rusty</T>
              </View>
            </Row>
            {promises.length === 0 ? (
              <T v="callout" color={colors.inkSoft}>
                Nothing promised for {dayName}.
              </T>
            ) : (
              <Rows tasks={promises} today={isToday} onEdit={setEditing} />
            )}
            <Button variant="secondary" small icon="plus" onPress={() => router.push({ pathname: '/promise', params: { day: dayKey(day) } })}>
              {`Promise something for ${dayName}`}
            </Button>
          </Card>

          {/* ---- Everyday to-dos ---- */}
          <Card style={styles.section}>
            <View>
              <T v="title2" accessibilityRole="header">
                To-dos
              </T>
              <T v="caption">Everything else on your plate</T>
            </View>
            {todos.length === 0 ? (
              <T v="callout" color={colors.inkSoft}>
                Nothing here. Enjoy the quiet.
              </T>
            ) : (
              <Rows tasks={todos} today={isToday} onEdit={setEditing} />
            )}
            <Button variant="secondary" small icon="plus" onPress={() => setEditing({ new: true, day })}>
              {`Add a to-do for ${dayName}`}
            </Button>
          </Card>

          {someday.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Eyebrow color={colors.inkSoft}>No day yet</Eyebrow>
              {someday.map((t) => (
                <ListRow key={t.id} task={t} onEdit={setEditing} />
              ))}
            </View>
          )}

          {doneThatDay.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Eyebrow color={colors.successText}>Done {isToday ? 'today' : `on ${DOW(day)}`}</Eyebrow>
              {doneThatDay.map((t) => (
                <ListRow key={t.id} task={t} onEdit={setEditing} />
              ))}
            </View>
          )}
        </>
      )}

      <Modal visible={editing !== null} transparent animationType="none" onRequestClose={() => setEditing(null)}>
        {editing !== null && (
          <TodoEditor task={'new' in editing ? null : editing} day={'new' in editing ? editing.day : null} onClose={() => setEditing(null)} />
        )}
      </Modal>
    </Screen>
  );
}

/** A day's tasks; on today, late ones first under "From earlier". */
function Rows({ tasks, today, onEdit }: { tasks: Task[]; today: boolean; onEdit: (t: Task) => void }) {
  const start = startOfDay();
  const late = today ? tasks.filter((t) => t.dueAt && new Date(t.dueAt) < start) : [];
  const rest = tasks.filter((t) => !late.includes(t));
  return (
    <View style={{ gap: space.sm }}>
      {late.length > 0 && <Eyebrow color={colors.actionText}>From earlier</Eyebrow>}
      {late.map((t) => (
        <ListRow key={t.id} task={t} onEdit={onEdit} />
      ))}
      {late.length > 0 && rest.length > 0 && <Eyebrow color={colors.inkSoft}>Today</Eyebrow>}
      {rest.map((t) => (
        <ListRow key={t.id} task={t} onEdit={onEdit} />
      ))}
    </View>
  );
}

/** The week around the picked day: one row per day with what's on it. */
function Week({ day, onDay, onOpen }: { day: Date; onDay: (d: Date) => Task[]; onOpen: (d: Date) => void }) {
  const start = addDays(day, -day.getDay());
  const today = startOfDay();
  return (
    <Card style={{ gap: 0, paddingVertical: space.sm }}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const items = onDay(d);
        const isToday = isSameDay(d, today);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${DOW(d)} ${MDAY(d)}, ${things(items.length)}. Open this day`}
            onPress={() => onOpen(d)}
            style={({ pressed }) => [styles.weekRow, i > 0 && styles.weekDivider, pressed && { backgroundColor: colors.muted }]}
          >
            <View style={[styles.weekDate, isToday && { backgroundColor: colors.action }]}>
              <T v="caption" color={isToday ? colors.white : colors.inkSoft}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </T>
              <T v="headline" color={isToday ? colors.white : colors.ink}>
                {d.getDate()}
              </T>
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              {items.length === 0 ? (
                <T v="caption">Free</T>
              ) : (
                items.slice(0, 3).map((t) => (
                  <Row key={t.id} gap={space.xs}>
                    {t.kind === 'promise' ? <Icon name="paw" size={13} color={colors.accent} /> : <View style={styles.todoDot} />}
                    <T v="callout" numberOfLines={1} style={{ flex: 1 }}>
                      {t.title}
                    </T>
                  </Row>
                ))
              )}
              {items.length > 3 && <T v="caption">+{items.length - 3} more</T>}
            </View>
            <Icon name="right" size={20} color={colors.inkSoft} />
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Hobby steps open the step page; to-dos open the to-do editor. */
function ListRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  return (
    <StepRow
      task={task}
      showHobby
      onOpen={task.kind === 'todo' ? onEdit : undefined}
      onCompleted={(r) => {
        if (r.milestoneReady) router.push({ pathname: '/log-success', params: { taskId: task.id } });
      }}
    />
  );
}

/** Add or edit an everyday to-do: what, when (calendar + time wheel), how important. */
function TodoEditor({ task, day, onClose }: { task: Task | null; day: Date | null; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'normal');
  const [when, setWhen] = useState<When>(() => {
    const due = task?.dueAt ? new Date(task.dueAt) : null;
    return {
      day: task ? (due ? startOfDay(due) : null) : (day ?? startOfDay()),
      time: due && task?.timed ? { h: due.getHours(), m: due.getMinutes() } : null,
      minutes: null,
    };
  });

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const dueAt = dueAtOf(when);
    if (!task) {
      addTodo(t, dueAt, priority, !!when.time);
      showToast('Added.');
    } else updateTask(task.id, { title: t, priority, dueAt: dueAt?.toISOString() ?? null, timed: !!when.time });
    onClose();
  };

  return (
    <Sheet title={task ? 'Edit to-do' : 'Add a to-do'} onClose={onClose}>
      <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="e.g. Problem set 6" autoFocus={!task} returnKeyType="done" onSubmitEditing={save} />
      <WhenField value={when} onChange={setWhen} allowSomeday />
      <Eyebrow color={colors.inkSoft}>How important?</Eyebrow>
      <ChipRow>
        {(['low', 'normal', 'high'] as const).map((p) => (
          <Chip key={p} selected={priority === p} onPress={() => setPriority(p)}>
            {p === 'low' ? 'Can wait' : p === 'normal' ? 'Normal' : 'Important'}
          </Chip>
        ))}
      </ChipRow>
      <Button onPress={save} disabled={!title.trim()}>
        {task ? 'Save changes' : 'Add to-do'}
      </Button>
      {task && (
        <Button
          variant="tertiary"
          small
          icon="trash"
          onPress={() => {
            deleteStep(task.id);
            onClose();
          }}
        >
          Delete this to-do
        </Button>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  arrow: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateBtn: { flex: 1, alignItems: 'center', paddingVertical: space.xs, borderRadius: radius.input, gap: space.xs },
  segment: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.pill, padding: 3 },
  segBtn: { paddingHorizontal: space.lg, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill },
  segOn: { backgroundColor: colors.action },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 56 },
  weekDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  weekDate: { width: 48, alignItems: 'center', paddingVertical: 2, borderRadius: 12 },
  todoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.notePurple, marginHorizontal: 2.5 },
});
