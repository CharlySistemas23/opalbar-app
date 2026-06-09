// ─────────────────────────────────────────────
//  OPALBAR Design Tokens — Mobile · NOIR ABSOLUTE
//  Single source of truth for all visual values.
//  Edit here → propagates to every screen.
//
//  Direction: Noir Absolute (decided 2026-05-18 after Editorial pivot).
//  Filosofía: Amex Centurion meets Cartier app — black absolute base,
//  bone text, brushed gold accent. Sharp geometry, dense layouts, no
//  rounded-everything. Tier identity carries through tones, not gradients.
// ─────────────────────────────────────────────

// ── Colors ───────────────────────────────────
//
// Palette philosophy (NOIR ABSOLUTE):
//  · Pure black `#000` base. Surfaces step up one notch (`#0A0808`/`#141210`)
//    to read depth without warmth tint.
//  · Text in bone white (`#EAE2D0`) — premium, not pure white. Slight
//    yellow undertone reads as "ivory paper", not "tech".
//  · Single accent: brushed gold `#C9A961` (matte, low-saturation).
//    No more amber/orange. Cooler, more jewelry-grade.
//  · Loyalty tiers refined to metallic tones (bronze/silver/gold/platinum).
//  · Borders barely visible — depth comes from typography and spacing,
//    not from outlining.
export const Colors = {
  // Backgrounds — warm paper-dark family (matches Figma 2026-06-09)
  bgPrimary: '#100E0C',
  bgCard: '#171411',
  bgElevated: '#1F1B17',
  bgSubtle: 'rgba(246,241,231,0.025)',
  bgOverlay: 'rgba(8,7,6,0.78)',

  // Text — warm parchment scale (matches Figma)
  textPrimary: '#F6F1E7',
  textSecondary: '#B8B1A2',
  textMuted: '#827C71',
  textDisabled: '#56524A',
  textInverse: '#100E0C',

  // Accent — brushed gold (matte). Was amber → now jewelry-grade gold.
  accentPrimary: '#C9A961',
  accentPrimaryLight: '#D9BC7E',
  accentPrimaryDark: '#9A7F45',
  accentChampagne: '#D7C9A7',
  accentChampagneDark: '#A89B7C',

  // Semantic — kept refined, no neon
  accentSuccess: '#6FA88A',
  accentDanger: '#C46868',
  accentWarning: '#C9A961',
  accentInfo: '#7FA0BC',

  // Loyalty Levels — metallic, refined
  levelBronce: '#A87148',
  levelPlata: '#B4B0A6',
  levelOro: '#C9A961',
  levelDiamante: '#9FB6BE',

  // Borders & separators — warm parchment tint (matches Figma)
  border: 'rgba(246,241,231,0.06)',
  borderStrong: 'rgba(246,241,231,0.10)',
  borderSubtle: 'rgba(246,241,231,0.035)',
  highlightTop: 'rgba(246,241,231,0.05)',

  // Legacy alias
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

  // Editorial intro (sans body — quitamos serif para densidad premium)
  lead: {
    fontFamily: Typography.fontFamily.sans,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    letterSpacing: -0.1,
  },

  // Headings (Fraunces) — bajados para densidad premium tipo concierge
  headingSm: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 17,
    lineHeight: 17 * 1.25,
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 20,
    lineHeight: 20 * 1.2,
    letterSpacing: -0.3,
  },
  headingLg: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 24,
    lineHeight: 24 * 1.15,
    letterSpacing: -0.4,
  },

  // Display & Hero — restraint. No más 72pt en hero blocks; el "premium"
  // viene de la composición, no del tamaño tipográfico.
  display: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 28,
    lineHeight: 28 * 1.1,
    letterSpacing: -0.5,
  },
  displayLg: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 34,
    lineHeight: 34 * 1.08,
    letterSpacing: -0.7,
  },
  hero: {
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: 40,
    lineHeight: 40 * 1.05,
    letterSpacing: -1,
  },

  // Numeric data — serif Fraunces. Mono (Courier) NO está cargado y
  // referenciarlo crasheaba el app en runtime (crash NOIR v3, 2026-05-18).
  numericSm: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 17,
    lineHeight: 17 * 1.1,
    letterSpacing: -0.2,
  },
  numeric: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 24,
    lineHeight: 24 * 1.05,
    letterSpacing: -0.3,
  },
  numericLg: {
    fontFamily: Typography.fontFamily.serifMedium,
    fontSize: 36,
    lineHeight: 36 * 1,
    letterSpacing: -0.6,
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
// Updated 2026-06-09: shifted from NOIR sharp (3-4) to softer modern social
// feel (12-20). Keeps editorial restraint via paleta + typography, but
// reads as fluid/touchable like FB / TikTok / Apple cards.
export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  button: 12,
  card: 14,
  xl: 18,
  '2xl': 22,
  full: 9999,
} as const;

// ── Shadows / Elevation ──────────────────────
//
// Soft depth for cards/sheets — visible enough to read as elevated,
// subtle enough to stay editorial. Matches modern social app feel.
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 24,
    elevation: 14,
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
