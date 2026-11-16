/** "Time's up! How did it go?" — every answer is a fine answer. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, RustyAvatar, T } from '@/components/ui';
import { endSession, reschedule } from '@/data/actions';
import { showToast, useStore } from '@/data/store';
import { rustyBus } from '@/rusty/brain';
import { colors, space } from '@/theme/tokens';

export default function FocusDone() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useStore((s) => s.focus_sessions[sessionId]);
  const [notToday, setNotToday] = useState(false);

  const answer = (outcome: 'did_it' | 'progress') => {
    const r = endSession(sessionId, outcome);
    rustyBus.getState().queue('celebrate');
    router.replace({
      pathname: '/memory',
      params: { outcome, taskId: r?.task.id ?? session?.taskId ?? '', hobbyId: session?.hobbyId ?? '' },
    });
  };

  if (notToday) {
    return (
      <Sheet dismissable={false} center>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <RustyAvatar pose="sleep" size={90} />
          <T v="title1" center>
            That’s okay.
          </T>
          <T v="callout" color={colors.inkSoft} center>
            You showed up, and that counts. Want to try again later?
          </T>
        </View>
        {session?.taskId ? (
          <Button
            onPress={() => {
              reschedule(session.taskId!, 'tomorrow');
              showToast('Moved to tomorrow. No rush.');
              router.dismissTo('/');
            }}
          >
            Try again tomorrow
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onPress={() => router.replace({ pathname: '/focus/setup', params: { taskId: session?.taskId ?? '', minutes: '2' } })}
        >
          Try just 2 minutes
        </Button>
        <Button variant="tertiary" small onPress={() => router.dismissTo('/')}>
          Back to Rusty’s room
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet dismissable={false} center>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <RustyAvatar pose="wave" size={90} />
        <T v="title1" center>
          Time’s up! How did it go?
        </T>
        {session && (
          <T v="caption" center>
            {session.label} · {session.minutes} min
          </T>
        )}
      </View>
      <Button onPress={() => answer('did_it')}>Did it</Button>
      <Button variant="secondary" onPress={() => answer('progress')}>
        Made progress
      </Button>
      <Button
        variant="tertiary"
        onPress={() => {
          endSession(sessionId, 'not_today');
          setNotToday(true);
        }}
      >
        Didn’t get to it
      </Button>
    </Sheet>
  );
}
