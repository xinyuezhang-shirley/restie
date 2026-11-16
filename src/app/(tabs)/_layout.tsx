import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_ITEMS, TabBarButton, tabStyles } from '@/components/BottomNav';
import { checkinOf } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import { useTutorialTarget } from '@/tutorial/tutorial';

export default function TabsLayout() {
  const onboarded = useStore((s) => !!s.profile.onboardedAt);
  const insets = useSafeAreaInsets();
  const { ref: tabsRef, onLayout: onTabsLayout } = useTutorialTarget('tabs');
  const checkinDue = useDerived((s) => !!checkinOf(s));
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      {/* TabList must be a direct child of Tabs: expo-router finds the
          triggers by walking Tabs → TabList → TabTrigger, and a wrapper
          View hides them (every tab press then silently does nothing).
          Pages pushed on top render the same bar via <BottomNav />. */}
      <TabList
        accessibilityRole="tablist"
        style={StyleSheet.flatten([tabStyles.bar, { paddingBottom: Math.max(insets.bottom, 10) }])}
      >
        {/* invisible measuring box for the tour's spotlight */}
        <View ref={tabsRef} onLayout={onTabsLayout} pointerEvents="none" style={StyleSheet.absoluteFill} />
        {TAB_ITEMS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabBarButton icon={t.icon} label={t.label} dot={t.name === 'hobbies' && checkinDue} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
