/** Small confirmation pill ("Step done."), with Undo when the action can be undone. */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { runToastUndo, useStore } from '@/data/store';
import { colors, radius, shadows, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './ui';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(200)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[s.toast, { marginBottom: insets.bottom + 92 }]}
      >
        <View style={s.check}>
          <Icon name="check" size={16} color={colors.white} strokeWidth={3} />
        </View>
        <T v="headline" color="#FFFAF2" style={{ flex: 1 }}>
          {toast.text}
        </T>
        {toast.undo && (
          <Pressable
            onPress={runToastUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            hitSlop={12}
            style={({ pressed }) => [s.undo, pressed && { opacity: 0.7 }]}
          >
            <T v="headline" color="#FFD2B8">
              Undo
            </T>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  toast: {
    marginHorizontal: space.lg + 6,
    backgroundColor: colors.toast,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
    maxWidth: 520,
    ...shadows.float,
  },
  undo: { paddingHorizontal: 10, minHeight: 36, justifyContent: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: '#FFD2B8' },
  check: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.done, alignItems: 'center', justifyContent: 'center' },
});
