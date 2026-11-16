/**
 * What Rusty knows about you — and you're in charge of it.
 *
 *   You told me   things he picked up in chat, or that you added here.
 *                 Edit or forget any of them.
 *   I noticed     patterns from what you actually did, with the reason.
 *                 "Not true" makes him stop using it.
 *
 * It's what his suggestions are built on, so it's shown plainly (H1), every
 * item can be corrected (H3), and it says what it's used for (privacy).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Eyebrow, Field, IconButton, NavBar, Row, RustyAvatar, Screen, T } from '@/components/ui';
import { showToast, useDerived, useStore } from '@/data/store';
import type { RustyNote } from '@/data/types';
import { ago } from '@/lib/time';
import { editNote, forgetEverything, forgetNote, hideNoticed, noticedOf, notesOf, remember, restoreNote, unhideNoticed } from '@/rusty/knows';
import { colors, radius, space } from '@/theme/tokens';

export default function Knows() {
  const notes = useDerived(notesOf);
  const noticed = useDerived(noticedOf);
  const name = useStore((s) => s.profile.name);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    const added = remember([t], 'you');
    setDraft('');
    showToast(added.length ? 'Rusty will remember that.' : 'He already knows that one.');
  };

  return (
    <Screen nav={<NavBar title="What Rusty knows" backLabel="Back" />}>
      <Row gap={space.md} style={{ alignItems: 'center' }}>
        <RustyAvatar pose="think" size={72} />
        <T v="callout" color={colors.inkSoft} style={{ flex: 1 }}>
          {`These are the things I keep in mind so my ideas fit you${name ? `, ${name}` : ''}. Fix anything I got wrong.`}
        </T>
      </Row>

      <View style={{ gap: space.sm }}>
        <Eyebrow>You told me</Eyebrow>
        {notes.length === 0 ? (
          <T v="caption">Nothing yet. When you tell Rusty how you like to do things (“I practice best after dinner”), he’ll keep it here.</T>
        ) : (
          notes.map((n) => <NoteRow key={n.id} note={n} editing={editing === n.id} onEdit={() => setEditing(editing === n.id ? null : n.id)} />)
        )}
        <Field
          value={draft}
          onChangeText={setDraft}
          placeholder="Tell Rusty something about you…"
          onSubmitEditing={add}
          returnKeyType="done"
          accessibilityLabel="Something Rusty should remember about you"
        />
        <Button small variant="secondary" onPress={add} disabled={!draft.trim()}>
          Remember this
        </Button>
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>I noticed</Eyebrow>
        {noticed.length === 0 ? (
          <T v="caption">Not enough yet. After a few steps and focus sessions, Rusty starts noticing when and how you like to work.</T>
        ) : (
          noticed.map((n) => (
            <Card key={n.id} style={{ gap: space.xs }}>
              <T>{n.text}</T>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="caption" style={{ flex: 1 }}>
                  Because {n.because}
                </T>
                <Button
                  small
                  full={false}
                  variant="tertiary"
                  onPress={() => {
                    hideNoticed(n.id);
                    showToast('Okay, Rusty won’t use that.', () => unhideNoticed(n.id));
                  }}
                >
                  Not true
                </Button>
              </Row>
            </Card>
          ))
        )}
      </View>

      <Card style={{ gap: space.xs, backgroundColor: colors.muted }}>
        <T v="caption">
          Rusty uses this only to tailor his suggestions. It’s saved with your account and sent to his AI as a short summary, never your photos or
          location.
        </T>
        {(notes.length > 0 || noticed.length > 0) && (
          <Button
            small
            full={false}
            variant="tertiary"
            onPress={() => {
              const before = useStore.getState().profile.mind;
              forgetEverything();
              showToast('Rusty forgot everything.', () => {
                for (const n of before.notes ?? []) restoreNote(n);
                for (const id of before.hiddenNoticed ?? []) hideNoticed(id);
              });
            }}
          >
            Forget everything
          </Button>
        )}
      </Card>
    </Screen>
  );
}

function NoteRow({ note, editing, onEdit }: { note: RustyNote; editing: boolean; onEdit: () => void }) {
  const [text, setText] = useState(note.text);
  return (
    <Card style={{ gap: space.xs, borderRadius: radius.card }}>
      {editing ? (
        <>
          <Field value={text} onChangeText={setText} autoFocus accessibilityLabel="Edit what Rusty remembers" />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button small full={false} variant="tertiary" onPress={onEdit}>
              Cancel
            </Button>
            <Button
              small
              full={false}
              onPress={() => {
                if (text.trim()) editNote(note.id, text);
                onEdit();
              }}
            >
              Save
            </Button>
          </Row>
        </>
      ) : (
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T>{note.text}</T>
            <T v="caption">{note.source === 'you' ? `You added this · ${ago(note.at).toLowerCase()}` : `From a chat · ${ago(note.at).toLowerCase()}`}</T>
          </View>
          <IconButton name="pencil" label={`Edit: ${note.text}`} size={36} onPress={onEdit} color={colors.inkSoft} />
          <IconButton
            name="trash"
            label={`Forget: ${note.text}`}
            size={36}
            color={colors.inkSoft}
            onPress={() => {
              forgetNote(note.id);
              showToast('Forgotten.', () => restoreNote(note));
            }}
          />
        </Row>
      )}
    </Card>
  );
}
