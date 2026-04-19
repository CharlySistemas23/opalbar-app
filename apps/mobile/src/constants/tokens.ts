// ─────────────────────────────────────────────
//  OPALBAR Design Tokens — Mobile
//  Single source of truth for all visual values
// ─────────────────────────────────────────────

// ── Colors ───────────────────────────────────
export const Colors = {
  // Backgrounds
  bgPrimary: '#0D0D0F',
  bgCard: '#17171B',
  bgElevated: '#2A2A30',
  bgOverlay: 'rgba(0,0,0,0.7)',

  // Text
  textPrimary: '#F4F4F5',
  textSecondary: '#B4B4BB',
  textDisabled: '#5A5A62',
  textInverse: '#0D0D0F',

  // Accent
  accentPrimary: '#F4A340',
  accentPrimaryLight: '#F7B96A',
  accentPrimaryDark: '#D4831A',

  // Semantic
  accentSuccess: '#38C793',
  accentDanger: '#E45858',
  accentWarning: '#F4A340',
  accentInfo: '#60A5FA',

  // Loyalty Levels
  levelBronce: '#CD7F32',
  levelPlata: '#C0C0C0',
  levelOro: '#FFD700',
  levelDiamante: '#B9F2FF',

  // Misc
  border: '#2A2A30',
  borderLight: '#3A3A42',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;

// ── Typography ───────────────────────────────
export const Typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },

  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
} as const;

// ── Spacing ──────────────────────────────────
export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// ── Border Radius ────────────────────────────
export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

// ── Shadows ──────────────────────────────────
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

// ── Animation ────────────────────────────────
export const Animation = {
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 400,
} as const;

// ── Z-Index ──────────────────────────────────
export const ZIndex = {
  base: 0,
  card: 10,
  modal: 100,
  toast: 200,
  overlay: 50,
} as const;
