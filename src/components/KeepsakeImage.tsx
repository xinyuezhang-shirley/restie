import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp } from 'react-native';

import { useArtUrl } from '@/ai/art';
import { stickers } from '@/assets';
import type { Keepsake } from '@/data/types';
import { photoUrl } from '@/data/sync';
import { useStore } from '@/data/store';

/** A keepsake's picture: the photo (local or from Storage) or its sticker. */
export function useKeepsakeSource(k: Keepsake | undefined) {
  const local = useStore((s) => (k ? s.photoCache[k.id] : undefined));
  const [remote, setRemote] = useState<string | null>(null);
  const art = useArtUrl(k?.photoPath ? null : k?.artPath);
  useEffect(() => {
    let alive = true;
    if (k && !local && k.photoPath) void photoUrl(k.id, k.photoPath).then((u) => alive && setRemote(u));
    return () => {
      alive = false;
    };
  }, [k, local]);
  if (!k) return null;
  if (local) return { uri: local };
  if (remote) return { uri: remote };
  if (art) return { uri: art };
  if (k.sticker && stickers[k.sticker]) return stickers[k.sticker];
  return stickers['hobby-other'];
}

export function KeepsakeImage({
  keepsake,
  style,
  fit = 'cover',
}: {
  keepsake: Keepsake;
  style?: StyleProp<ImageStyle>;
  fit?: 'cover' | 'contain';
}) {
  const src = useKeepsakeSource(keepsake);
  const isSticker = !!src && typeof src === 'number';
  return (
    <Image
      source={src ?? undefined}
      style={StyleSheet.flatten(style)}
      contentFit={isSticker ? 'contain' : fit}
      transition={200}
      accessibilityLabel={keepsake.caption}
    />
  );
}
