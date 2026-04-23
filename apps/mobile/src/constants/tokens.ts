// ─────────────────────────────────────────────
//  OPALBAR Design Tokens — Mobile · Premium
//  Single source of truth for all visual values.
//  Edit here → propagates to every screen.
// ─────────────────────────────────────────────

// ── Colors ───────────────────────────────────
//
// Palette philosophy: warm off-black (leather/amber base) + restrained
// accent system. Hairlines use alpha over background so they read as
// "insinuated" separations instead of flat gray lines — the telltale
// sign of a premium dark UI.
export const Colors = {
  // Backgrounds — slightly warmer off-black than before (#0D0D0F → #0F0D0C)
  bgPrimary: '#0F0D0C',
  bgCard: '#17141A',
  bgElevated: '#1E1A20',
  bgSubtle: 'rgba(255,255,255,0.03)', // backgrounds on top of bgPrimary
  bgOverlay: 'rgba(0,0,0,0.72)',

  // Text — keep tight scale, premium reads with 4 steps max
  textPrimary: '#F5F2EC',         // warm off-white (was cold #F4F4F5)
  textSecondary: '#B4B0A8',       // warm gray
  textMuted: '#76726B',
  textDisabled: '#52504B',
  textInverse: '#0F0D0C',

  // Accent — primary stays amber, +champagne for VIP/loyalty accents
  accentPrimary: '#F4A340',         // CTA, active states, heart-like
  accentPrimaryLight: '#F7B96A',
  accentPrimaryDark: '#D4831A',
  accentChampagne: '#D4B88C',       // luxury accent (loyalty, verified, VIP)
  accentChampagneDark: '#B39B72',

  // Semantic
  accentSuccess: '#6FB892',         // softened (was #38C793 — too neon)
  accentDanger: '#E06868',          // softened
  accentWarning: '#F4A340',
  accentInfo: '#7AB0E8',

  // Loyalty Levels
  levelBronce: '#CD7F32',
  levelPlata: '#C0C0C0',
  levelOro: '#FFD700',
  levelDiamante: '#B9F2FF',

  // Borders & separators — alpha over background reads premium
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.10)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  highlightTop: 'rgba(255,255,255,0.04)', // top-edge simulated light on cards

  // Legacy aliases (keep for existing code, don't use in new code)
  borderLight: 'rgba(255,255,255,0.10)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;

// ── Typography ───────────────────────────────
//
// Two-family system:
//  · Fraunces (serif)  → display, headlines, feature titles
//  · Inter   (sans)    → body, UI text, numeric/data
//
// DO NOT reference `fontFamily.regular` directly in new code — use the
// <Display>, <Heading>, <Body>, <Caption>, <Label> primitives instead.
// They pick the right family + weight automatically.
export const Typography = {
  fontFamily: {
    // Serif (display)
    serif: 'Fraunces_400Regular',
    serifMedium: 'Fraunces_500Medium',
    serifSemiBold: 'Fraunces_600SemiBold',
    serifBold: 'Fraunces_700Bold',
    // Sans (body/UI)
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
    sansBold: 'Inter_700Bold',

    // Legacy aliases — map to sans so old styles still look decent
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  // Font sizes — tighter scale, premium apps rarely use >10 sizes
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
  },

  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.7,
  },

  letterSpacing: {
    tightest: -0.6,
    tighter: -0.3,
    tight: -0.1,
    normal: 0,
    wide: 0.2,
    wider: 0.6,
    widest: 1.2,
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
} as const;

// ── Spacing ──────────────────────────────────
// Strict 4-point grid. Premium layouts breathe — prefer larger values.
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
  16: 64,
  20: 80,
  24: 96,
} as const;

// ── Border Radius ────────────────────────────
// Premium: generous but never "pill-everything". Keep hierarchy.
export const Radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  button: 14,
  card: 18,
  xl: 22,
  '2xl': 28,
  full: 9999,
} as const;

// ── Shadows / Elevation ──────────────────────
//
// In dark UIs shadows are almost invisible — premium apps simulate depth
// with a soft top-edge highlight + a subtle drop. Use the `Shadows.card`
// preset on any elevated surface.
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
  },
  // Card: use borderTopColor on the same view to simulate a light source
  // coming from above. Very subtle — it just removes the "flat" look.
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;

// ── Animation ────────────────────────────────
export const Animation = {
  durationFast: 140,
  durationNormal: 240,
  durationSlow: 380,
  spring: {
    damping: 18,
    mass: 0.9,
    stiffness: 260,
  },
  pressScale: 0.97, // <PressableScale> default
} as const;

// ── Z-Index ──────────────────────────────────
export const ZIndex = {
  base: 0,
  card: 10,
  overlay: 50,
  modal: 100,
  toast: 200,
} as const;
