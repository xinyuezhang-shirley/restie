/**
 * Talk to Rusty (Task 3) — a chat that does things, not just talks.
 *
 * Rusty works out what you mean, and connects it to the app:
 *   "how's your day?"          → he answers as himself (what he's actually
 *                                 doing in the room), then asks what you'd
 *                                 like: just chat, start a hobby, get unstuck
 *                                 on one of yours, or log something
 *   "I just practiced guitar"  → logged right away (matched to your step or
 *                                 hobby), with Undo; asks which hobby if unsure
 *   "I'm stuck on drawing"     → one tiny step: do it now / find a time
 *   "I want to try pottery"    → set it up together (the new-hobby flow)
 *   "remind me to do laundry"  → a to-do, on the right day, with Undo
 *   "I'm so tired"             → what could wait today, with one tap to move it
 * He remembers what you tell him about yourself (shown, with Undo), and his
 * opening line uses what he knows: what he's up to, your good time of day,
 * what's due.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chat, chatStarters, type ChatReply } from '@/ai/rusty';
import { hobbyChoices, hobbyIcons } from '@/assets';
import { BottomNav } from '@/components/BottomNav';
import { Icon } from '@/components/Icon';
import { Bubble, Button, Card, Chip, ChipRow, IconButton, NavBar, Row, T, Typing } from '@/components/ui';
import { WhenPicker } from '@/components/WhenPicker';
import { addPromise, addTodo, completeTask, decideSkip, deleteTask, logFreeform, reopenTask, setMilestoneDone } from '@/data/actions';
import { checkinOf, hobbiesOf, openTasks, skipSuggestionOf } from '@/data/selectors';
import { alive, put, remove, showToast, useStore } from '@/data/store';
import type { ChatMessage, RustyNote, RustySuggestion } from '@/data/types';
import { now, resolveWhen } from '@/lib/time';
import { rustyBus } from '@/rusty/brain';
import { forgetNote, noticedOf, remember, restoreNote } from '@/rusty/knows';
import { rustyNow } from '@/rusty/now';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** When you came from a step ("Talk to Rusty" on a check-in): the usual reasons it's stuck. */
const ABOUT_STARTERS = ['It feels too big', 'No time today', 'I don’t feel like it'];

/** What happened because of a message (shown under Rusty's reply). */
type Action =
  | { kind: 'logged'; taskId: string; title: string; sub: string; freeform: boolean; milestoneId?: string; milestoneTitle?: string }
  | { kind: 'which_hobby'; what: string }
  | { kind: 'todo'; taskId: string; title: string; when: string }
  | { kind: 'new_hobby'; name: string }
  | { kind: 'modes' }
  | { kind: 'wait'; taskId: string; title: string; reason: string };

/** Rusty's first line: what he's up to, what he knows about you, what's due. */
function openerFor(name: string): string {
  const s = useStore.getState();
  const hi = `Hi${name ? ` ${name}` : ''}!`;
  const doing = Date.now() - rustyNow.at < 30 * 60_000 ? rustyNow.doing.replace(/^Rusty is /, '').replace(/\.$/, '') : '';
  const me = doing ? ` I was just ${doing}.` : '';
  const time = noticedOf(s).find((n) => n.id === 'time');
  const h = new Date().getHours();
  const bucket = h >= 5 && h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'late at night';
  const yours = time?.text.endsWith(bucket) ? ` It’s ${bucket === 'late at night' ? 'late' : `the ${bucket}`}, your usual hobby time.` : '';
  const due = checkinOf(s);
  const today = due ? ` “${due.title}” is on today’s list, no pressure.` : '';
  return `${hi}${me}${yours}${today} What’s up?`;
}

export default function Chat() {
  const { about } = useLocalSearchParams<{ about?: string }>();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const name = useStore((s) => s.profile.name);
  const aboutTask = useStore((s) => (about ? s.tasks[about] : undefined));
  const all = useStore((s) => s.messages);
  const history = alive(all).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
  const [planFor, setPlanFor] = useState<string | null>(null);
  /** what Rusty learned from each of his replies (shown under it, with Undo) */
  const [learned, setLearned] = useState<Record<string, RustyNote[]>>({});
  /** what each reply did (logged a step, added a to-do…), shown under it */
  const [actions, setActions] = useState<Record<string, Action>>({});
  /** Rusty just asked "which hobby?" → the next message names it */
  const [expect, setExpect] = useState<'new_hobby' | undefined>();
  const greeted = useRef(false);

  const rustySays = (text: string, action?: Action) => {
    const m = put('messages', { role: 'rusty', text, suggestion: null, createdAt: now() });
    if (action) setActions((a) => ({ ...a, [m.id]: action }));
    return m;
  };

  // Rusty opens the conversation, from what he knows.
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const last = history.at(-1);
    const stale = !last || Date.now() - new Date(last.createdAt).getTime() > 30 * 60_000;
    if (stale) {
      const text = aboutTask ? `Hi${name ? ` ${name}` : ''}! Let’s talk about “${aboutTask.title}”. What’s getting in the way?` : openerFor(name);
      put('messages', { role: 'rusty', text, suggestion: null, createdAt: now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [history.length, thinking, planFor, actions]);

  /** Turn what Rusty understood into the app doing it. */
  const act = (res: ChatReply): Action | undefined => {
    const s = useStore.getState();
    const hobbies = hobbiesOf(s);
    const byName = (n: string) => hobbies.find((h) => h.name.toLowerCase() === n.toLowerCase());
    if (res.intent === 'smalltalk') return { kind: 'modes' };
    if (res.log) {
      const task = res.log.step ? openTasks(s).find((t) => t.title.toLowerCase() === res.log!.step.toLowerCase()) : undefined;
      const hobby = (task?.hobbyId ? s.hobbies[task.hobbyId] : undefined) ?? byName(res.log.hobby);
      if (task) {
        const r = completeTask(task.id);
        rustyBus.getState().queue('celebrate');
        return {
          kind: 'logged',
          taskId: task.id,
          title: task.title,
          sub: r?.milestone && r.stepsTotal ? `${hobby?.name ?? ''} · ${r.stepsDone} of ${r.stepsTotal} in “${r.milestone.title}”` : (hobby?.name ?? 'To-do'),
          freeform: false,
          ...(r?.milestoneReady && r.milestone ? { milestoneId: r.milestone.id, milestoneTitle: r.milestone.title } : {}),
        };
      }
      const what = cap(res.log.what || 'Worked on it');
      if (hobby) {
        const r = logFreeform(hobby.id, what);
        rustyBus.getState().queue('celebrate');
        if (r) return { kind: 'logged', taskId: r.task.id, title: what, sub: hobby.name, freeform: true };
      }
      return { kind: 'which_hobby', what };
    }
    if (res.todo) {
      const date = res.todo.when === 'none' ? null : resolveWhen(res.todo.when);
      const t = addTodo(res.todo.title, date, 'normal');
      const when = { today: 'Today', tomorrow: 'Tomorrow', weekend: 'This weekend', none: 'No day yet' }[res.todo.when];
      return { kind: 'todo', taskId: t.id, title: res.todo.title, when };
    }
    if (res.newHobby) return { kind: 'new_hobby', name: res.newHobby };
    if (res.intent === 'overwhelmed') {
      const skip = skipSuggestionOf(s);
      if (skip) return { kind: 'wait', taskId: skip.task.id, title: skip.task.title, reason: skip.reason };
    }
    return undefined;
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    setQuick([]);
    const before = alive(useStore.getState().messages).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    put('messages', { role: 'user', text: t, suggestion: null, createdAt: now() });
    setThinking(true);
    const res = await chat(before, t, expect);
    setExpect(undefined);
    setThinking(false);
    const msg = put('messages', { role: 'rusty', text: res.reply, suggestion: res.suggestion, createdAt: now() });
    const notes = remember(res.remember);
    if (notes.length) setLearned((l) => ({ ...l, [msg.id]: notes }));
    const a = act(res);
    if (a) setActions((x) => ({ ...x, [msg.id]: a }));
    setQuick(res.quickReplies);
  };

  /** The "what would you like to do?" choices after small talk. */
  const pickMode = (mode: 'chat' | 'new' | 'log' | { stuck: string }) => {
    put('messages', {
      role: 'user',
      text: mode === 'chat' ? 'Just chatting' : mode === 'new' ? 'Start a new hobby' : mode === 'log' ? 'Log something I did' : `I’m stuck on ${mode.stuck.toLowerCase()}`,
      suggestion: null,
      createdAt: now(),
    });
    if (mode === 'chat') {
      rustySays('yay. I love just hanging out. tell me anything, I’m all ears (they’re big).');
      setQuick(['What did you do today?', 'Tell me a cat fact', 'What’s outside?']);
    } else if (mode === 'new') {
      setExpect('new_hobby');
      rustySays('ooh, something new! which hobby? type it, or pick one.');
      const have = new Set(hobbiesOf(useStore.getState()).map((h) => h.icon));
      setQuick(hobbyChoices.filter((h) => !have.has(h.icon)).map((h) => h.name).slice(0, 4));
    } else if (mode === 'log') {
      rustySays('yes! what did you do? say it however you like, like “practiced guitar for 20 minutes”.');
      setQuick([]);
    } else {
      void send(`I’m stuck on ${mode.stuck.toLowerCase()}. Help me start?`);
    }
  };

  const clear = () => {
    for (const m of alive(useStore.getState().messages)) remove('messages', m.id);
    setActions({});
    setLearned({});
    setQuick(startersNow());
    rustySays('Fresh page! What’s on your mind?');
  };

  const recent = history.slice(-40);
  const lastSuggestionId = [...recent].reverse().find((m) => m.suggestion)?.id;
  const lastId = recent.at(-1)?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <NavBar
          title="Rusty"
          backLabel="Back"
          right={
            <Row gap={0}>
              <IconButton name="sparkle" label="What Rusty knows about you" onPress={() => router.push('/knows')} color={colors.inkSoft} />
              <IconButton name="trash" label="Clear conversation" onPress={clear} color={colors.inkSoft} />
            </Row>
          }
        />
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        {recent.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.duration(200)} style={m.role === 'user' ? { alignItems: 'flex-end' } : undefined}>
            <Bubble from={m.role === 'rusty' ? 'rusty' : 'user'}>{m.text}</Bubble>
            {learned[m.id] && <Learned notes={learned[m.id]} />}
            {actions[m.id] && (
              <ActionCard
                action={actions[m.id]}
                live={m.id === lastId}
                onMode={pickMode}
                onUpdate={(a) => setActions((x) => ({ ...x, [m.id]: a }))}
                onSay={(t) => rustySays(t)}
              />
            )}
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
          placeholder={expect === 'new_hobby' ? 'Which hobby? e.g. pottery' : 'Tell Rusty anything, even “I just did…”'}
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

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** What a reply did, with the controls to change it. */
function ActionCard({
  action: a,
  live,
  onMode,
  onUpdate,
  onSay,
}: {
  action: Action;
  /** only the latest card offers choices (older ones are a record) */
  live: boolean;
  onMode: (m: 'chat' | 'new' | 'log' | { stuck: string }) => void;
  onUpdate: (a: Action) => void;
  onSay: (t: string) => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const hobbiesMap = useStore((s) => s.hobbies);
  const ledger = useStore((s) => s.profile.mind.skipLedger);
  const hobbies = Object.values(hobbiesMap).filter((h) => !h.deletedAt && h.status === 'active');

  if (a.kind === 'modes') {
    if (!live) return null;
    // the hobby that's due first, then the one you haven't touched longest
    const due = checkinOf(useStore.getState())?.hobbyId;
    const stuck = [...hobbies]
      .sort((x, y) => (x.id === due ? -1 : y.id === due ? 1 : (x.lastDoneAt ?? '').localeCompare(y.lastDoneAt ?? '')))
      .slice(0, 2);
    return (
      <Card style={styles.action}>
        <T v="caption">Anything I can help with? Or we can just chat.</T>
        <ChipRow>
          <Chip icon="chat" onPress={() => onMode('chat')}>
            Just chatting
          </Chip>
          <Chip icon="check" onPress={() => onMode('log')}>
            Log something I did
          </Chip>
          <Chip icon="plus" onPress={() => onMode('new')}>
            Start a new hobby
          </Chip>
          {stuck.map((h) => (
            <Chip key={h.id} image={hobbyIcons[h.icon]} onPress={() => onMode({ stuck: h.name })}>
              {`Stuck on ${h.name.toLowerCase()}`}
            </Chip>
          ))}
        </ChipRow>
      </Card>
    );
  }

  if (a.kind === 'logged') {
    const open = tasks[a.taskId]?.status !== 'done';
    return (
      <Card style={styles.action}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={[styles.tick, open && { backgroundColor: colors.border }]}>
            <Icon name="check" size={16} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="headline" style={open ? { textDecorationLine: 'line-through', color: colors.inkSoft } : undefined}>
              {a.title}
            </T>
            <T v="caption">{open ? 'Not logged (undone)' : `Logged · ${a.sub}`}</T>
          </View>
          <Button
            small
            full={false}
            variant="tertiary"
            onPress={() => {
              if (open) {
                completeTask(a.taskId);
                return;
              }
              reopenTask(a.taskId);
              if (a.freeform) {
                deleteTask(a.taskId);
                onUpdate({ kind: 'which_hobby', what: a.title });
              }
            }}
          >
            {open ? 'Log it' : 'Undo'}
          </Button>
        </Row>
        {!open && a.milestoneId && (
          <View style={{ gap: space.xs }}>
            <T v="caption">{`That was the last step of “${a.milestoneTitle}”. Mark the milestone done?`}</T>
            <Button
              small
              onPress={() => {
                setMilestoneDone(a.milestoneId!, true);
                onUpdate({ ...a, milestoneId: undefined });
                showToast(`Milestone done: ${a.milestoneTitle} 🎉`, () => setMilestoneDone(a.milestoneId!, false));
              }}
            >
              Mark it done
            </Button>
          </View>
        )}
      </Card>
    );
  }

  if (a.kind === 'which_hobby') {
    if (!live) return null;
    return (
      <Card style={styles.action}>
        <T v="caption">{`Which hobby was “${a.what}” for? I’ll log it there.`}</T>
        <ChipRow>
          {hobbies.map((h) => (
            <Chip
              key={h.id}
              image={hobbyIcons[h.icon]}
              onPress={() => {
                const r = logFreeform(h.id, a.what);
                rustyBus.getState().queue('celebrate');
                if (r) onUpdate({ kind: 'logged', taskId: r.task.id, title: a.what, sub: h.name, freeform: true });
              }}
            >
              {h.name}
            </Chip>
          ))}
          <Chip icon="plus" onPress={() => router.push({ pathname: '/new-hobby', params: { text: a.what } })}>
            It’s a new hobby
          </Chip>
          <Chip
            onPress={() => {
              onUpdate({ kind: 'modes' });
              onSay('not a hobby? still counts. I’m proud of you anyway.');
            }}
          >
            Not a hobby
          </Chip>
        </ChipRow>
      </Card>
    );
  }

  if (a.kind === 'todo') {
    const gone = !tasks[a.taskId] || !!tasks[a.taskId]?.deletedAt;
    return (
      <Card style={styles.action}>
        <Row>
          <Icon name="todos" size={20} color={colors.actionText} />
          <View style={{ flex: 1 }}>
            <T v="headline">{a.title}</T>
            <T v="caption">{gone ? 'Removed' : `Added to To-dos · ${a.when}`}</T>
          </View>
          {!gone && (
            <Button small full={false} variant="tertiary" onPress={() => deleteTask(a.taskId)}>
              Undo
            </Button>
          )}
        </Row>
        {!gone && live && (
          <Button small variant="secondary" onPress={() => router.push('/todos')}>
            See my to-dos
          </Button>
        )}
      </Card>
    );
  }

  if (a.kind === 'new_hobby') {
    const existing = hobbies.find((h) => h.name.toLowerCase() === a.name.toLowerCase());
    return (
      <Card style={styles.action}>
        {existing ? (
          <>
            <T v="caption">{`You already have ${existing.name}.`}</T>
            <Button small onPress={() => router.push(`/hobby/${existing.id}`)}>
              {`Open ${existing.name}`}
            </Button>
          </>
        ) : (
          <>
            <T v="headline">{a.name}</T>
            <T v="caption">A goal, a few milestones and one tiny first step. About a minute.</T>
            <Button small onPress={() => router.push({ pathname: '/new-hobby', params: { text: a.name } })}>
              {`Set up ${a.name} with Rusty`}
            </Button>
          </>
        )}
      </Card>
    );
  }

  // a.kind === 'wait': what could wait today
  const decided = ledger.find((l) => l.taskId === a.taskId)?.decision;
  return (
    <Card style={styles.action}>
      <T v="caption">Could wait</T>
      <T v="headline">{a.title}</T>
      <T v="caption">{a.reason}</T>
      {decided ? (
        <T v="caption" color={colors.successText}>
          {decided === 'later' ? 'Moved to later ✓' : decided === 'keep' ? 'Kept for today ✓' : 'Let go ✓'}
        </T>
      ) : (
        live && (
          <Row>
            <Button small full={false} onPress={() => decideSkip(a.taskId, 'later')}>
              Move it to later
            </Button>
            <Button small full={false} variant="tertiary" onPress={() => decideSkip(a.taskId, 'keep')}>
              Keep it today
            </Button>
          </Row>
        )
      )}
    </Card>
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
            <Button
              small
              full={false}
              variant="tertiary"
              onPress={() => (on ? forgetNote(n.id) : restoreNote(n))}
              accessibilityLabel={on ? `Forget: ${n.text}` : `Keep: ${n.text}`}
            >
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
  action: { gap: space.sm, marginTop: space.sm, marginLeft: 44 },
  tick: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.done, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  learned: {
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
