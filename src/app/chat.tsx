/**
 * Talk to Rusty (Task 3). Real conversation via Claude, with Rusty's context
 * (your hobbies, this week, what's due). When you're stuck he shrinks the
 * step and offers "Do it now with me" or "Let's find a time".
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chat, chatStarters } from '@/ai/rusty';
import { WhenPicker } from '@/components/WhenPicker';
import { BottomNav } from '@/components/BottomNav';
import { Bubble, Button, Card, Chip, ChipRow, IconButton, NavBar, Row, T, Typing } from '@/components/ui';
import { addPromise } from '@/data/actions';
import { alive, put, remove, showToast, useDerived, useStore } from '@/data/store';
import type { ChatMessage, RustyNote, RustySuggestion } from '@/data/types';
import { forgetNote, remember, restoreNote } from '@/rusty/knows';
import { now } from '@/lib/time';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** When you came from a step ("Talk to Rusty" on a check-in): the usual reasons it's stuck. */
const ABOUT_STARTERS = ['It feels too big', 'No time today', 'I don’t feel like it'];

export default function Chat() {
  const { about } = useLocalSearchParams<{ about?: string }>();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const name = useStore((s) => s.profile.name);
  const aboutTask = useStore((s) => (about ? s.tasks[about] : undefined));
  const history = useDerived((s) => alive(s.messages).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  // Starters from your actual situation (what's due, what could wait, a hobby
  // you miss), then the last things you asked, so you don't retype them (eval #22).
  const startersNow = () => {
    const mine = alive(useStore.getState().messages)
      .filter((m) => m.role === 'user' && m.text.length <= 40)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => m.text);
    return [...new Set([...(aboutTask ? ABOUT_STARTERS : chatStarters()), ...mine])].slice(0, 5);
  };
  const [quick, setQuick] = useState<string[]>(startersNow);
  /** what Rusty learned from each of his replies (shown under it, with Undo) */
  const [learned, setLearned] = useState<Record<string, RustyNote[]>>({});
  const [planFor, setPlanFor] = useState<string | null>(null);
  const greeted = useRef(false);

  // Rusty opens the conversation (med-fi: "Hi Sam! What's going on?").
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const last = history.at(-1);
    const stale = !last || Date.now() - new Date(last.createdAt).getTime() > 30 * 60_000;
    if (stale) {
      put('messages', {
        role: 'rusty',
        text: aboutTask
          ? `Hi${name ? ` ${name}` : ''}! Let’s talk about “${aboutTask.title}”. What’s getting in the way?`
          : `Hi${name ? ` ${name}` : ''}! What’s going on?`,
        suggestion: null,
        createdAt: now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [history.length, thinking, planFor]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    setQuick([]);
    const before = alive(useStore.getState().messages).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    put('messages', { role: 'user', text: t, suggestion: null, createdAt: now() });
    setThinking(true);
    const res = await chat(before, t);
    setThinking(false);
    const msg = put('messages', { role: 'rusty', text: res.reply, suggestion: res.suggestion, createdAt: now() });
    const notes = remember(res.remember);
    if (notes.length) setLearned((l) => ({ ...l, [msg.id]: notes }));
    setQuick(res.quickReplies);
  };

  const clear = () => {
    for (const m of alive(useStore.getState().messages)) remove('messages', m.id);
    setQuick(startersNow());
    put('messages', { role: 'rusty', text: 'Fresh page! What’s on your mind?', suggestion: null, createdAt: now() });
  };

  const recent = history.slice(-40);
  const lastSuggestionId = [...recent].reverse().find((m) => m.suggestion)?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <NavBar title="Rusty" backLabel="Back" right={<IconButton name="trash" label="Clear conversation" onPress={clear} color={colors.inkSoft} />} />
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        {recent.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.duration(200)} style={m.role === 'user' ? { alignItems: 'flex-end' } : undefined}>
            <Bubble from={m.role === 'rusty' ? 'rusty' : 'user'}>{m.text}</Bubble>
            {learned[m.id] && <Learned notes={learned[m.id]} />}
            {m.suggestion && m.id === lastSuggestionId && (
              <SuggestionCard
                m={m}
                s={m.suggestion}
                planning={planFor === m.id}
                onPlan={() => setPlanFor(m.id)}
                onPlanned={() => setPlanFor(null)}
              />
            )}
          </Animated.View>
        ))}
        {thinking && <Typing />}
        {!thinking && quick.length > 0 && (
          <ChipRow style={{ justifyContent: 'flex-end' }}>
            {quick.map((q) => (
              <Chip key={q} onPress={() => send(q)}>
                {q}
              </Chip>
            ))}
          </ChipRow>
        )}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: space.sm }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type anything, or tap a suggestion"
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          multiline
          onSubmitEditing={() => send(input)}
          blurOnSubmit
          returnKeyType="send"
          accessibilityLabel="Message to Rusty"
        />
        <IconButton name="send" label="Send" onPress={() => send(input)} color={colors.white} bg={input.trim() ? colors.action : '#F7B79A'} />
      </View>
      <BottomNav active="index" />
    </KeyboardAvoidingView>
  );
}

/** "Rusty will remember: …" — learning is visible, and one tap undoes each. */
function Learned({ notes }: { notes: RustyNote[] }) {
  const stored = useStore((s) => s.profile.mind.notes);
  const kept = new Set((stored ?? []).map((n) => n.id));
  return (
    <View style={styles.learned} accessibilityLiveRegion="polite">
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="caption" color={colors.inkSoft}>
          📝 Rusty will remember
        </T>
        <Button small full={false} variant="tertiary" onPress={() => router.push('/knows')}>
          See all
        </Button>
      </Row>
      {notes.map((n) => {
        const on = kept.has(n.id);
        return (
          <Row key={n.id} style={{ justifyContent: 'space-between' }}>
            <T v="caption" color={on ? colors.ink : colors.inkSoft} style={[{ flex: 1 }, !on && { textDecorationLine: 'line-through' }]}>
              {n.text}
            </T>
            <Button small full={false} variant="tertiary" onPress={() => (on ? forgetNote(n.id) : restoreNote(n))} accessibilityLabel={on ? `Forget: ${n.text}` : `Keep: ${n.text}`}>
              {on ? 'Undo' : 'Keep'}
            </Button>
          </Row>
        );
      })}
    </View>
  );
}

function SuggestionCard({
  m,
  s,
  planning,
  onPlan,
  onPlanned,
}: {
  m: ChatMessage;
  s: RustySuggestion;
  planning: boolean;
  onPlan: () => void;
  onPlanned: () => void;
}) {
  const hobby = useStore((st) => (s.hobbyId ? st.hobbies[s.hobbyId] : undefined));
  return (
    <Card style={{ gap: space.sm, marginTop: space.sm, marginLeft: 44 }}>
      <T v="title2">{s.title}</T>
      <T v="caption">
        {hobby ? `${hobby.name} · ` : ''}
        {s.minutes} min
      </T>
      {planning ? (
        <WhenPicker
          onPick={(w) => {
            if (hobby) addPromise({ hobbyId: hobby.id, title: s.title, minutes: s.minutes, dueAt: w.date, timed: w.timed });
            showToast(`🐾 Paw promise: ${w.label.toLowerCase()}.`);
            onPlanned();
          }}
        />
      ) : (
        <>
          <Button
            onPress={() =>
              router.push({
                pathname: '/focus/setup',
                params: { title: s.title, minutes: String(s.minutes), hobbyId: s.hobbyId ?? '', from: m.id },
              })
            }
          >
            Do it now with me
          </Button>
          {hobby && (
            <Button variant="secondary" onPress={onPlan}>
              Let’s find a time
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  learned: {
    gap: 0,
    marginTop: space.xs,
    marginLeft: 44,
    paddingLeft: space.md,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    borderRadius: radius.input,
    backgroundColor: colors.whiteSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.whiteSoft,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.input + 6,
    backgroundColor: colors.muted,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
});
