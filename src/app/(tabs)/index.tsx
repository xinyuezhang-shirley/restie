import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Chip, IconButton, Row, T, tap } from '@/components/ui';
import { checkinOf, hobbiesOf, keepsakesOf, openTasks, pinnedKeepsakes, roomHomesOf, rustyHasNews, upNextOf, type UpNext } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import { greeting, whenLabel } from '@/lib/time';
import { Room } from '@/room/Room';
import { useDailyRusty, useRustyBrain } from '@/rusty/brain';
import { useMilestoneCards, useRustyJournal } from '@/rusty/journal';
import { setRustyNow } from '@/rusty/now';
import { colors, radius, shadows, space } from '@/theme/tokens';
import { setTutorialHomeVisible, useAutoStartTutorial, useTutorial, useTutorialTarget } from '@/tutorial/tutorial';


export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const roomW = Math.min(width, 440);
  const [visible, setVisible] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      setTutorialHomeVisible(true);
      return () => {
        setVisible(false);
        setTutorialHomeVisible(false);
      };
    }, []),
  );

  const name = useStore((s) => s.profile.name);
  const touring = useTutorial((s) => s.active);
  const tourStep = useTutorial((s) => s.step);
  const brain = useRustyBrain(visible, touring);
  // a kept drawing for one of your own hobbies stands in the room
  const otherArt = useStore(
    (s) => Object.values(s.hobbies).find((h) => !h.deletedAt && h.status === 'active' && h.icon === 'other' && h.artPath)?.artPath ?? null,
  );
  // his chat knows what he's up to ("I was just painting by the window")
  useEffect(() => setRustyNow(brain.doing), [brain.doing]);
  useDailyRusty();
  useRustyJournal(visible && !touring, brain.say);
  useMilestoneCards();
  // Each tour step starts with a clear stage (no leftover speech bubble).
  const { hush } = brain;
  useEffect(() => {
    if (touring) hush();
  }, [touring, tourStep, hush]);
  useAutoStartTutorial(visible);
  // The subtitle names today's plan when there is one, so the header and the
  // check-in point at the same thing (heuristic eval #49).
  const today = useDerived(checkinOf);

  const hobbies = useDerived(hobbiesOf);
  const homes = useDerived(roomHomesOf);
  const upNext = useDerived(upNextOf);
  // Same count as the To-dos tab: paw promises + everyday to-dos.
  const stepCount = useDerived((s) => openTasks(s).filter((t) => t.kind === 'todo' || !!t.dueAt).length);
  const pinned = useDerived(pinnedKeepsakes);
  const news = useDerived(rustyHasNews);
  const rustyKeepsakes = useDerived((s) => keepsakesOf(s).filter((k) => k.kind === 'rusty'));
  const { ref: logRef, onLayout: onLogLayout } = useTutorialTarget('log');
  const { ref: weekRef, onLayout: onWeekLayout } = useTutorialTarget('week');

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ paddingTop: insets.top }}>
        <Row style={styles.header}>
          <View style={{ flex: 1 }}>
            {/* the greeting wraps rather than ever cutting off a name */}
            <T v="title1">
              {greeting()}
              {name ? `, ${name}` : ''}
            </T>
            <T v="caption" numberOfLines={2}>
              {today ? `Today: ${today.title}` : 'Nothing promised for today. That’s okay.'}
            </T>
          </View>
          <IconButton name="info" label="How Restie works" onPress={() => router.push('/help')} color={colors.inkSoft} />
          <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} color={colors.inkSoft} />
        </Row>
      </View>

      <View style={{ flex: 1, overflow: 'hidden', alignItems: 'center' }}>
        <Room
          width={roomW}
          brain={brain}
          hobbyCount={hobbies.length}
          stepCount={stepCount}
          homes={homes}
          otherArt={otherArt}
          pinned={pinned}
          news={news}
          onHobbies={() => router.navigate('/hobbies')}
          onTodos={() => router.navigate('/todos')}
          onClock={() => router.push('/focus/setup')}
          onKeepsakes={() => router.navigate('/keepsakes')}
          onRusty={() => router.push('/rusty')}
          onDoor={() =>
            brain.say(
              rustyKeepsakes[0]
                ? `I went out the other day and found ${rustyKeepsakes[0].caption.toLowerCase()}. it’s with your keepsakes!`
                : 'I go on little walks sometimes. if I find something nice, I’ll bring it back for you.',
            )
          }
        />

        {/* Up next — the go-to place for what's most immediate: anything
            late or due today (promises and to-dos), the rest of the week,
            then each hobby's next step. Two rows here, the rest in To-dos. */}
        <View ref={weekRef} onLayout={onWeekLayout} style={styles.week}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ gap: space.xs }}>
              <T v="title2">Up next</T>
              {/* nothing up next: no links here, the one action is below (no duplicate "+ Promise") */}
              {upNext.length > 0 && (
                <Row gap={space.md}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`See all plans and to-dos, ${upNext.length}`}
                    onPress={() => router.navigate('/todos')}
                    hitSlop={8}
                  >
                    <T v="caption" color={colors.actionText}>
                      {upNext.length > 2 ? `See all ${upNext.length} ›` : 'See all ›'}
                    </T>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Make a paw promise" onPress={() => router.push('/promise')} hitSlop={8}>
                    <T v="caption" color={colors.actionText}>
                      + Promise
                    </T>
                  </Pressable>
                </Row>
              )}
            </View>
            <Pressable
              ref={logRef}
              onLayout={onLogLayout}
              accessibilityRole="button"
              accessibilityLabel="Log a step"
              onPress={() => {
                tap('medium');
                router.push('/log');
              }}
              style={({ pressed }) => [styles.log, pressed && { backgroundColor: '#E4672F' }]}
            >
              <Icon name="pencil" size={18} color={colors.white} />
              <T v="headline" color={colors.white}>
                Log a step
              </T>
            </Pressable>
          </Row>
          <View style={{ marginTop: space.sm }}>
            {upNext.length === 0 ? (
              <View style={{ gap: space.sm }}>
                <T v="callout" color={colors.inkSoft}>
                  {hobbies.length ? 'Nothing up next. Rest counts too.' : 'No hobbies yet. Rusty can help you pick one.'}
                </T>
                <Chip onPress={() => router.push(hobbies.length ? '/promise' : '/new-hobby')}>
                  {hobbies.length ? '+ Promise a step' : '+ Start a hobby with Rusty'}
                </Chip>
              </View>
            ) : (
              upNext.slice(0, 2).map((u, i) => <UpNextRow key={u.task.id} item={u} first={i === 0} />)
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const WHEN_COLOR: Record<UpNext['when'], string> = { late: colors.actionText, today: colors.actionText, week: colors.inkSoft, anytime: colors.inkSoft };

/** One line of Up next: what, and when / which hobby. Opens the step. */
function UpNextRow({ item, first }: { item: UpNext; first: boolean }) {
  const t = item.task;
  const hobby = useStore((s) => (t.hobbyId ? s.hobbies[t.hobbyId] : undefined));
  const when = item.when === 'late' ? 'Overdue' : item.when === 'anytime' ? 'Anytime' : whenLabel(t.dueAt, t.timed);
  const what = hobby ? hobby.name : 'To-do';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${when}, ${what}. Open it`}
      onPress={() => {
        tap();
        router.push(`/step/${t.id}`);
      }}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.dot, { borderColor: t.kind === 'todo' ? colors.notePurple : colors.action }]}>
        {t.kind === 'promise' && t.dueAt ? <Icon name="paw" size={12} color={colors.action} /> : null}
      </View>
      <T v="body" numberOfLines={1} style={{ flex: 1 }}>
        {t.title}
      </T>
      <T v="caption" numberOfLines={1} color={WHEN_COLOR[item.when]} style={{ maxWidth: '42%' }}>
        {`${when} · ${what}`}
      </T>
      <Icon name="right" size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  weather: {
    paddingHorizontal: space.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  week: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.md,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: radius.card,
    padding: space.lg,
    paddingBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 440 - space.lg * 2,
    alignSelf: 'center',
    ...shadows.float,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  log: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.action,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 44,
    ...shadows.float,
  },
});
