/**
 * "When?" for a promise or a to-do, in three short rows:
 *   Day    Today · Tomorrow · This weekend · 📅 a calendar for any other day
 *   Time   Any time · ⏰ a time wheel
 *   Length (optional) "About how long?" → a minutes wheel
 * The common answers are one tap; anything else is one more tap away and
 * never a tiny native date picker.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, isSameDay, resolveWhen, startOfDay, timeLabel } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';

import { CalendarPicker } from './CalendarPicker';
import { Icon } from './Icon';
import { Chip, ChipRow, Eyebrow, T, tap } from './ui';
import { WheelPicker } from './WheelPicker';

export interface When {
  /** null = no day yet ("someday") */
  day: Date | null;
  /** null = any time that day */
  time: { h: number; m: number } | null;
  /** about how long, in minutes (null = not asked) */
  minutes: number | null;
}

const TIMES = Array.from({ length: (24 - 6) * 4 }, (_, i) => {
  const h = 6 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return { label: timeLabel(d), value: h * 60 + m };
});
const LENGTHS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => ({ label: m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`.replace('1.5 hrs', '1½ hrs'), value: m }));

/** The moment it's due: the day at its time, or evening when it's "any time". */
export function dueAtOf(w: When): Date | null {
  if (!w.day) return null;
  const d = new Date(w.day);
  if (w.time) d.setHours(w.time.h, w.time.m, 0, 0);
  else d.setHours(20, 0, 0, 0);
  return d;
}

/** "Tomorrow · 7:30 PM · 15 min" */
export function whenSummary(w: When): string {
  const parts: string[] = [];
  if (!w.day) parts.push('No day yet');
  else {
    const n = Math.round((startOfDay(w.day).getTime() - startOfDay().getTime()) / 86_400_000);
    parts.push(n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : w.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  }
  const due = dueAtOf(w);
  if (w.time && due) parts.push(timeLabel(due));
  if (w.minutes) parts.push(LENGTHS.find((l) => l.value === w.minutes)?.label ?? `${w.minutes} min`);
  return parts.join(' · ');
}

/** A sensible first time: the next quarter hour at least an hour from now, else 7 PM. */
function nextTime(day: Date | null) {
  const n = new Date();
  if (day && isSameDay(day, n)) {
    const t = n.getHours() * 60 + n.getMinutes() + 60;
    const q = Math.min(23 * 60 + 45, Math.ceil(t / 15) * 15);
    return { h: Math.floor(q / 60), m: q % 60 };
  }
  return { h: 19, m: 0 };
}

export function WhenField({
  value,
  onChange,
  allowSomeday,
  askLength,
  marks,
}: {
  value: When;
  onChange: (w: When) => void;
  /** offer "No day yet" (to-dos, steps) */
  allowSomeday?: boolean;
  /** show "About how long?" */
  askLength?: boolean;
  /** days that already have plans (dots on the calendar) */
  marks?: Record<string, number>;
}) {
  const [open, setOpen] = useState<'cal' | 'time' | 'length' | null>(null);
  const today = startOfDay();
  const quick = [
    { label: 'Today', day: today },
    { label: 'Tomorrow', day: addDays(today, 1) },
    { label: 'This weekend', day: startOfDay(resolveWhen('weekend')) },
  ];
  const isQuick = (d: Date | null) => !!d && quick.some((q) => isSameDay(q.day, d));
  const toggle = (k: typeof open) => {
    tap();
    setOpen((o) => (o === k ? null : k));
  };
  const minutesOf = (t: When['time']) => (t ? t.h * 60 + t.m : 19 * 60);

  return (
    <View style={{ gap: space.md }}>
      {/* Day */}
      <View style={{ gap: space.sm }}>
        <Eyebrow color={colors.inkSoft}>Day</Eyebrow>
        <ChipRow>
          {quick.map((q) => (
            <Chip
              key={q.label}
              selected={!!value.day && isSameDay(value.day, q.day)}
              onPress={() => {
                setOpen(null);
                onChange({ ...value, day: q.day });
              }}
            >
              {q.label}
            </Chip>
          ))}
          <Chip custom icon="calendar" selected={open === 'cal' || (!!value.day && !isQuick(value.day))} onPress={() => toggle('cal')}>
            {value.day && !isQuick(value.day) ? value.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pick a day'}
          </Chip>
          {allowSomeday && (
            <Chip
              selected={!value.day}
              onPress={() => {
                setOpen(null);
                onChange({ ...value, day: null, time: null });
              }}
            >
              No day yet
            </Chip>
          )}
        </ChipRow>
        {open === 'cal' && (
          <CalendarPicker
            value={value.day}
            min={today}
            marks={marks}
            onChange={(d) => {
              onChange({ ...value, day: d });
              setOpen(null);
            }}
          />
        )}
      </View>

      {/* Time */}
      {value.day && (
        <View style={{ gap: space.sm }}>
          <Eyebrow color={colors.inkSoft}>Time</Eyebrow>
          <ChipRow>
            <Chip
              selected={!value.time}
              onPress={() => {
                setOpen(null);
                onChange({ ...value, time: null });
              }}
            >
              Any time
            </Chip>
            <Chip
              custom
              icon="clock"
              selected={!!value.time}
              onPress={() => {
                if (!value.time) onChange({ ...value, time: nextTime(value.day) });
                toggle('time');
              }}
            >
              {value.time ? timeLabel(dueAtOf(value)!) : 'Set a time'}
            </Chip>
          </ChipRow>
          {open === 'time' && value.time && (
            <WheelPicker
              label="Time"
              items={TIMES}
              value={minutesOf(value.time)}
              onChange={(v) => onChange({ ...value, time: { h: Math.floor(v / 60), m: v % 60 } })}
            />
          )}
        </View>
      )}

      {/* About how long */}
      {askLength && (
        <View style={{ gap: space.sm }}>
          <Eyebrow color={colors.inkSoft}>About how long?</Eyebrow>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`About how long: ${value.minutes ? LENGTHS.find((l) => l.value === value.minutes)?.label : 'not set'}. Change`}
            onPress={() => {
              if (!value.minutes) onChange({ ...value, minutes: 15 });
              toggle('length');
            }}
            style={({ pressed }) => [styles.dropdown, pressed && { backgroundColor: colors.bubbleRusty }]}
          >
            <Icon name="clock" size={18} color={colors.actionText} />
            <T v="headline" style={{ flex: 1 }}>
              {value.minutes ? LENGTHS.find((l) => l.value === value.minutes)?.label : 'Pick a length'}
            </T>
            <Icon name={open === 'length' ? 'up' : 'down'} size={20} color={colors.inkSoft} />
          </Pressable>
          {open === 'length' && (
            <WheelPicker label="About how long" items={LENGTHS} value={value.minutes ?? 15} onChange={(v) => onChange({ ...value, minutes: v })} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    backgroundColor: colors.muted,
  },
});
