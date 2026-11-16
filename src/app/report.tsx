/**
 * "Something's not right? Tell Rusty" (heuristic eval #27: help users report
 * and recover from errors).
 *
 * 1. Quick fixes first: anything logged today can be undone right here.
 * 2. Then a short report (what kind + a few words). Reports are saved with
 *    the profile (synced to Supabase), so the team can read them.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Chip, ChipRow, Eyebrow, Field, Row, RustyAvatar, T } from '@/components/ui';
import { reopenTask } from '@/data/actions';
import { alive, patchMind, showToast, useDerived, useStore } from '@/data/store';
import { dayKey, now } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

const KINDS = ['I logged something by mistake', 'Something looks broken', 'I got stuck', 'Rusty said something odd', 'An idea'];

export default function Report() {
  const [kind, setKind] = useState<string | null>(null);
  const [text, setText] = useState('');
  const hobbies = useStore((s) => s.hobbies);
  const loggedToday = useDerived((s) =>
    alive(s.tasks)
      .filter((t) => t.status === 'done' && t.doneAt && dayKey(new Date(t.doneAt)) === dayKey())
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
  );
  const mistake = kind === KINDS[0];

  const send = () => {
    const mind = useStore.getState().profile.mind;
    patchMind({ reports: [...(mind.reports ?? []), { at: now(), kind: kind ?? 'Other', text: text.trim() }].slice(-50) });
    showToast('Thank you! I wrote it down for the humans who made me.');
    router.back();
  };

  return (
    <Sheet title="Tell Rusty">
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
        <Row gap={space.md}>
          <RustyAvatar pose="think" size={52} />
          <T v="callout" style={{ flex: 1 }}>
            Uh oh. What happened? I’ll try to help, and I’ll pass it on to the humans who made me.
          </T>
        </Row>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip key={k} selected={kind === k} onPress={() => setKind(k)}>
              {k}
            </Chip>
          ))}
        </ChipRow>

        {mistake && (
          <View style={{ gap: space.sm }}>
            <Eyebrow color={colors.inkSoft}>Logged today · tap Undo to fix it</Eyebrow>
            {loggedToday.length === 0 ? (
              <T v="caption">Nothing logged today.</T>
            ) : (
              loggedToday.map((t) => (
                <Row key={t.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T v="headline">{t.title}</T>
                    <T v="caption">{t.hobbyId ? hobbies[t.hobbyId]?.name : 'To-do'}</T>
                  </View>
                  <Button
                    full={false}
                    small
                    variant="secondary"
                    onPress={() => {
                      reopenTask(t.id);
                      showToast(`Undone. “${t.title}” is open again.`);
                    }}
                  >
                    Undo
                  </Button>
                </Row>
              ))
            )}
            <T v="caption">You can also edit or delete any step from its hobby’s path.</T>
          </View>
        )}

        {kind && !mistake && (
          <>
            <Field
              label="Tell me a bit more (optional)"
              value={text}
              onChangeText={setText}
              placeholder="What were you trying to do?"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: space.md }}
            />
            <Button onPress={send}>Send to the team</Button>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
