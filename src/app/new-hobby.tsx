/**
 * Start a new hobby with Rusty (Task 2) — a chip-first chat:
 * what → goal or keep → (goal + path) or rhythm → tiny first step → when → 🐾 promise.
 * Rusty's goal ideas, path and first steps come from Claude (offline fallbacks).
 * The path is editable (A5 incident 5: testers tried to edit Rusty's steps).
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { suggestGoals, suggestPath } from '@/ai/rusty';
import { hobbyChoices, hobbyIcons, iconFor } from '@/assets';
import { WhenPicker, type WhenValue } from '@/components/WhenPicker';
import { BottomNav } from '@/components/BottomNav';
import { Icon } from '@/components/Icon';
import { Bubble, Button, Card, Chip, ChipRow, Eyebrow, IconButton, NavBar, OptionRow, Row, RustyAvatar, T, Typing } from '@/components/ui';
import { addMilestone, addPromise, createHobby, updateHobby } from '@/data/actions';
import { milestonesOf } from '@/data/selectors';
import { showToast, useStore } from '@/data/store';
import type { HobbyIcon } from '@/data/types';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Step = 'what' | 'kind' | 'goal' | 'path' | 'rhythm' | 'first' | 'when' | 'promise';
interface Msg {
  from: 'rusty' | 'user';
  text: string;
  /** for answers: the question it answered (tap to go back and change it) */
  step?: Step;
}

export default function NewHobby() {
  const { hobbyId } = useLocalSearchParams<{ hobbyId?: string }>();
  const existing = useStore((s) => (hobbyId ? s.hobbies[hobbyId] : undefined));
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [step, setStep] = useState<Step>(existing ? 'kind' : 'what');
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    existing
      ? [{ from: 'rusty', text: `Let’s set up ${existing.name.toLowerCase()}! Are you working toward a goal, or is it just for fun?` }]
      : [{ from: 'rusty', text: 'Which hobby would you like to make time for? Pick one, or type your own.' }],
  );
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<HobbyIcon>(existing?.icon ?? 'other');
  const [kind, setKind] = useState<'goal' | 'keep'>('goal');
  const [goal, setGoal] = useState('');
  const [goalIdeas, setGoalIdeas] = useState<string[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [firstIdeas, setFirstIdeas] = useState<string[]>([]);
  const [rhythm, setRhythm] = useState('');
  const [first, setFirst] = useState('');
  const [when, setWhen] = useState<WhenValue | null>(null);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [msgs, step, path, editing, typing]);

  // Answers remember which question they answered, so they can be changed.
  const say = (from: Msg['from'], text: string) => setMsgs((m) => [...m, { from, text, step: from === 'user' ? step : undefined }]);

  /** Go back to an earlier question (heuristic eval #15): drop everything after it. */
  const rewind = (i: number) => {
    const m = msgs[i];
    if (!m?.step) return;
    setMsgs(msgs.slice(0, i));
    setTyping(false);
    setBusy(false);
    setEditing(false);
    setStep(m.step);
  };

  /** Skip the rest of the setup (eval #18): the hobby is added, plan it later. */
  const skip = () => {
    if (existing) return router.back();
    const h = createHobby({ name, icon, kind: 'keep', milestones: [] });
    showToast(`Added ${name}. Plan it whenever you like.`);
    router.replace(`/hobby/${h.id}`);
  };
  const rustySoon = async (text: string, ms = 550) => {
    setTyping(true);
    await new Promise((r) => setTimeout(r, ms));
    setTyping(false);
    say('rusty', text);
  };

  /* ---- steps ---- */

  const pickHobby = async (n: string, i?: HobbyIcon) => {
    setName(n);
    setIcon(i ?? iconFor(n));
    say('user', n);
    setStep('kind');
    await rustySoon(`${n}! I love that. Are you working toward a goal, or is it just for fun?`);
  };

  const pickKind = async (k: 'goal' | 'keep') => {
    setKind(k);
    say('user', k === 'goal' ? 'Working toward a goal' : 'Just for fun');
    if (k === 'goal') {
      setStep('goal');
      setGoalIdeas([]);
      void suggestGoals(name).then(setGoalIdeas);
      await rustySoon('What would you love to do?');
    } else {
      setStep('rhythm');
      await rustySoon('No finish line, just more of it. How often would feel nice?');
    }
  };

  const pickGoal = async (g: string) => {
    setGoal(g);
    say('user', g);
    setStep('path');
    setBusy(true);
    setTyping(true);
    const p = await suggestPath(name, g);
    setTyping(false);
    setBusy(false);
    setPath(p.milestones);
    setFirstIdeas(p.firstSteps);
    say('rusty', 'Here’s a path I’d try. You can change anything:');
  };

  const pickRhythm = async (r: string) => {
    setRhythm(r);
    say('user', r);
    setStep('first');
    setFirstIdeas(
      icon === 'guitar'
        ? ['Play one song I know', 'Learn one new chord']
        : icon === 'reading'
          ? ['Read for 10 minutes', 'Pick my next book']
          : [`10 minutes of ${name.toLowerCase()}`, `Get my ${name.toLowerCase()} things out`],
    );
    await rustySoon('Let’s start tiny. What feels doable this week?');
  };

  const acceptPath = async (final: string[]) => {
    setEditing(false);
    setPath(final);
    // Echo back exactly what was saved, so nothing disappears silently.
    say('user', `Looks good:\n${final.map((m, i) => `${i + 1}. ${m}`).join('\n')}`);
    setStep('first');
    await rustySoon(
      `Saved all ${final.length}! You can change these anytime on ${name.toLowerCase()}’s page in Hobbies. Now let’s start tiny. What feels doable this week?`,
      800,
    );
  };

  const pickFirst = async (f: string) => {
    setFirst(f);
    say('user', f);
    setStep('when');
    await rustySoon('When can you do it?');
  };

  const pickWhen = async (w: WhenValue) => {
    setWhen(w);
    say('user', w.label);
    setStep('promise');
    // Eval #16: say what promising does (it saves the plan *and* commits to the first step).
    await rustySoon('Here’s your plan. Want to make it a paw promise? I’ll check in on your first step then.');
  };

  const promise = (withDay = true) => {
    const firstStep = { title: first, dueAt: withDay ? (when?.date ?? null) : null, timed: withDay ? when?.timed : false, minutes: 15 };
    if (existing) {
      updateHobby(existing.id, { kind, goal: kind === 'goal' ? goal : null, rhythm: kind === 'keep' ? rhythm : null });
      const already = milestonesOf(useStore.getState(), existing.id).length;
      const ms = kind === 'goal' && already === 0 ? path.map((t) => addMilestone(existing.id, t)) : [];
      addPromise({ hobbyId: existing.id, milestoneId: ms[0]?.id, title: first, dueAt: firstStep.dueAt, timed: firstStep.timed });
    } else {
      createHobby({
        name,
        icon,
        kind,
        goal: kind === 'goal' ? goal : undefined,
        rhythm: kind === 'keep' ? rhythm : undefined,
        milestones: kind === 'goal' ? path : [],
        firstStep,
      });
    }
    showToast(withDay ? `🐾 Promised! ${name} is ready to grow.` : `${name} is saved. Give the first step a day anytime.`);
    router.dismissTo('/hobbies');
  };

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    if (step === 'what') void pickHobby(t);
    else if (step === 'goal') void pickGoal(t);
    else if (step === 'first') void pickFirst(t);
    else if (step === 'rhythm') void pickRhythm(t);
  };
  const inputOpen = step === 'what' || step === 'goal' || step === 'first' || step === 'rhythm';
  const placeholder =
    step === 'what' ? 'Or type a hobby…' : step === 'goal' ? 'Describe your goal…' : step === 'first' ? 'Write my own…' : 'Or say it your way…';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <NavBar title={existing ? existing.name : 'New hobby'} backLabel={existing ? existing.name : 'Hobbies'} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <RustyAvatar pose={step === 'promise' ? 'baking' : 'wave'} size={110} />
        </View>
        {msgs.map((m, i) =>
          m.from === 'user' && m.step ? (
            <Animated.View key={i} entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-end' }}>
              <Pressable
                onPress={() => rewind(i)}
                accessibilityRole="button"
                accessibilityLabel={`Your answer: ${m.text}. Change it`}
                accessibilityHint="Goes back to this question"
                style={({ pressed }) => [{ alignItems: 'flex-end', gap: space.xs, maxWidth: '100%' }, pressed && { opacity: 0.7 }]}
              >
                <Bubble from="user">{m.text}</Bubble>
                <Row gap={4}>
                  <Icon name="pencil" size={13} color={colors.actionText} />
                  <T v="caption" color={colors.actionText}>
                    Change
                  </T>
                </Row>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View key={i} entering={FadeInUp.duration(220)} style={m.from === 'user' ? { alignItems: 'flex-end' } : undefined}>
              <Bubble from={m.from}>{m.text}</Bubble>
            </Animated.View>
          ),
        )}
        {typing && <Typing />}

        {/* ---- answers for the current step ---- */}
        {!typing && step === 'what' && (
          <ChipRow>
            {hobbyChoices.map((h) => (
              <Chip key={h.name} image={hobbyIcons[h.icon]} onPress={() => pickHobby(h.name, h.icon)}>
                {h.name}
              </Chip>
            ))}
            {/* any hobby at all (eval #37) */}
            <Chip custom onPress={() => inputRef.current?.focus()}>
              Something else…
            </Chip>
          </ChipRow>
        )}

        {!typing && step === 'kind' && (
          <View style={{ gap: space.sm }}>
            <OptionRow title="Working toward a goal" meta="Something with a finish line, like baking sourdough" onPress={() => pickKind('goal')} />
            <OptionRow title="Just for fun" meta="No finish line, just more of it in my week" onPress={() => pickKind('keep')} />
            <Button variant="tertiary" small onPress={skip}>
              {existing ? 'Not now' : 'Skip for now, I’ll plan it later'}
            </Button>
          </View>
        )}

        {!typing && step === 'goal' && (
          <ChipRow>
            {goalIdeas.length === 0 ? (
              <T v="caption">Rusty is thinking of ideas…</T>
            ) : (
              goalIdeas.map((g) => (
                <Chip key={g} onPress={() => pickGoal(g)}>
                  {g}
                </Chip>
              ))
            )}
          </ChipRow>
        )}

        {!typing && step === 'path' && path.length > 0 && (
          <PathEditor path={path} setPath={setPath} editing={editing} onAccept={acceptPath} onEdit={() => setEditing((e) => !e)} />
        )}

        {!typing && step === 'rhythm' && (
          <ChipRow>
            {['Once a week', 'A few times a week', 'Whenever I can'].map((r) => (
              <Chip key={r} onPress={() => pickRhythm(r)}>
                {r}
              </Chip>
            ))}
          </ChipRow>
        )}

        {!typing && step === 'first' && (
          <ChipRow>
            {firstIdeas.map((f) => (
              <Chip key={f} onPress={() => pickFirst(f)}>
                {f}
              </Chip>
            ))}
          </ChipRow>
        )}

        {!typing && step === 'when' && <WhenPicker onPick={pickWhen} hintKey="weekend" />}

        {!typing && step === 'promise' && (
          <PlanSummary
            name={name}
            icon={icon}
            kind={kind}
            goal={goal}
            rhythm={rhythm}
            path={path}
            first={first}
            when={when}
            onPromise={() => promise(true)}
            onSaveOnly={() => promise(false)}
          />
        )}
      </ScrollView>

      {inputOpen && !busy && (
        <View style={[styles.inputBar, { paddingBottom: space.sm }]}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            placeholderTextColor={colors.inkSoft}
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
            accessibilityLabel={placeholder}
          />
          <IconButton name="send" label="Send" onPress={send} color={colors.white} bg={input.trim() ? colors.action : '#F7B79A'} />
        </View>
      )}
      <BottomNav active="hobbies" />
    </View>
  );
}

/**
 * The end of the chat: the whole plan in one card and a big paw promise
 * (heuristic eval #16, #40 — the promise should stand out and say what it does).
 */
function PlanSummary({
  name,
  icon,
  kind,
  goal,
  rhythm,
  path,
  first,
  when,
  onPromise,
  onSaveOnly,
}: {
  name: string;
  icon: HobbyIcon;
  kind: 'goal' | 'keep';
  goal: string;
  rhythm: string;
  path: string[];
  first: string;
  when: WhenValue | null;
  onPromise: () => void;
  onSaveOnly: () => void;
}) {
  return (
    <Card style={{ gap: space.md, borderColor: colors.action, borderWidth: 1.5 }}>
      <Row gap={space.md}>
        <Image source={hobbyIcons[icon]} style={{ width: 56, height: 56 }} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Eyebrow>{kind === 'goal' ? 'Goal' : 'Just for fun'}</Eyebrow>
          <T v="title2">{kind === 'goal' ? goal : `${name} · ${rhythm}`}</T>
        </View>
      </Row>
      {kind === 'goal' && path.length > 0 && (
        <View style={{ gap: space.xs }}>
          <Eyebrow color={colors.inkSoft}>Milestones</Eyebrow>
          {path.map((m, i) => (
            <T key={`${i}-${m}`} v="callout">{`${i + 1}. ${m}`}</T>
          ))}
        </View>
      )}
      <View style={{ gap: space.xs, backgroundColor: '#FFF4EA', borderRadius: radius.input, padding: space.md }}>
        <Eyebrow color={colors.actionText}>First step</Eyebrow>
        <T v="headline">{first}</T>
        {when && <T v="caption">{`🐾 Planned for ${when.label.charAt(0).toLowerCase()}${when.label.slice(1)}`}</T>}
      </View>
      <Button variant="paw" onPress={onPromise} accessibilityLabel="Paw promise: save the plan and promise the first step" style={{ minHeight: 64 }}>
        I promise
      </Button>
      <T v="caption" center>
        Saves your plan and Rusty checks in on the first step. You can change anything later.
      </T>
      <Button variant="tertiary" small onPress={onSaveOnly}>
        Save the plan, pick a day later
      </Button>
    </Card>
  );
}

interface PathItem {
  id: string;
  text: string;
}
let nextId = 0;
const item = (text: string): PathItem => ({ id: `m${nextId++}`, text });

/**
 * Rusty's suggested milestones, editable in place. Every keystroke is kept
 * (no "commit on blur"), and "Looks good" also keeps a milestone that was
 * typed into the add box but not added yet — nothing is silently dropped.
 */
function PathEditor({
  path,
  setPath,
  editing,
  onAccept,
  onEdit,
}: {
  path: string[];
  setPath: (p: string[]) => void;
  editing: boolean;
  onAccept: (final: string[]) => void;
  onEdit: () => void;
}) {
  const [items, setItems] = useState<PathItem[]>(() => path.map(item));
  const [adding, setAdding] = useState('');
  const update = (next: PathItem[]) => {
    setItems(next);
    setPath(next.map((m) => m.text));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const add = () => {
    if (!adding.trim()) return;
    update([...items, item(adding.trim())]);
    setAdding('');
  };
  const finalList = () => [...items.map((m) => m.text), adding].map((t) => t.trim()).filter(Boolean);
  const count = finalList().length;

  return (
    <>
      <Card style={{ gap: space.xs, paddingVertical: space.sm }}>
        {items.map((m, i) => (
          <View key={m.id} style={styles.pathRow}>
            <View style={styles.num}>
              <T v="label" color={colors.white}>
                {i + 1}
              </T>
            </View>
            {editing ? (
              <TextInput
                value={m.text}
                onChangeText={(text) => update(items.map((x) => (x.id === m.id ? { ...x, text } : x)))}
                placeholder="Milestone"
                placeholderTextColor={colors.inkSoft}
                multiline
                submitBehavior="blurAndSubmit"
                style={[styles.input, styles.pathInput]}
                accessibilityLabel={`Milestone ${i + 1}`}
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={onEdit} accessibilityRole="button" accessibilityHint="Edit the path">
                <T v="body">{m.text}</T>
              </Pressable>
            )}
            {editing && (
              <View style={{ flexDirection: 'row' }}>
                <IconButton name="up" label={`Move milestone ${i + 1} up`} size={32} onPress={() => move(i, -1)} />
                <IconButton name="down" label={`Move milestone ${i + 1} down`} size={32} onPress={() => move(i, 1)} />
                <IconButton name="trash" label={`Remove milestone ${i + 1}`} size={32} onPress={() => update(items.filter((x) => x.id !== m.id))} />
              </View>
            )}
          </View>
        ))}
        {editing && (
          <View style={styles.pathRow}>
            <TextInput
              value={adding}
              onChangeText={setAdding}
              placeholder="+ Add a milestone"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { flex: 1, minHeight: 40 }]}
              onSubmitEditing={add}
              returnKeyType="done"
              accessibilityLabel="New milestone"
            />
            <IconButton name="plus" label="Add milestone" size={40} onPress={add} color={colors.actionText} />
          </View>
        )}
      </Card>
      <T v="caption" color={colors.inkSoft} style={{ textAlign: 'center' }}>
        {editing
          ? 'Change, reorder or remove anything. You can also edit this later on the hobby’s page.'
          : 'Not quite right? Tap “Edit milestones” (or any milestone). You can also change it later in Hobbies.'}
      </T>
      {/* one clear action per state: while editing you finish editing; when
          reviewing you either use the path or go back to editing it */}
      {editing ? (
        <Button icon="check" onPress={onEdit} disabled={count === 0}>
          Done editing
        </Button>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button onPress={() => onAccept(finalList())} disabled={count === 0}>
            {`Use these ${count} milestone${count === 1 ? '' : 's'}`}
          </Button>
          <Button variant="secondary" icon="pencil" onPress={onEdit}>
            Edit milestones
          </Button>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pathInput: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 14, fontSize: 16 },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
});
