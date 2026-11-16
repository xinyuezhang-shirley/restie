/**
 * Progress you can read at a glance, without reading text:
 *   SegmentBar   a milestone as a bar made of its steps: one chunk per step,
 *                green when done, partly filled while its substeps are under
 *                way. Numbered chunks match the numbered steps below.
 *   SubstepDots  a step's substeps as little circles (filled = done).
 */
import { StyleSheet, View } from 'react-native';

import type { Substep, Task } from '@/data/types';
import { colors, space } from '@/theme/tokens';

import { T } from './ui';

/** How far along one step is: 1 when done, else its share of substeps done. */
export function stepFill(t: Task): number {
  if (t.status === 'done') return 1;
  const subs = t.substeps ?? [];
  return subs.length ? subs.filter((s) => s.done).length / subs.length : 0;
}

export function SegmentBar({
  steps,
  numbered,
  height = 12,
  label,
}: {
  steps: Task[];
  /** show step numbers under the chunks (when the steps are listed below) */
  numbered?: boolean;
  height?: number;
  /** what screen readers hear, e.g. "Learn verse 3: 2 of 4 steps done" */
  label: string;
}) {
  if (steps.length === 0) {
    return <View style={[styles.empty, { height }]} accessibilityLabel={`${label}. No steps yet`} />;
  }
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: 3 }}>
      <View style={styles.row}>
        {steps.map((t) => {
          const f = stepFill(t);
          const done = t.status === 'done';
          return (
            <View key={t.id} style={[styles.seg, { height, borderRadius: height / 2 }]}>
              {f > 0 && (
                <View
                  style={{
                    width: `${Math.max(f, 0.08) * 100}%`,
                    height,
                    borderRadius: height / 2,
                    backgroundColor: done ? colors.done : colors.action,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      {numbered && (
        <View style={styles.row}>
          {steps.map((t, i) => (
            <T key={t.id} v="caption" style={{ flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 14 }} color={t.status === 'done' ? colors.successText : colors.inkSoft}>
              {i + 1}
            </T>
          ))}
        </View>
      )}
    </View>
  );
}

export function SubstepDots({ subs }: { subs: Substep[] }) {
  if (!subs.length) return null;
  const shown = subs.slice(0, 10);
  const done = subs.filter((s) => s.done).length;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} of ${subs.length} substeps done`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      {shown.map((s) => (
        <View key={s.id} style={[styles.dot, s.done && styles.dotDone]} />
      ))}
      {subs.length > shown.length && (
        <T v="caption" style={{ fontSize: 11 }}>
          +{subs.length - shown.length}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, backgroundColor: '#F3E2CE', overflow: 'hidden' },
  empty: { borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E7D2BC' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#D9C2A7', backgroundColor: colors.card },
  dotDone: { backgroundColor: colors.done, borderColor: colors.done },
});

export const PROGRESS_GAP = space.xs;
