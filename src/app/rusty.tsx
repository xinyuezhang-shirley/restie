/**
 * Rusty's menu (hold Rusty, or tap his "!" / 💬 badge on Home).
 *
 * Talking comes first and looks like the main action (heuristic eval #50);
 * a due check-in sits below as a smaller "also" card instead of taking over
 * the menu (#42). "Something's not right?" lets people report a problem (#27).
 */
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CheckinCard } from '@/components/CheckinCard';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { noticedOf, notesOf } from '@/rusty/knows';
import { CHEVRON, Eyebrow, OptionRow, Row, RustyAvatar, T, tap } from '@/components/ui';
import { completeTask } from '@/data/actions';
import { checkinOf, skipSuggestionOf } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import { rustyBus } from '@/rusty/brain';
import { colors, radius, space } from '@/theme/tokens';

export default function RustySheet() {
  const checkin = useDerived(checkinOf);
  const skip = useDerived(skipSuggestionOf);
  const known = useDerived((s) => notesOf(s).length + noticedOf(s).length);
  const knowsMeta = known ? `${known} thing${known === 1 ? '' : 's'} he keeps in mind. See or fix them` : 'He learns as you chat and work together';
  const name = useStore((s) => s.profile.name);

  return (
    <Sheet>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
        <Row gap={space.md}>
          <RustyAvatar pose="wave" size={64} />
          <View style={{ flex: 1 }}>
            <T v="title1">Hi{name ? ` ${name}` : ''}!</T>
            <T v="callout" color={colors.inkSoft}>
              {skip ? 'Your day looks full. Want to look at what can wait?' : 'What should we do?'}
            </T>
          </View>
        </Row>

        {/* the main action */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Talk to Rusty. Get unstuck, plan, or just chat"
          onPress={() => {
            tap();
            router.replace('/chat');
          }}
          style={({ pressed }) => [styles.talk, pressed && { backgroundColor: '#FFD3BB' }]}
        >
          <View style={styles.talkIcon}>
            <Icon name="chat" color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="headline">Talk to Rusty</T>
            <T v="caption">Get unstuck, plan, or just chat</T>
          </View>
          <Icon name="right" size={CHEVRON} color={colors.actionText} />
        </Pressable>

        <OptionRow title="Log a step" meta="Mark something you did as done" onPress={() => router.replace('/log')} />
        <OptionRow title="Focus timer" meta="A quiet timer with Rusty working beside you" onPress={() => router.replace('/focus/setup')} />
        <OptionRow title="What Rusty knows about you" meta={knowsMeta} onPress={() => router.replace('/knows')} />
        {skip && (
          <OptionRow
            title="What can wait today?"
            meta={`Rusty has an idea about “${skip.task.title}”`}
            onPress={() => router.replace('/todos')}
          />
        )}

        {checkin && (
          <View style={{ gap: space.xs }}>
            <Eyebrow color={colors.inkSoft}>Also, about your paw promise</Eyebrow>
            <CheckinCard
              task={checkin}
              compact
              onDone={(t) => {
                completeTask(t.id);
                rustyBus.getState().queue('celebrate');
                router.replace({
                  pathname: '/log-success',
                  params: { taskId: t.id },
                });
              }}
            />
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/report')}
          hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: space.xs }}
        >
          <T v="label" color={colors.inkSoft}>
            Something’s not right? Tell Rusty
          </T>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    borderRadius: radius.input,
    backgroundColor: colors.bubbleRusty,
    borderWidth: 1.5,
    borderColor: colors.action,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  talkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
