/**
 * Restie design tokens — carried over 1:1 from the med-fi design system
 * (medfi-src/design-system.md and src/index.css) so the hi-fi stays consistent.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  paper: '#FFF8EC', // main background
  card: '#FFFFFF', // cards, modals, sheets
  muted: '#FFF1E2', // inputs, unselected chips
  border: '#F1E3CF', // borders, dividers
  ink: '#4A2418', // headings, body text
  inkSoft: '#8A6355', // dates, captions, placeholders
  action: '#F97940', // buttons, active tab, progress dots
  actionText: '#B04418', // text links, button outlines
  accent: '#FF9969', // Rusty, illustrations (never behind text)
  done: '#8DB255', // completed steps, checkmarks
  doneEdge: '#6F9238',
  successSurface: '#E6F2CC', // toasts, logged states
  successText: '#4F6E22',
  bubbleRusty: '#FFE3D2',
  bubbleUser: '#E3F0F2',
  tagNew: '#ADCCD1',
  scrim: 'rgba(74,36,24,0.36)',
  canvas: '#F3E6D3',
  cameraBg: '#282522',
  white: '#FFFFFF',
  whiteSoft: '#FFFDF8',
  noteYellow: '#F3D895',
  notePurple: '#D7C1DE',
  toast: '#405045',
} as const;

export const fonts = {
  heading: 'Fredoka_600SemiBold',
  headingMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtra: 'Nunito_800ExtraBold',
} as const;

/** Type scale from the design system (size / line height). */
export const type = {
  display: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: colors.ink },
  title1: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  title2: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: colors.ink },
  headline: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink },
  callout: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  eyebrow: {
    fontFamily: fonts.bodyExtra,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    color: colors.actionText,
  },
  timer: { fontFamily: fonts.headingMedium, fontSize: 52, lineHeight: 60, color: colors.ink },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { card: 20, input: 16, sheet: 24, pill: 999 } as const;
export const touch = 44;

const shadow = (y: number, blur: number, opacity: number): ViewStyle =>
  Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(74,36,24,${opacity})` } as ViewStyle,
    default: {
      shadowColor: '#4A2418',
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      elevation: Math.round(y * 1.5),
    },
  })!;

export const shadows = {
  soft: shadow(2, 10, 0.08),
  float: shadow(8, 24, 0.18),
} as const;
