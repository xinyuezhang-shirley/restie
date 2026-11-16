/**
 * Onboarding: welcome → your name → what you're curious about → permissions.
 * Ends on Home, where Rusty's guided tour starts.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { hobbyChoices, hobbyIcons, iconFor } from '@/assets';
import { Button, Field, Row, Screen, T, tap } from '@/components/ui';
import { createHobby } from '@/data/actions';
import { seedDemo } from '@/data/seed';
import { patchProfile, useStore } from '@/data/store';
import { wipeRemote } from '@/data/sync';
import { askNotificationPermission } from '@/lib/notifications';
import { now } from '@/lib/time';
import { RustyPuppet } from '@/rusty/RustyPuppet';
import { colors, radius, space } from '@/theme/tokens';
import { refreshWorld } from '@/world/world';

type Step = 'welcome' | 'name' | 'hobbies' | 'permissions';
const ORDER: Step[] = ['welcome', 'name', 'hobbies', 'permissions'];

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(useStore.getState().profile.name);
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const { width } = useWindowDimensions();
  const w = Math.min(width, 440);
  const idx = ORDER.indexOf(step);

  const finish = () => {
    const names = [...picked, ...(other.trim() ? [other.trim()] : [])];
    for (const n of names) {
      const choice = hobbyChoices.find((c) => c.name === n);
      createHobby({ name: n, icon: choice?.icon ?? iconFor(n), kind: 'keep', milestones: [] });
    }
    patchProfile({ name: name.trim(), onboardedAt: now() });
    router.replace('/');
  };

  const demo = async () => {
    await wipeRemote();
    seedDemo();
    router.replace('/');
  };

  const back = idx > 0 ? () => setStep(ORDER[idx - 1]) : undefined;

  if (step === 'welcome') {
    return (
      <Screen
        footer={
          <>
            <Button onPress={() => setStep('name')}>Let’s begin</Button>
            <Button variant="tertiary" small onPress={demo}>
              Explore with demo data (Sam)
            </Button>
          </>
        }
        contentStyle={{ alignItems: 'center', paddingTop: space.xxl }}
      >
        <T v="display" center style={{ fontSize: 34, lineHeight: 40 }}>
          Welcome to{'\n'}
          <T v="display" color={colors.actionText} style={{ fontSize: 44, lineHeight: 52 }}>
            Restie
          </T>
        </T>
        <T v="body" center color={colors.inkSoft} style={{ maxWidth: 300 }}>
          Make time for what matters, with a little companion who grows alongside you, one hobby at a time.
        </T>
        <RustyPuppet pose="wave" size={Math.min(w * 0.78, 320)} accessibilityLabel="Rusty waving hello" />
      </Screen>
    );
  }

  return (
    <Screen
      nav={
        <View style={styles.progressWrap}>
          {back && (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10} style={{ paddingRight: space.md }}>
              <T v="headline" color={colors.actionText}>
                ‹ Back
              </T>
            </Pressable>
          )}
          <View style={styles.progress} accessibilityLabel={`Step ${idx} of 3`}>
            <View style={[styles.progressFill, { width: `${(idx / 3) * 100}%` }]} />
          </View>
        </View>
      }
      footer={
        step === 'name' ? (
          <Button onPress={() => setStep('hobbies')} disabled={!name.trim()}>
            Next
          </Button>
        ) : step === 'hobbies' ? (
          <Button onPress={() => setStep('permissions')}>{picked.length || other.trim() ? 'Next' : 'Skip for now'}</Button>
        ) : (
          <Button onPress={finish}>Meet Rusty’s room</Button>
        )
      }
    >
      {step === 'name' && (
        <>
          <RustyPuppet pose="think" size={170} quiet />
          <T v="display">What should Rusty call you?</T>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && setStep('hobbies')}
            accessibilityLabel="Your name"
          />
        </>
      )}

      {step === 'hobbies' && (
        <>
          <View style={{ gap: space.xs }}>
            <T v="display">What are you curious about?</T>
            <T v="callout" color={colors.inkSoft}>
              Pick a few interests — you can always add more later. Rusty will take them up too.
            </T>
          </View>
          <View style={styles.grid}>
            {hobbyChoices.map((h) => {
              const on = picked.includes(h.name);
              return (
                <Pressable
                  key={h.name}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={h.name}
                  onPress={() => {
                    tap();
                    setPicked((p) => (on ? p.filter((x) => x !== h.name) : [...p, h.name]));
                  }}
                  style={[styles.tile, { width: (w - space.lg * 2 - space.md * 2) / 3 }, on && styles.tileOn]}
                >
                  <Image source={hobbyIcons[h.icon]} style={{ width: 52, height: 52 }} contentFit="contain" />
                  <T v="label">{h.name}</T>
                </Pressable>
              );
            })}
          </View>
          <Field label="Something else?" value={other} onChangeText={setOther} placeholder="e.g. Piano, pottery, running" />
        </>
      )}

      {step === 'permissions' && (
        <>
          <T v="display">Two small things</T>
          <Perm
            title="Gentle reminders"
            text="When you give a step a day (a paw promise), Rusty can check in then. One reminder per promise, never late at night."
            onAllow={async () => {
              const ok = await askNotificationPermission();
              patchProfile({ settings: { ...useStore.getState().profile.settings, notifications: ok } });
              return ok;
            }}
            onSkip={() => patchProfile({ settings: { ...useStore.getState().profile.settings, notifications: false } })}
          />
          <Perm
            title="Rusty’s window"
            text="His window shows the real sky and weather where you are. Your location only goes to the weather service, never anywhere else."
            onAllow={async () => {
              patchProfile({ settings: { ...useStore.getState().profile.settings, location: true } });
              await refreshWorld(true);
              return true;
            }}
            onSkip={() => {
              patchProfile({ settings: { ...useStore.getState().profile.settings, location: false } });
              void refreshWorld(false);
            }}
            skipLabel="Use Stanford"
          />
        </>
      )}
    </Screen>
  );
}

function Perm({
  title,
  text,
  onAllow,
  onSkip,
  skipLabel = 'Not now',
}: {
  title: string;
  text: string;
  onAllow: () => Promise<boolean>;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const [state, setState] = useState<'ask' | 'yes' | 'no'>('ask');
  return (
    <View style={styles.perm}>
      <T v="title2">{title}</T>
      <T v="callout" color={colors.inkSoft}>
        {text}
      </T>
      {state === 'ask' ? (
        <Row>
          <Button full={false} small style={{ flex: 1 }} onPress={async () => setState((await onAllow()) ? 'yes' : 'no')}>
            Allow
          </Button>
          <Button
            full={false}
            small
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              onSkip();
              setState('no');
            }}
          >
            {skipLabel}
          </Button>
        </Row>
      ) : (
        <T v="label" color={state === 'yes' ? colors.successText : colors.inkSoft}>
          {state === 'yes' ? '✓ On' : 'Off — you can change this in Settings'}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, height: 52 },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.action, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    aspectRatio: 0.95,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  tileOn: { borderColor: colors.action, backgroundColor: '#FFF1E6' },
  perm: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border },
});
