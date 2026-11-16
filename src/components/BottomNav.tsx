/**
 * The bottom navigation, shared by the tab bar (src/app/(tabs)/_layout.tsx)
 * and every full page pushed on top of it (hobby page, settings, chat…), so
 * Home · Hobbies · To-dos · Keepsakes is always one tap away.
 *
 * Not shown on: onboarding (no app yet), the camera viewfinder and the focus
 * timer (full-screen modes with their own exit), and sheets (they float over
 * a page that already has it).
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { forwardRef, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkinOf } from '@/data/selectors';
import { useDerived } from '@/data/store';
import { colors, fonts, shadows, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

export type TabKey = 'index' | 'hobbies' | 'todos' | 'keepsakes';

export const TAB_ITEMS: { name: TabKey; href: '/' | '/hobbies' | '/todos' | '/keepsakes'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'hobbies', href: '/hobbies', label: 'Hobbies', icon: 'hobbies' },
  { name: 'todos', href: '/todos', label: 'To-dos', icon: 'todos' },
  { name: 'keepsakes', href: '/keepsakes', label: 'Keepsakes', icon: 'keepsakes' },
];

const buzz = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
};

/** One tab: icon + label, orange when it's the section you're in. */
export const TabBarButton = forwardRef<
  ComponentRef<typeof Pressable>,
  PressableProps & { icon: IconName; label: string; dot?: boolean; isFocused?: boolean }
>(function TabBarButton({ icon, label, dot, isFocused, onPress, ...rest }, ref) {
  const color = isFocused ? colors.action : colors.inkSoft;
  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(e) => {
        buzz();
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={dot ? `${label}, Rusty has a check-in` : label}
      style={tabStyles.tab}
    >
      <View>
        <Icon name={icon} color={color} />
        {dot && <View style={tabStyles.dot} />}
      </View>
      <Text style={[tabStyles.label, { color }]}>{label}</Text>
    </Pressable>
  );
});

/** For pages pushed on top of the tabs: jumps back to a tab from anywhere. */
export function BottomNav({ active }: { active: TabKey }) {
  const insets = useSafeAreaInsets();
  const checkinDue = useDerived((s) => !!checkinOf(s));
  return (
    <View accessibilityRole="tablist" style={[tabStyles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TAB_ITEMS.map((t) => (
        <TabBarButton
          key={t.name}
          icon={t.icon}
          label={t.label}
          dot={t.name === 'hobbies' && checkinDue}
          isFocused={t.name === active}
          onPress={() => {
            // Close the pages on top, then show the tab.
            if (router.canDismiss()) router.dismissAll();
            router.navigate(t.href);
          }}
        />
      ))}
    </View>
  );
}

export const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.whiteSoft,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    ...shadows.soft,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  dot: { position: 'absolute', right: -4, top: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.action, borderWidth: 1.5, borderColor: colors.whiteSoft },
});
