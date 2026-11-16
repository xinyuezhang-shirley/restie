/**
 * Restie's shared components (mirrors medfi-src/src/components/ui.tsx).
 * Use these instead of one-off styles so every screen feels like one app.
 */
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { poses, type PoseImage } from '@/assets';
import { colors, fonts, radius, shadows, space, touch, type } from '@/theme/tokens';

import { BottomNav, type TabKey } from './BottomNav';
import { Icon, type IconName } from './Icon';

export const tap = (style: 'light' | 'medium' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (style === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(style === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
};

/* ------------------------------------------------------------------- text */

/**
 * Text shrinks and wraps inside rows instead of running off the card, and
 * long words (names, links) break rather than overflow.
 */
const textBase: TextStyle = Platform.OS === 'web' ? ({ flexShrink: 1, minWidth: 0, wordBreak: 'break-word' } as TextStyle) : { flexShrink: 1 };

export function T({
  v = 'body',
  style,
  color,
  center,
  ...rest
}: TextProps & { v?: keyof typeof type; color?: string; center?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[textBase, type[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}

/* ---------------------------------------------------------------- buttons */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'paw';

export function Button({
  children,
  variant = 'primary',
  icon,
  onPress,
  disabled,
  loading,
  full = true,
  style,
  small,
  accessibilityLabel,
}: {
  children: ReactNode;
  variant?: Variant;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const filled = variant === 'primary' || variant === 'paw';
  const fg = filled ? colors.white : colors.actionText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => {
        tap(variant === 'paw' ? 'medium' : 'light');
        onPress?.();
      }}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        full && { alignSelf: 'stretch' },
        variant === 'primary' && { backgroundColor: pressed ? '#E4672F' : colors.action },
        variant === 'paw' && { backgroundColor: pressed ? '#E4672F' : colors.action },
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderWidth: 1.5,
          borderColor: colors.actionText,
        },
        variant === 'tertiary' && { backgroundColor: pressed ? colors.muted : 'transparent' },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {variant === 'paw' && <Icon name="paw" size={20} color={fg} />}
          {icon && <Icon name={icon} size={20} color={fg} />}
          <Text style={[type.headline, { color: fg }, small && { fontSize: 15 }]}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Back and forward arrows share one size everywhere (heuristic eval #4, #8). */
export const CHEVRON = 24;

/**
 * Rounded reply option under Rusty's messages. `custom` marks the "do it your
 * own way" option (Pick a time, Type my own…) with a dashed outline so it
 * reads differently from preset answers (heuristic eval #39).
 */
export function Chip({
  children,
  selected,
  onPress,
  image,
  hint,
  custom,
  icon,
  style,
}: {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  image?: number;
  hint?: boolean;
  custom?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.chip,
        selected && { backgroundColor: colors.action, borderColor: colors.action },
        hint && !selected && { borderColor: colors.action, borderWidth: 2 },
        custom && !selected && { borderStyle: 'dashed', borderColor: colors.actionText, backgroundColor: colors.whiteSoft },
        pressed && !selected && { backgroundColor: colors.bubbleRusty },
        style,
      ]}
    >
      {image ? <Image source={image} style={{ width: 26, height: 26 }} contentFit="contain" /> : null}
      {icon || custom ? <Icon name={icon ?? 'pencil'} size={16} color={selected ? colors.white : colors.actionText} /> : null}
      <Text numberOfLines={2} style={[textBase, type.label, { fontSize: 15 }, custom && { color: colors.actionText }, selected && { color: colors.white }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, style]}>{children}</View>;
}

/** Full-width selectable row (two-choice chat questions, setup radios). */
export function OptionRow({
  title,
  meta,
  onPress,
  selected,
  radio,
  right,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  selected?: boolean;
  radio?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.option,
        selected && { borderColor: colors.action, backgroundColor: '#FFF4EC' },
        pressed && { backgroundColor: colors.muted },
      ]}
    >
      {radio && (
        <View style={[s.radio, selected && { borderColor: colors.action }]}>
          {selected && <View style={s.radioDot} />}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T v="headline">{title}</T>
        {meta ? <T v="caption">{meta}</T> : null}
      </View>
      {right ?? (!radio && <Icon name="right" size={CHEVRON} color={colors.inkSoft} />)}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ cards */

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.99 }], backgroundColor: '#FFFCF8' }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export const Eyebrow = ({ children, color }: { children: ReactNode; color?: string }) => (
  <T v="eyebrow" color={color} accessibilityRole="header">
    {typeof children === 'string' ? children.toUpperCase() : children}
  </T>
);

export function Tag({ children, color = colors.tagNew }: { children: ReactNode; color?: string }) {
  return (
    <View style={[s.tag, { backgroundColor: color }]}>
      <T v="label" style={{ fontSize: 12, lineHeight: 16 }}>
        {children}
      </T>
    </View>
  );
}

/** ●●○ — filled done, outlined current, faint upcoming. */
export function ProgressDots({
  done,
  total,
  size = 10,
  current = true,
}: {
  done: number;
  total: number;
  size?: number;
  current?: boolean;
}) {
  return (
    <View
      style={{ flexDirection: 'row', gap: size * 0.6 }}
      accessible
      accessibilityLabel={`${done} of ${total} done`}
    >
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: i < done ? colors.action : 'transparent',
            borderWidth: 1.5,
            borderColor: i < done ? colors.action : i === done && current ? colors.action : '#E8CDB3',
          }}
        />
      ))}
    </View>
  );
}

/**
 * "2 of 4 steps" with a bar — the one progress visual for milestones, steps
 * and substeps (dots stay for small fixed counts like the tour).
 */
export function ProgressBar({
  done,
  total,
  label,
  height = 8,
  color = colors.action,
  style,
}: {
  done: number;
  total: number;
  /** text after the bar, e.g. "2 of 4 steps" */
  label?: string;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const complete = total > 0 && done >= total;
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ? `${label} done` : `${done} of ${total} done`}
      accessibilityValue={{ min: 0, max: Math.max(total, 1), now: done }}
    >
      <View style={{ flex: 1, height, borderRadius: height, backgroundColor: '#F3E2CE', overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: complete ? colors.done : color }} />
      </View>
      {label ? (
        <T v="caption" color={complete ? colors.successText : colors.inkSoft} style={{ fontFamily: fonts.bodyBold }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- inputs */

export const Field = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { label?: string }>(function Field({ label, style, ...rest }, ref) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Eyebrow color={colors.inkSoft}>{label}</Eyebrow> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkSoft}
        {...rest}
        style={[s.input, rest.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: space.md }, style as TextStyle]}
      />
    </View>
  );
});

/* ------------------------------------------------------------- navigation */

/** Back chevron + destination label, centered title (med-fi nav bar). */
export function NavBar({
  title,
  backLabel,
  onBack,
  right,
  close,
}: {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** show an × instead of a back chevron (modals, camera, focus) */
  close?: boolean;
}) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={s.nav}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        {backLabel !== undefined || close ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={close ? 'Close' : `Back to ${backLabel}`}
            onPress={back}
            hitSlop={10}
            style={({ pressed }) => [s.back, { maxWidth: '100%' }, pressed && { opacity: 0.6 }]}
          >
            <Icon name={close ? 'close' : 'back'} color={colors.actionText} />
            {!close && backLabel ? <T v="headline" color={colors.actionText} numberOfLines={1}>{backLabel}</T> : null}
          </Pressable>
        ) : null}
      </View>
      {title ? (
        // up to two lines: a page's title is often a name (never cut a name short)
        <T v="headline" numberOfLines={2} style={{ flex: 2, textAlign: 'center', paddingHorizontal: space.xs }} accessibilityRole="header">
          {title}
        </T>
      ) : (
        <View style={{ flex: 2 }} />
      )}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Paper background + safe areas + optional scrolling. */
export function Screen({
  children,
  scroll = true,
  nav,
  footer,
  contentStyle,
  bg = colors.paper,
  padded = true,
  scrollRef,
  tab,
  ...scrollProps
}: {
  children: ReactNode;
  scroll?: boolean;
  nav?: ReactNode;
  footer?: ReactNode;
  /** pages pushed over the tabs: show the bottom nav, with this tab lit */
  tab?: TabKey;
  contentStyle?: StyleProp<ViewStyle>;
  bg?: string;
  padded?: boolean;
  scrollRef?: React.Ref<ComponentRef<typeof ScrollView>>;
} & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: space.lg } : null;
  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {nav}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[pad, { paddingBottom: footer ? space.lg : tab ? space.xl : insets.bottom + 96, gap: space.lg }, contentStyle]}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View style={[pad, { paddingBottom: tab ? space.md : Math.max(insets.bottom, space.lg), paddingTop: space.sm, gap: space.sm }]}>{footer}</View>
      ) : null}
      {tab ? <BottomNav active={tab} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ Rusty */

/** Small still Rusty for chat bubbles, cards and sheets. */
export function RustyAvatar({ pose = 'idle', size = 44, style }: { pose?: PoseImage; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }, style]}
      accessible
      accessibilityLabel="Rusty"
    >
      <Image source={poses[pose]} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}

/** Rusty's chat bubble (peach, left) or yours (blue, right). */
export function Bubble({ from, children, avatar = true }: { from: 'rusty' | 'user'; children: ReactNode; avatar?: boolean }) {
  if (from === 'user') {
    return (
      <View style={[s.bubble, s.userBubble]}>
        <T>{children}</T>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, maxWidth: '88%' }}>
      {avatar ? <RustyAvatar size={36} /> : <View style={{ width: 36 }} />}
      <View style={[s.bubble, s.rustyBubble]}>
        {typeof children === 'string' ? <T>{children}</T> : children}
      </View>
    </View>
  );
}

export function Typing() {
  return (
    <Bubble from="rusty">
      <T color={colors.inkSoft}>Rusty is thinking…</T>
    </Bubble>
  );
}

/* ---------------------------------------------------------------- layout */

export const Row = ({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Spacer = ({ h = space.lg }: { h?: number }) => <View style={{ height: h }} />;

export function IconButton({
  name,
  onPress,
  label,
  color = colors.ink,
  bg,
  size = touch,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
} & Pick<PressableProps, 'hitSlop'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size, alignItems: 'center', justifyContent: 'center', backgroundColor: bg },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: space.lg },
  chip: {
    maxWidth: '100%',
    minHeight: touch,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  option: {
    minHeight: 60,
    borderRadius: radius.input,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D9C2A7', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.action },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  input: {
    minHeight: 52,
    borderRadius: radius.input,
    backgroundColor: colors.muted,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
  nav: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: touch, paddingRight: space.sm },
  bubble: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: 20, flexShrink: 1 },
  rustyBubble: { backgroundColor: colors.bubbleRusty, borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: colors.bubbleUser, alignSelf: 'flex-end', maxWidth: '80%', borderBottomRightRadius: 6 },
});
