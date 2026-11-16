/**
 * How Restie works (heuristic eval #28: in-app help & documentation; #51:
 * clear guidance for people new to chatting with an AI or to game-like UIs).
 * Reachable from the ? on Home and from Settings.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Eyebrow, NavBar, Row, Screen, T } from '@/components/ui';
import { startTutorial } from '@/tutorial/tutorial';
import { colors, space } from '@/theme/tokens';

const WORDS: [string, string, string][] = [
  ['Hobby', 'something you love doing', 'Guitar'],
  ['Goal', 'what you’re working toward', 'Play the movie song'],
  ['Milestone', 'a stage on the way to your goal', 'Learn verse 3'],
  ['Step', 'one small thing you can do in a sitting', 'Find chords for verse 3'],
  ['Substep', 'a checklist item inside a step', 'Look up the chord chart'],
  ['🐾 Paw promise', 'a step with a day you promised Rusty', 'Planned for Saturday'],
  ['To-do', 'everyday things that aren’t hobbies', 'Problem set 6'],
  ['Keepsake', 'a photo or note you save to look back on', 'First loaf!'],
];

const HOWTO: { icon: IconName; title: string; steps: string }[] = [
  {
    icon: 'check',
    title: 'Log a step you did',
    steps: 'Home → Log a step → tap the step. Or tick its box on the hobby’s page. You’ll see how far along the milestone is, and you can Undo.',
  },
  {
    icon: 'hobbies',
    title: 'Start a new hobby',
    steps: 'Hobbies → New hobby. Rusty asks a few questions; tap any earlier answer to change it, or “Skip, I’ll plan later”. Everything can be edited afterwards on the hobby’s page.',
  },
  {
    icon: 'chat',
    title: 'Get unstuck',
    steps: 'Press and hold Rusty (or tap the bubble next to him) → Talk to Rusty → “Help me start…” (his suggestions come from what’s due for you). He’ll shrink it to 5 minutes and can do it with you on the focus timer.',
  },
  {
    icon: 'clock',
    title: 'Focus timer',
    steps: 'Tap the clock on Home. Pick what you’re doing and for how long; Rusty works beside you. Afterwards you can save a keepsake.',
  },
  {
    icon: 'keepsakes',
    title: 'Keepsakes',
    steps: 'Save a photo or a note after a step or a session. Pin up to three and they hang in the frames on Rusty’s wall.',
  },
];

const RUSTY: [string, string][] = [
  ['Tap Rusty', 'he reacts (pet his head for hearts)'],
  ['Press and hold Rusty', 'his menu: talk, log, focus timer'],
  ['Tap the floor', 'he walks over there (on a computer: arrow keys)'],
  ['Tap his bed', 'he goes for a nap'],
  ['The ! over Rusty', 'he has a check-in on a paw promise'],
  ['What Rusty knows', 'Rusty’s menu → what he’s learned about you; fix or forget any of it'],
  ['Mistakes', 'every “done” has Undo; or tell Rusty something’s not right'],
];

export default function Help() {
  return (
    <Screen nav={<NavBar title="How Restie works" backLabel="Back" />} tab="index">
      <T v="callout" color={colors.inkSoft}>
        Restie helps you make time for hobbies in small steps, with Rusty keeping you company.
      </T>

      <View style={{ gap: space.sm }}>
        <T v="title2" accessibilityRole="header">
          Things you can do
        </T>
        {HOWTO.map((h) => (
          <Card key={h.title} style={{ gap: space.xs }}>
            <Row gap={space.sm}>
              <Icon name={h.icon} size={22} color={colors.actionText} />
              <T v="headline">{h.title}</T>
            </Row>
            <T v="callout">{h.steps}</T>
          </Card>
        ))}
      </View>

      <Card style={{ gap: space.sm }}>
        <T v="title2" accessibilityRole="header">
          Rusty
        </T>
        {RUSTY.map(([a, b]) => (
          <View key={a}>
            <T v="headline">{a}</T>
            <T v="callout" color={colors.inkSoft}>
              {b}
            </T>
          </View>
        ))}
      </Card>

      <Card style={{ gap: space.sm }}>
        <T v="title2" accessibilityRole="header">
          Words we use
        </T>
        {WORDS.map(([w, means, ex]) => (
          <View key={w}>
            <T v="headline">{w}</T>
            <T v="callout" color={colors.inkSoft}>
              {means} · <T v="callout" color={colors.inkSoft} style={{ fontStyle: 'italic' }}>{ex}</T>
            </T>
          </View>
        ))}
      </Card>

      <View style={{ gap: space.sm }}>
        <Eyebrow color={colors.inkSoft}>Still unsure?</Eyebrow>
        <Button
          variant="secondary"
          onPress={() => {
            router.dismissTo('/');
            setTimeout(startTutorial, 500);
          }}
        >
          Replay Rusty’s tour
        </Button>
        <Button variant="secondary" icon="chat" onPress={() => router.push('/report')}>
          Something’s not right? Tell Rusty
        </Button>
      </View>
    </Screen>
  );
}
