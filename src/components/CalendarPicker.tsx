/**
 * A month calendar for picking a day. Big 40pt day targets, today ringed,
 * the picked day filled, past days dimmed (when `min` is set), and an
 * optional dot on days that already have something planned.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, dayKey, isSameDay, startOfDay } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T, tap } from './ui';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarPicker({
  value,
  onChange,
  min,
  marks,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  /** days before this are dimmed and can't be picked */
  min?: Date;
  /** dayKey → how many things are planned that day (shows a dot) */
  marks?: Record<string, number>;
}) {
  const [month, setMonth] = useState(() => {
    const d = startOfDay(value ?? new Date());
    d.setDate(1);
    return d;
  });
  const first = new Date(month);
  const start = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  // drop a last row that's entirely next month
  const rows = cells.slice(35).every((d) => d.getMonth() !== month.getMonth()) ? 5 : 6;
  const today = new Date();
  const floor = min ? startOfDay(min) : null;
  const shift = (n: number) => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + n);
    setMonth(d);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shift(-1)} hitSlop={8} style={styles.arrow}>
          <Icon name="back" size={20} color={colors.actionText} />
        </Pressable>
        <T v="headline" accessibilityRole="header">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} hitSlop={8} style={styles.arrow}>
          <Icon name="right" size={20} color={colors.actionText} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEK.map((w, i) => (
          <T key={i} v="caption" style={styles.weekday}>
            {w}
          </T>
        ))}
      </View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const past = !!floor && d < floor;
            const picked = !!value && isSameDay(d, value);
            const isToday = isSameDay(d, today);
            const n = marks?.[dayKey(d)] ?? 0;
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ selected: picked, disabled: past }}
                accessibilityLabel={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${n ? `, ${n} planned` : ''}`}
                disabled={past}
                onPress={() => {
                  tap();
                  onChange(d);
                }}
                style={styles.cellWrap}
              >
                <View style={[styles.cell, isToday && styles.today, picked && styles.picked]}>
                  <T v="label" color={picked ? colors.white : !inMonth || past ? '#CDB8A8' : colors.ink}>
                    {d.getDate()}
                  </T>
                </View>
                <View style={[styles.dot, { opacity: n && !picked ? 1 : 0 }]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cellWrap: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  cell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: colors.action },
  picked: { backgroundColor: colors.action },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.actionText, marginTop: 1 },
});
