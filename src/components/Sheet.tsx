/**
 * Bottom sheet over a scrim. Used by routes presented as transparent modals
 * (Rusty's menu, Log, Time's up) so they look identical on iOS, Android, web.
 */
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme/tokens';

import { IconButton, T } from './ui';

export function Sheet({
  children,
  title,
  onClose,
  dismissable = true,
  center,
}: {
  children: ReactNode;
  title?: string;
  onClose?: () => void;
  /** tapping the scrim closes it */
  dismissable?: boolean;
  /** centered modal card instead of a bottom sheet */
  center?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(60);
  const o = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    o.value = withTiming(1, { duration: 200 });
  }, [o, y]);
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={dismissable ? close : undefined}
        />
      </Animated.View>
      <View style={[{ flex: 1 }, center ? s.centerWrap : s.bottomWrap]} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[
            center ? s.modal : s.sheet,
            !center && { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm },
            sheetStyle,
          ]}
        >
          {!center && <View style={s.handle} />}
          {title || dismissable ? (
            <View style={s.head}>
              {title ? (
                <T v="title1" style={{ flex: 1 }} accessibilityRole="header">
                  {title}
                </T>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {dismissable && <IconButton name="close" label="Close" onPress={close} size={36} />}
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bottomWrap: { justifyContent: 'flex-end' },
  centerWrap: { justifyContent: 'center', padding: space.lg },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
