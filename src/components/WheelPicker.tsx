/**
 * A scroll wheel (like the iOS time picker): spin it, it snaps to an item;
 * or tap an item. The picked item sits in the highlighted middle band.
 * Works the same on iOS, Android and web (no native module).
 */
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { colors, radius } from '@/theme/tokens';

import { T, tap } from './ui';

const ROW = 40;
const VISIBLE = 5;

export function WheelPicker<V extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: { label: string; value: V }[];
  value: V;
  onChange: (v: V) => void;
  /** for screen readers: what's being picked */
  label: string;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const index = Math.max(0, items.findIndex((i) => i.value === value));
  const lastSent = useRef(index);

  // Start on the current value (and follow it if it changes from outside).
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: index * ROW, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(settle.current), []);

  const pickAt = (y: number) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(y / ROW)));
    if (i !== lastSent.current) {
      lastSent.current = i;
      tap();
      onChange(items[i].value);
    }
    return i;
  };
  // When the wheel stops (momentum events don't fire on web), snap and pick.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const i = pickAt(y);
      if (Math.abs(y - i * ROW) > 1) ref.current?.scrollTo({ y: i * ROW, animated: true });
    }, 120);
  };

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const i = Math.min(items.length - 1, Math.max(0, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
        onChange(items[i].value);
        ref.current?.scrollTo({ y: i * ROW, animated: true });
      }}
    >
      <View pointerEvents="none" style={styles.band} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingVertical: ROW * ((VISIBLE - 1) / 2) }}
      >
        {items.map((it, i) => (
          <Pressable
            key={String(it.value)}
            onPress={() => {
              lastSent.current = i;
              tap();
              onChange(it.value);
              ref.current?.scrollTo({ y: i * ROW, animated: true });
            }}
            style={styles.row}
          >
            <T v={i === index ? 'headline' : 'callout'} color={i === index ? colors.ink : colors.inkSoft}>
              {it.label}
            </T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: ROW * VISIBLE, overflow: 'hidden', borderRadius: radius.input, backgroundColor: colors.muted },
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: ROW * ((VISIBLE - 1) / 2),
    height: ROW,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
});
