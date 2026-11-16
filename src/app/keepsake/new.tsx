/** New keepsake: photo (or note) + caption + hobby → save → pin? */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, ChipRow, Eyebrow, Field, NavBar, Screen } from '@/components/ui';
import { addKeepsake } from '@/data/actions';
import { hobbiesOf } from '@/data/selectors';
import { useDerived, useStore } from '@/data/store';
import { colors, radius, space } from '@/theme/tokens';

const CAPTIONS = ['Yay! Another step.', 'Look what I made', 'A quiet little win', 'Proof I did it'];

export default function NewKeepsake() {
  const p = useLocalSearchParams<{ uri?: string; note?: string; taskId?: string; hobbyId?: string }>();
  const hobbies = useDerived(hobbiesOf);
  const task = useStore((s) => (p.taskId ? s.tasks[p.taskId] : undefined));
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState('');
  const [hobbyId, setHobbyId] = useState<string | null>(p.hobbyId || task?.hobbyId || null);
  const isNote = !p.uri;

  const save = () => {
    const k = addKeepsake({
      kind: isNote ? 'note' : 'photo',
      caption: caption.trim() || (isNote ? note.trim().split('\n')[0].slice(0, 40) : 'A little keepsake'),
      note: isNote ? note.trim() : null,
      photoUri: p.uri ?? null,
      hobbyId,
      taskId: p.taskId || null,
    });
    router.replace({ pathname: '/pin', params: { id: k.id } });
  };

  return (
    <Screen
      nav={<NavBar title="New keepsake" backLabel={isNote ? 'Back' : 'Camera'} />}
      tab="keepsakes"
      footer={
        <Button onPress={save} disabled={isNote ? !note.trim() : false}>
          Save
        </Button>
      }
    >
      {!isNote ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <View style={{ backgroundColor: colors.white, padding: 10, paddingBottom: 18, borderRadius: 6, transform: [{ rotate: '-1.5deg' }] }}>
            <Image source={{ uri: p.uri }} style={{ width: 240, height: 280, borderRadius: 2 }} contentFit="cover" accessibilityLabel="Your photo" />
          </View>
          <Button variant="tertiary" small full={false} icon="camera" onPress={() => router.replace({ pathname: '/camera', params: { taskId: p.taskId ?? '', hobbyId: p.hobbyId ?? '' } })}>
            Retake
          </Button>
        </View>
      ) : (
        <Field label="Your note" value={note} onChangeText={setNote} placeholder="What do you want to remember about today?" multiline autoFocus style={{ minHeight: 140, borderRadius: radius.input }} />
      )}
      <Field label="Caption" value={caption} onChangeText={setCaption} placeholder={task ? `e.g. ${task.title}` : 'A few words…'} />
      <ChipRow>
        {CAPTIONS.map((c) => (
          <Chip key={c} selected={caption === c} onPress={() => setCaption(c)}>
            {c}
          </Chip>
        ))}
      </ChipRow>
      {hobbies.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow color={colors.inkSoft}>Hobby</Eyebrow>
          <ChipRow>
            {hobbies.map((h) => (
              <Chip key={h.id} selected={hobbyId === h.id} onPress={() => setHobbyId(hobbyId === h.id ? null : h.id)}>
                {h.name}
              </Chip>
            ))}
          </ChipRow>
        </View>
      )}
    </Screen>
  );
}
