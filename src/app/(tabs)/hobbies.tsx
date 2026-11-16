import { router } from 'expo-router';
import { View } from 'react-native';

import { CheckinCard, NothingDueCard } from '@/components/CheckinCard';
import { HobbyCard } from '@/components/HobbyCard';
import { Button, Eyebrow, NavBar, Screen, T } from '@/components/ui';
import { checkinOf, hobbiesOf } from '@/data/selectors';
import { useDerived } from '@/data/store';
import { colors, space } from '@/theme/tokens';

export default function Hobbies() {
  const hobbies = useDerived(hobbiesOf);
  const checkin = useDerived(checkinOf);
  const active = hobbies.filter((h) => h.status === 'active');
  const resting = hobbies.filter((h) => h.status === 'paused');

  return (
    // Every page has a way back (to Home, where everything starts).
    <Screen nav={<NavBar backLabel="Home" onBack={() => router.navigate('/')} />}>
      <T v="display" accessibilityRole="header" style={{ marginTop: space.md }}>
        Your hobbies
      </T>

      {checkin ? (
        <CheckinCard key={checkin.id} task={checkin} />
      ) : (
        <NothingDueCard onPlan={() => (active[0] ? router.push(`/hobby/${active[0].id}`) : router.push('/new-hobby'))} />
      )}

      {active.length === 0 && (
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
          <T v="title2" center>
            No hobbies yet
          </T>
          <T v="callout" color={colors.inkSoft} center>
            What have you been missing lately? Rusty will help you start small.
          </T>
        </View>
      )}

      <View style={{ gap: space.md }}>
        {active.map((h) => (
          <HobbyCard key={h.id} hobby={h} onPress={() => router.push(`/hobby/${h.id}`)} />
        ))}
      </View>

      <Button variant="secondary" icon="plus" onPress={() => router.push('/new-hobby')}>
        New hobby
      </Button>

      {resting.length > 0 && (
        <View style={{ gap: space.md }}>
          <Eyebrow color={colors.inkSoft}>Resting for now</Eyebrow>
          {resting.map((h) => (
            <HobbyCard key={h.id} hobby={h} onPress={() => router.push(`/hobby/${h.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
