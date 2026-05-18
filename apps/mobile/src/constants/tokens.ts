// ─────────────────────────────────────────────
//  OPALBAR Design Tokens — Mobile · Editorial Premium
//  Single source of truth for all visual values.
//  Edit here → propagates to every screen.
//
//  Direction: A — Editorial Premium (decided 2026-05-17).
//  See gbrain page: opalbar/decisions/design-direction-editorial-premium
// ─────────────────────────────────────────────

// ── Colors ───────────────────────────────────
//
// Palette philosophy (Editorial Premium):
//  · Warm paper-dark base (no purple/blue tint). Reads as "coffee + leather"
//    rather than "tech dark mode". Backgrounds sit on a single hue family.
//  · Restrained accent: amber (burnished gold) + champagne. Used SPARINGLY —
//    a screen should not have more than 2-3 accent surfaces.
//  · Hairlines use alpha over background so they read as "insinuated"
//    separations instead of flat gray lines.
//  · High-contrast text for editorial readability (parchment-on-paper).
export const Colors = {
  // Backgrounds — warm paper-dark family
  bgPrimary: '#100E0C',
  bgCard: '#171411',
  bgElevated: '#1F1B17',
  bgSubtle: 'rgba(246,241,231,0.025)',
  bgOverlay: 'rgba(8,7,6,0.78)',

  // Text — warm parchment scale, 5 steps max
  textPrimary: '#F6F1E7',
  textSecondary: '#B8B1A2',
  textMuted: '#827C71',
  textDisabled: '#56524A',
  textInverse: '#100E0C',

  // Accent — burnished amber + refined champagne
  accentPrimary: '#E89F4A',
  accentPrimaryLight: '#F0B772',
  accentPrimaryDark: '#B97A26',
  accentChampagne: '#D7BE94',
  accentChampagneDark: '#A8966F',

  // Semantic — muted, editorial. No neon.
  accentSuccess: '#7BB594',
  accentDanger: '#D96A6A',
  accentWarning: '#D9A35D',
  accentInfo: '#85ADCE',

  // Loyalty Levels — warmed
  levelBronce: '#B07A3F',
  levelPlata: '#BBB7AD',
  levelOro: '#E0BF65',
  levelDiamante: '#A8C9D4',

  // Borders & separators — alpha over background, warm parchment tint
  border: 'rgba(246,241,231,0.06)',
  borderStrong: 'rgba(246,241,231,0.10)',
  borderSubtle: 'rgba(246,241,231,0.035)',
  highlightTop: 'rgba(246,241,231,0.05)',

  // Legacy alias — kept temporarily, map to borderStrong
  borderLight: 'rgba(246,241,231,0.10)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;

// ── Typography ───────────────────────────────
//
// Two-family system:
//  · Fraunces (serif)  → display, headlines, hero numbers, lead paragraphs
//  · Inter   (sans)    → body, UI, microcopy in caps, data, captions
//
// New: use the TypePresets below for semantic naming (kicker/body/heading/
// display/hero) instead of stitching fontFamily + fontSize manually. The
// presets bake in lineHeight + letterSpacing so type "lands" correctly.
export const Typography = {
  fontFamily: {
    // Serif (display/hero)
    serif: 'Fraunces_400Regular',
    serifMedium: 'Fraunces_500Medium',
    serifSemiBold: 'Fraunces_600SemiBold',
    serifBold: 'Fraunces_700Bold',
    // Sans (body/UI)
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
    sansBold: 'Inter_700Bold',

    // Legacy aliases — map to sans (do not use in new code)
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  // Font sizes — extended scale for editorial hero type (6xl/7xl new).
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 38,
    '5xl': 48,
    '6xl': 56,
    '7xl': 72,
  },

  lineHeight: {
    tightest: 1.05, // hero / display
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.7,
  },

  letterSpacing: {
    tightest: -0.8,
    tighter: -0.4,
    tight: -0.1,
    normal: 0,
    wide: 0.3,
    wider: 0.8,
    widest: 1.6,
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
} as const;

// ── Type Presets ─────────────────────────────
//
// Semantic styles. Compose into TextStyle objects with one spread:
//   style={[TypePresets.heading, { color: Colors.textPrimary }]}
//
// Each preset already carries fontFamily + fontSize + lineHeight +
// letterSpacing. Color is intentionally NOT included — pick from Colors
// per usage to enforce contrast checks at the call site.
export const TypePresets = {
  // Microcopy & overlines (Inter caps + letterspacing)
  kicker: {
    fontFamily: Typography.fontFamily.sansBold,
    fontSize: 11,
    lineHeight: 11 * 1.3,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  label: {
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: 12,
    lineHeight: 12 * 1.3,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // Body & UI (Inter)
  captionSm: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 11,
    lineHeight: 11 * 1.5,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 12,
    lineHeight: 12 * 1.5,
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 13,
    lineHeight: 13 * 1.5,
    letterSpacing: 0,
  },
  body: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 17,
    lineHeight: 17 * 1.5,
    letterSpacing: -0.1,
  },
  bodyEmphasis: {
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    letterSpacing: 0,
  },
  subhead: {
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: 15,
    lineHeight: 15 * 1.3,
    letterSpacing: 0,
  },

  // Editorial intro (serif body)
  lead: {
    fontFamily: Typography.fontFamily.serif,
    fontSize: 20,
    lineHeight: 20 * 1.5,
    letterSpacing: -0.1,
  },

  // Headings (Fraunces)
  headingSm: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 22,
    lineHeight: 22 * 1.2,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 28,
    lineHeight: 28 * 1.15,
    letterSpacing: -0.4,
  },
  headingLg: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 34,
    lineHeight: 34 * 1.1,
    letterSpacing: -0.6,
  },

  // Display & Hero (Fraunces, generous tracking)
  display: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 44,
    lineHeight: 44 * 1.05,
    letterSpacing: -0.8,
  },
  displayLg: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 56,
    lineHeight: 56 * 1.05,
    letterSpacing: -1.2,
  },
  hero: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 72,
    lineHeight: 72 * 1.02,
    letterSpacing: -1.8,
  },

  // Numeric data (serif, tabular feel for editorial stat blocks)
  numericSm: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 20,
    lineHeight: 20 * 1.1,
    letterSpacing: -0.2,
  },
  numeric: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 30,
    lineHeight: 30 * 1.05,
    letterSpacing: -0.4,
  },
  numericLg: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 48,
    lineHeight: 48 * 1,
    letterSpacing: -0.8,
  },
} as const;

export type TypePresetKey = keyof typeof TypePresets;

// ── Spacing ──────────────────────────────────
// Strict 4-point grid. Editorial layouts breathe — prefer 6/8/10/12 over 3/4.
export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

// Named editorial spacings (semantic aliases — use these in new code).
export const EditorialSpacing = {
  pageGutter: 24,      // horizontal page padding
  sectionGap: 64,      // between sections on a screen
  blockGap: 32,        // between blocks within a section
  ribbonGap: 12,       // between metadata pieces in a row
  heroPadding: 32,     // hero block internal padding
  contentMaxWidth: 720,// for wider devices/landscape
} as const;

// ── Border Radius ────────────────────────────
// Editorial: less rounded than tech-modern. Sharper, more "printed".
export const Radius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  button: 12,
  card: 14,
  xl: 18,
  '2xl': 22,
  full: 9999,
} as const;

// ── Shadows / Elevation ──────────────────────
//
// Editorial: shadows are nearly invisible. Depth comes from the highlightTop
// border + 1px hairline borders. Keep shadows as a *whisper*.
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

// ── Animation ────────────────────────────────
//
// LEGACY shape — kept so any existing import does not break.
// New code should import from `./motion` instead (durations + easings +
// spring presets + named animations like fadeRise/fadeOnly/staggerItem).
export const Animation = {
  durationFast: 240,
  durationNormal: 380,
  durationSlow: 520,
  spring: {
    damping: 22,
    mass: 1,
    stiffness: 260,
  },
  pressScale: 0.97,
} as const;

// ── Z-Index ──────────────────────────────────
export const ZIndex = {
  base: 0,
  card: 10,
  sheet: 40,
  overlay: 50,
  modal: 100,
  toast: 200,
} as const;
