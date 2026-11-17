import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Eyebrow, Field, NavBar, OptionRow, Row, Screen, T } from '@/components/ui';
import { useArtStatus } from '@/ai/art';
import { pingRusty } from '@/ai/rusty';
import { useAiHealth } from '@/lib/health';
import { seedDemo } from '@/data/seed';
import { patchProfile, resetLocal, showToast, useStore } from '@/data/store';
import { wipeRemote } from '@/data/sync';
import { askNotificationPermission } from '@/lib/notifications';
import { authError, supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
import { rustyBus, type SpotKey } from '@/rusty/brain';
import { writeDiary } from '@/rusty/journal';
import type { PoseKey } from '@/rusty/rig';
import { startTutorial } from '@/tutorial/tutorial';
import { refreshWorld, useWorld, type Condition, type Phase } from '@/world/world';

export default function Settings() {
  const profile = useStore((s) => s.profile);
  const sync = useStore((s) => s.syncStatus);
  const outbox = useStore((s) => s.outbox.length);
  const world = useWorld();
  const [name, setName] = useState(profile.name);
  const set = (k: keyof typeof profile.settings, v: boolean) => patchProfile({ settings: { ...profile.settings, [k]: v } });

  const confirm = (title: string, body: string, go: () => void) => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n\n${body}`) ?? true) go();
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen nav={<NavBar title="Settings" backLabel="Home" />} tab="index">
      <Card style={{ gap: space.md }}>
        <Field
          label="What Rusty calls you"
          value={name}
          onChangeText={setName}
          onEndEditing={() => patchProfile({ name: name.trim() })}
          onSubmitEditing={() => patchProfile({ name: name.trim() })}
        />
        <Toggle
          title="Gentle reminders"
          meta="At the time you promise a step. Never 10pm–8am."
          value={profile.settings.notifications}
          onChange={async (v) => set('notifications', v ? await askNotificationPermission() : false)}
        />
        <Toggle
          title="Real weather in Rusty’s window"
          meta={`Using ${world.place}. Off = Stanford.`}
          value={profile.settings.location}
          onChange={(v) => {
            set('location', v);
            void refreshWorld(v);
          }}
        />
        <Toggle
          title="Demo speed"
          meta="For testing: focus timers run 20× faster, and Rusty’s day runs 10× faster (he changes what he’s doing every few seconds instead of every few minutes)."
          value={profile.settings.demoSpeed}
          onChange={(v) => {
            set('demoSpeed', v);
            rustyBus.getState().setSpeed(v ? 10 : 1);
          }}
        />
      </Card>

      <Card style={{ gap: space.sm }}>
        <Eyebrow>Make Rusty…</Eyebrow>
        <T v="caption">For demos: send Rusty to do something now. He walks there and settles in (takes a few seconds), then goes back to his day after two minutes.</T>
        <ChipRow>
          {DEMO_MOVES.map((m) => (
            <Chip
              key={m.label}
              onPress={() => {
                rustyBus.getState().direct({ pose: m.pose, spot: m.spot });
                router.dismissTo('/');
              }}
            >
              {m.label}
            </Chip>
          ))}
          <Chip
            onPress={() => {
              rustyBus.getState().sendOnTrip();
              router.dismissTo('/');
            }}
          >
            Go on a trip (75 s)
          </Chip>
          <Chip
            onPress={() => {
              void writeDiary(new Date());
              showToast('Rusty wrote today’s diary page. It’s in Keepsakes → From Rusty.');
            }}
          >
            Write in his diary
          </Chip>
        </ChipRow>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Eyebrow>Preview the room</Eyebrow>
        <T v="caption">For demos: see Rusty’s room at another time or in other weather.</T>
        <ChipRow>
          {(['live', 'dawn', 'day', 'golden', 'dusk', 'night'] as const).map((p) => (
            <Chip
              key={p}
              selected={(world.override?.phase ?? 'live') === p}
              onPress={() => useWorld.setState({ override: { ...world.override, phase: p === 'live' ? undefined : (p as Phase) } })}
            >
              {p === 'live' ? 'Now' : p}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow>
          {(['live', 'clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'] as const).map((c) => (
            <Chip
              key={c}
              selected={(world.override?.condition ?? 'live') === c}
              onPress={() => useWorld.setState({ override: { ...world.override, condition: c === 'live' ? undefined : (c as Condition) } })}
            >
              {c === 'live' ? 'Real weather' : c}
            </Chip>
          ))}
        </ChipRow>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Eyebrow>Help</Eyebrow>
        <Button variant="secondary" icon="info" onPress={() => router.push('/help')}>
          How Restie works
        </Button>
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
        <Button
          variant="secondary"
          onPress={() =>
            confirm('Load Sam’s demo?', 'This replaces everything with the demo data used in our usability tests.', async () => {
              await wipeRemote();
              seedDemo();
              showToast('Demo loaded. Hi, Sam!');
              router.dismissTo('/');
            })
          }
        >
          Load Sam’s demo
        </Button>
        <Button
          variant="tertiary"
          onPress={() =>
            confirm('Start over?', 'This erases your hobbies, steps and keepsakes on this device and in the cloud.', async () => {
              await wipeRemote();
              resetLocal();
              router.replace('/onboarding');
            })
          }
        >
          Start over
        </Button>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Eyebrow>Your data</Eyebrow>
        <T v="callout">
          {supabase
            ? sync === 'synced'
              ? 'Saved to the cloud ✓'
              : sync === 'syncing'
                ? 'Saving…'
                : `Offline — ${outbox} change${outbox === 1 ? '' : 's'} will sync when you’re back online.`
            : 'Saved on this device only (cloud sync not configured).'}
        </T>
        <T v="caption">
          Rusty’s replies are written by Claude (Anthropic). He only sees a short summary of your hobbies and plans — never your photos or
          location.
        </T>
        <OptionRow title="What Rusty knows about you" meta="See, fix or forget what he keeps in mind" onPress={() => router.push('/knows')} />
        <AiStatus />
        <Paints />
      </Card>
      <T v="caption" center>
        Restie · CS 147 Autumn 2026 · Shirley Z. & Ziyu R.
      </T>
    </Screen>
  );
}

const DEMO_MOVES: { label: string; pose: PoseKey; spot: SpotKey }[] = [
  { label: 'Paint by the window', pose: 'paint', spot: 'window' },
  { label: 'Bake at the desk', pose: 'cook', spot: 'desk' },
  { label: 'Nap in his bed', pose: 'sleep', spot: 'bed' },
  { label: 'Read in his bed', pose: 'think', spot: 'bed' },
  { label: 'Daydream at the window', pose: 'think', spot: 'window' },
  { label: 'Sit by the door', pose: 'sit', spot: 'door' },
  { label: 'Come back to the rug', pose: 'sit', spot: 'rug' },
];

function Toggle({ title, meta, value, onChange }: { title: string; meta: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <T v="headline">{title}</T>
        <T v="caption">{meta}</T>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.action, false: colors.border }}
        thumbColor={colors.white}
        accessibilityLabel={title}
      />
    </Row>
  );
}

/** Rusty's paints: how many drawings are left this month (no prices). */
function Paints() {
  const s = useArtStatus();
  if (!supabase) return null;
  return (
    <T v="caption">
      {!s
        ? 'Rusty’s paints: checking…'
        : s.configured
          ? `🎨 Rusty’s paints: ${s.left} of ${s.cap} drawings left this month. He draws pictures for hobbies he doesn’t have art for, and can illustrate keepsakes. Every drawing is checked before you see it.`
          : '🎨 Rusty’s drawings are off (no image model connected), so he uses his built-in art.'}
    </T>
  );
}

/** Rusty's AI: working, or not reachable and why, with a way to try again. */
function AiStatus() {
  const reported = useAiHealth((s) => s.health);
  // a failed sign-in counts even before any AI call has been tried
  const signIn = authError();
  const health = reported.state === 'unknown' && signIn ? { state: 'offline' as const, at: 0, reason: signIn } : reported;
  const [checking, setChecking] = useState(false);
  const label =
    health.state === 'ok'
      ? '🧠 Rusty’s AI: working.'
      : health.state === 'offline'
        ? `🧠 Rusty’s AI: not reachable on this device: ${health.reason}. He uses his own short replies until it’s back.`
        : '🧠 Rusty’s AI: not checked yet on this visit.';
  return (
    <View style={{ gap: space.xs }}>
      <T v="caption" color={health.state === 'offline' ? colors.actionText : undefined}>
        {label}
      </T>
      {health.state !== 'ok' && (
        <Button
          small
          full={false}
          variant="secondary"
          loading={checking}
          onPress={async () => {
            setChecking(true);
            const ok = await pingRusty();
            setChecking(false);
            showToast(ok ? 'Rusty’s AI is working.' : 'Still not reachable. The reason is shown above.');
          }}
        >
          Check again
        </Button>
      )}
    </View>
  );
}
