/**
 * Quiet time: a real countdown (keeps correct time if you leave the app),
 * Rusty working on his own version of your hobby beside you.
 * Settings → "Demo speed" makes it run 20× faster for usability tests.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, NavBar, Row, Screen, T } from '@/components/ui';
import { useStore } from '@/data/store';
import { cancelScheduled, scheduleAt } from '@/lib/notifications';
import type { PoseKey } from '@/rusty/rig';
import { RustyPuppet } from '@/rusty/RustyPuppet';
import { colors, space, type } from '@/theme/tokens';

const WORK_POSE: Record<string, PoseKey> = { drawing: 'paint', baking: 'cook', reading: 'think', writing: 'think' };

export default function FocusTimer() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useStore((s) => s.focus_sessions[sessionId]);
  const hobby = useStore((s) => (session?.hobbyId ? s.hobbies[session.hobbyId] : undefined));
  const demo = useStore((s) => s.profile.settings.demoSpeed);
  const total = (session?.minutes ?? 5) * 60_000;
  const speed = demo ? 20 : 1;

  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const endAt = useRef(startedAt + total / speed);
  const pausedLeft = useRef(total);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    router.replace({ pathname: '/focus/done', params: { sessionId } });
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (paused) return;
      const remaining = Math.max(0, (endAt.current - Date.now()) * speed);
      setLeft(remaining);
      if (remaining <= 0) finish();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, speed]);

  // A real notification at the end time, so you hear back even if you leave
  // the app (cancelled on pause / finish, re-scheduled on resume).
  const notifId = `focus-${sessionId}`;
  useEffect(() => {
    if (paused) void cancelScheduled(notifId);
    else void scheduleAt(notifId, new Date(endAt.current), 'Time’s up! 🐾', 'Rusty wants to hear how it went.', `/focus/done?sessionId=${sessionId}`);
    return () => void cancelScheduled(notifId);
  }, [paused, notifId, sessionId]);

  const togglePause = () => {
    if (paused) {
      endAt.current = Date.now() + pausedLeft.current / speed;
      setPaused(false);
    } else {
      pausedLeft.current = Math.max(0, (endAt.current - Date.now()) * speed);
      setPaused(true);
    }
  };

  const secs = Math.ceil(left / 1000);
  const mm = Math.floor(secs / 60);
  const ss = `${secs % 60}`.padStart(2, '0');
  const R = 110;
  const C = 2 * Math.PI * R;
  const frac = 1 - left / total;

  return (
    <Screen
      nav={<NavBar title="Quiet time" close onBack={finish} />}
      contentStyle={{ alignItems: 'center' }}
      footer={
        <Row>
          <Button full={false} style={{ flex: 1 }} variant="secondary" icon={paused ? 'play' : 'pause'} onPress={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button full={false} style={{ flex: 1 }} variant="tertiary" onPress={finish}>
            End early
          </Button>
        </Row>
      }
    >
      <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginTop: space.lg }}>
        <Svg width={260} height={260} style={{ position: 'absolute' }}>
          <Circle cx={130} cy={130} r={R} stroke={colors.border} strokeWidth={12} fill={colors.card} />
          <Circle
            cx={130}
            cy={130}
            r={R}
            stroke={colors.action}
            strokeWidth={12}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C * (1 - frac)}
            strokeLinecap="round"
            transform="rotate(-90 130 130)"
          />
        </Svg>
        <T style={type.timer} accessibilityRole="timer" accessibilityLabel={`${mm} minutes ${ss} seconds left`}>
          {mm}:{ss}
        </T>
        <T v="eyebrow" color={colors.inkSoft} numberOfLines={1} style={{ maxWidth: 180, textAlign: 'center' }}>
          {(session?.label ?? '').toUpperCase()}
        </T>
      </View>
      <RustyPuppet pose={paused ? 'sleep' : (WORK_POSE[hobby?.icon ?? ''] ?? 'paint')} size={220} quiet accessibilityLabel="Rusty working beside you" />
      <T v="callout" color={colors.inkSoft} center>
        {paused ? 'Taking a little break. Rusty’s resting too.' : 'Rusty’s staying nearby.'}
        {demo ? '  (demo speed)' : ''}
      </T>
    </Screen>
  );
}
