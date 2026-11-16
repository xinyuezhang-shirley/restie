/** Look at a keepsake: pin/unpin, edit the caption, delete. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { KeepsakeImage } from '@/components/KeepsakeImage';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Row, T } from '@/components/ui';
import { deleteKeepsake, pinKeepsake, updateKeepsake } from '@/data/actions';
import { showToast, useStore } from '@/data/store';
import { dateLabel } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

export default function KeepsakeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const k = useStore((s) => s.keepsakes[id]);
  const hobby = useStore((s) => (k?.hobbyId ? s.hobbies[k.hobbyId] : undefined));
  const [editing, setEditing] = useState(false);
  const paper = k?.sticker === 'rusty-diary' || k?.sticker === 'rusty-card';
  const [caption, setCaption] = useState(k?.caption ?? '');
  if (!k || k.deletedAt) return <Sheet>{null}</Sheet>;

  return (
    <Sheet>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View style={{ backgroundColor: colors.white, padding: 10, paddingBottom: 16, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
          {k.kind === 'note' && !k.sticker ? (
            <View style={{ width: 240, minHeight: 160, backgroundColor: '#FFF6DE', padding: space.md }}>
              <T>{k.note || k.caption}</T>
            </View>
          ) : paper ? (
            // Rusty's diary pages and cards read like paper, in his voice
            <View style={{ width: 260, minHeight: 200, backgroundColor: k.sticker === 'rusty-card' ? '#FFEFE2' : '#FFF8E6', padding: space.lg, gap: space.sm }}>
              <KeepsakeImage keepsake={k} style={{ width: 64, height: 64, alignSelf: 'flex-end' }} fit="contain" />
              <T v="body" style={{ fontStyle: 'italic' }}>
                {k.note}
              </T>
              <T v="caption" style={{ alignSelf: 'flex-end' }}>
                — Rusty 🐾
              </T>
            </View>
          ) : (
            <KeepsakeImage keepsake={k} style={{ width: 240, height: 260 }} fit="cover" />
          )}
        </View>
        {editing ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Field value={caption} onChangeText={setCaption} autoFocus onSubmitEditing={() => {
              updateKeepsake(k.id, { caption: caption.trim() || k.caption });
              setEditing(false);
            }} />
          </View>
        ) : (
          <T v="title2" center onPress={() => setEditing(true)}>
            {k.caption}
          </T>
        )}
        {k.kind !== 'note' && k.note && !paper ? (
          <T v="callout" center color={colors.inkSoft}>
            {k.kind === 'rusty' ? `Rusty: “${k.note}”` : k.note}
          </T>
        ) : null}
        <T v="caption" center>
          {dateLabel(k.createdAt)}
          {hobby ? ` · ${hobby.name}` : ''}
          {k.kind === 'rusty' ? (k.sticker === 'rusty-diary' ? ' · Rusty’s diary' : k.sticker === 'rusty-card' ? ' · a card from Rusty' : ' · from Rusty’s walk') : ''}
        </T>
      </View>
      <Button
        icon="pin"
        variant={k.pinned ? 'secondary' : 'primary'}
        onPress={() => {
          const was = k.pinned;
          pinKeepsake(k.id, !was);
          showToast(was ? 'Taken down from the wall.' : 'Pinned to your wall.', () => pinKeepsake(k.id, was));
        }}
      >
        {k.pinned ? 'Unpin from wall' : 'Pin to Rusty’s wall'}
      </Button>
      <Row>
        <Button full={false} small variant="tertiary" icon="pencil" style={{ flex: 1 }} onPress={() => (editing ? (updateKeepsake(k.id, { caption: caption.trim() || k.caption }), setEditing(false)) : setEditing(true))}>
          {editing ? 'Save caption' : 'Edit caption'}
        </Button>
        <Button
          full={false}
          small
          variant="tertiary"
          icon="trash"
          style={{ flex: 1 }}
          onPress={() => {
            deleteKeepsake(k.id);
            showToast('Keepsake removed.', () => updateKeepsake(k.id, { deletedAt: null }));
            router.back();
          }}
        >
          Delete
        </Button>
      </Row>
    </Sheet>
  );
}
