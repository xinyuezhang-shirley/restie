import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { KeepsakeImage } from '@/components/KeepsakeImage';
import { Sheet } from '@/components/Sheet';
import { Chip, ChipRow, NavBar, OptionRow, Screen, T, tap } from '@/components/ui';
import { keepsakesOf } from '@/data/selectors';
import { useDerived } from '@/data/store';
import type { Keepsake } from '@/data/types';
import { ago } from '@/lib/time';
import { colors, shadows, space } from '@/theme/tokens';

type Filter = 'all' | 'photo' | 'note' | 'rusty';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'photo', label: 'Photos' },
  { key: 'note', label: 'Notes' },
  { key: 'rusty', label: 'From Rusty' },
];

export default function Keepsakes() {
  const all = useDerived(keepsakesOf);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const { width } = useWindowDimensions();
  // Two equal columns, measured from the grid itself (not guessed from the window).
  const [gridW, setGridW] = useState(Math.min(width, 440) - space.lg * 2);
  const tileW = Math.floor((gridW - space.md) / 2);
  const list = filter === 'all' ? all : all.filter((k) => k.kind === filter);

  const pickFromLibrary = async () => {
    setAdding(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 5] });
    if (!res.canceled && res.assets[0]) router.push({ pathname: '/keepsake/new', params: { uri: res.assets[0].uri } });
  };

  return (
    // Every page has a way back (to Home, where everything starts).
    <Screen nav={<NavBar backLabel="Home" onBack={() => router.navigate('/')} />}>
      <View style={{ marginTop: space.md, gap: space.xs }}>
        <T v="display" accessibilityRole="header">
          Keepsakes
        </T>
        <T v="callout" color={colors.inkSoft}>
          Little memories from your journey together.
        </T>
      </View>
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a keepsake"
          onPress={() => {
            tap();
            setAdding(true);
          }}
          style={({ pressed }) => [styles.add, { width: tileW, minHeight: tileW * 1.25 }, pressed && { backgroundColor: colors.muted }]}
        >
          <Icon name="plus" size={32} color={colors.actionText} />
          <T v="headline" color={colors.actionText}>
            Add a keepsake
          </T>
        </Pressable>
        {list.map((k) => (
          <Tile key={k.id} k={k} w={tileW} />
        ))}
      </View>
      {list.length === 0 && filter !== 'all' && (
        <T v="callout" color={colors.inkSoft} center>
          Nothing here yet.
        </T>
      )}

      <Modal visible={adding} transparent onRequestClose={() => setAdding(false)}>
        {adding && (
          <Sheet title="Add a keepsake" onClose={() => setAdding(false)}>
            <OptionRow
              title="Take a photo"
              meta="Snap what you made or where you were"
              onPress={() => {
                setAdding(false);
                router.push('/camera');
              }}
            />
            <OptionRow title="Choose from photos" meta="Pick one you already took" onPress={pickFromLibrary} />
            <OptionRow
              title="Write a note"
              meta="A few words to remember today"
              onPress={() => {
                setAdding(false);
                router.push({ pathname: '/keepsake/new', params: { note: '1' } });
              }}
            />
          </Sheet>
        )}
      </Modal>
    </Screen>
  );
}

function Tile({ k, w }: { k: Keepsake; w: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${k.caption}, ${ago(k.createdAt)}${k.pinned ? ', pinned to the wall' : ''}`}
      onPress={() => {
        tap();
        router.push(`/keepsake/${k.id}`);
      }}
      style={({ pressed }) => [styles.tile, { width: w }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <View style={{ width: w - 16, height: (w - 16) * 1.0, backgroundColor: k.kind === 'note' ? '#FFF6DE' : colors.canvas, borderRadius: 4, overflow: 'hidden' }}>
        {k.kind === 'note' && !k.sticker ? (
          <View style={{ padding: space.sm }}>
            <T v="callout" numberOfLines={6}>
              {k.note || k.caption}
            </T>
          </View>
        ) : (
          <KeepsakeImage keepsake={k} style={{ width: '100%', height: '100%' }} />
        )}
      </View>
      {/* readable at a glance: 16px caption, 15px date (eval #23: keepsakes were hard to see) */}
      <T v="label" numberOfLines={3} style={{ marginTop: space.sm, fontSize: 16, lineHeight: 21 }}>
        {k.caption}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 'auto', paddingTop: space.xs }}>
        <T v="callout" color={colors.inkSoft} style={{ flex: 1 }}>
          {ago(k.createdAt)}
        </T>
        {k.pinned && <Icon name="pin" size={18} color={colors.action} />}
        {k.kind === 'rusty' && <Icon name="paw" size={18} color={colors.accent} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // rows stretch, so the add tile and a keepsake beside it are always the same height
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'stretch' },
  add: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E3C9AE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.md,
  },
  tile: {
    backgroundColor: colors.white,
    padding: 8,
    paddingBottom: 10,
    borderRadius: 8,
    ...shadows.soft,
  },
});
