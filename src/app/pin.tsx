/** "Pin this to your wall?" — pinned keepsakes hang in Rusty's frames. */
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { KeepsakeImage } from '@/components/KeepsakeImage';
import { Sheet } from '@/components/Sheet';
import { Button, T } from '@/components/ui';
import { pinKeepsake } from '@/data/actions';
import { showToast, useStore } from '@/data/store';
import { colors, space } from '@/theme/tokens';

export default function Pin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const k = useStore((s) => s.keepsakes[id]);
  return (
    <Sheet dismissable={false} center>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        {k && (
          <View style={{ backgroundColor: colors.white, padding: 6, paddingBottom: 12, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
            <KeepsakeImage keepsake={k} style={{ width: 120, height: 130 }} />
          </View>
        )}
        <T v="title1" center>
          Pin this to your wall?
        </T>
        <T v="callout" color={colors.inkSoft} center>
          It’ll hang in Rusty’s room.
        </T>
      </View>
      <Button
        icon="pin"
        onPress={() => {
          pinKeepsake(id, true);
          showToast('Pinned to your wall.');
          router.dismissTo('/');
        }}
      >
        Pin
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          showToast('Saved to your keepsakes.');
          router.dismissTo('/keepsakes');
        }}
      >
        Not now
      </Button>
    </Sheet>
  );
}
