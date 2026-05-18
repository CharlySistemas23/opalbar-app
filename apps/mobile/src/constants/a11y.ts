// ─────────────────────────────────────────────
//  OPALBAR Accessibility Baseline — Mobile
//
//  Single source of truth for accessibility constants and helpers.
//  Hard requirements for every new screen and primitive:
//
//    1. Hit targets ≥ 44pt on every interactive element.
//    2. Every <Pressable>/<TouchableOpacity> carries `accessibilityRole` +
//       `accessibilityLabel` (or `aria-label`-equivalent text content).
//    3. Inputs carry `accessibilityLabel` distinct from placeholder.
//       Placeholder is for hint, label is for screen reader identity.
//    4. Decorative icons carry `accessibilityElementsHidden` + parent
//       label, OR `importantForAccessibility="no"` on Android.
//    5. Modals/Sheets carry `accessibilityViewIsModal` + announce title.
//    6. Body text uses Colors.textPrimary (contrast ≥ 7:1 on bgPrimary,
//       checked by getContrastRatio below). Secondary/muted only for
//       supplementary info, never primary content.
//    7. Reduce-motion honored via useReducedMotion() in animation hooks.
//
//  Lint hook (planned): a script in `scripts/a11y-lint.ts` will grep
//  for unlabeled Pressables in new code. See gbrain page:
//  opalbar/decisions/design-direction-editorial-premium
// ─────────────────────────────────────────────

import { Colors } from './tokens';

// ── Hit target sizes ─────────────────────────
//
// Apple HIG: minimum 44pt. Material: minimum 48dp. We use 44 as baseline
// and 48 for primary actions. Anything below 44 is a bug.
export const HitSlop = {
  // Min touchable size (use as `style={{ minWidth: 44, minHeight: 44 }}`)
  min: 44,
  // Preferred primary CTA size
  primary: 48,
  // Touch padding extension for small targets (icons-only buttons)
  expand: { top: 8, bottom: 8, left: 8, right: 8 },
  expandLg: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

// ── Focus ring ───────────────────────────────
//
// Editorial Premium uses a thin, low-saturation ring. Visible enough to
// pass WCAG 2.1 AA (3:1 contrast vs adjacent), restrained enough not to
// scream "tech app".
export const Focus = {
  ring: {
    width: 2,
    offset: 2,
    color: Colors.accentPrimary,
  },
  // Used on press state for non-interactive feedback areas
  pressBg: 'rgba(232,159,74,0.12)', // accentPrimary @ 12%
} as const;

// ── Contrast helpers ─────────────────────────
//
// WCAG 2.1 targets used in the design:
//   · AA normal text     → 4.5:1
//   · AA large text      → 3.0:1   (≥18pt or ≥14pt bold)
//   · AAA normal text    → 7.0:1   (preferred for body text)
//   · AAA large text     → 4.5:1
export const Contrast = {
  AA: 4.5,
  AALarge: 3.0,
  AAA: 7.0,
  AAALarge: 4.5,
} as const;

/** Parse a hex string `#RRGGBB` → relative luminance per WCAG. */
function relativeLuminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return 0;
  const [r, g, b] = m.map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors. Returns 1..21. */
export function getContrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

/** Check whether a fg/bg pair meets a given WCAG target. */
export function meetsContrast(
  fg: string,
  bg: string,
  level: keyof typeof Contrast = 'AA'
): boolean {
  return getContrastRatio(fg, bg) >= Contrast[level];
}

// ── Roles ────────────────────────────────────
//
// Re-export the React Native `accessibilityRole` strings as a constant so
// component authors don't typo "buton" or "linkk".
export const Roles = {
  button: 'button' as const,
  link: 'link' as const,
  header: 'header' as const,
  image: 'image' as const,
  imagebutton: 'imagebutton' as const,
  text: 'text' as const,
  search: 'search' as const,
  checkbox: 'checkbox' as const,
  radio: 'radio' as const,
  switch: 'switch' as const,
  tab: 'tab' as const,
  tablist: 'tablist' as const,
  menu: 'menu' as const,
  menuitem: 'menuitem' as const,
  alert: 'alert' as const,
  summary: 'summary' as const,
  progressbar: 'progressbar' as const,
  none: 'none' as const,
} as const;

// ── State helpers ────────────────────────────
//
// `accessibilityState` lets screen readers announce things like
// "selected", "expanded", "disabled". Use these helpers so the prop is
// shaped consistently.
export const State = {
  disabled: (v: boolean) => ({ disabled: v }),
  selected: (v: boolean) => ({ selected: v }),
  checked: (v: boolean) => ({ checked: v }),
  expanded: (v: boolean) => ({ expanded: v }),
  busy: (v: boolean) => ({ busy: v }),
};

// ── Announcement helpers ─────────────────────
//
// For toast/banner notifications, status changes, async results.
// Use as: `AccessibilityInfo.announceForAccessibility(announce.success(label))`.
export const announce = {
  success: (label: string) => `${label}. Completado.`,
  error: (label: string) => `${label}. Error.`,
  loading: (label: string) => `${label}. Cargando.`,
};

// ── Default props for common patterns ────────
export const A11yDefaults = {
  /** Apply to <Pressable>/<TouchableOpacity> for icon-only actions. */
  iconButton: (label: string) => ({
    accessibilityRole: Roles.button,
    accessibilityLabel: label,
    hitSlop: HitSlop.expand,
  }),
  /** Apply to decorative icons inside a labeled button. */
  decorativeIcon: {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  },
  /** Apply to <Modal> root. */
  modalRoot: (title: string) => ({
    accessibilityViewIsModal: true,
    accessibilityLabel: title,
    accessibilityRole: Roles.alert,
  }),
} as const;

export default {
  HitSlop,
  Focus,
  Contrast,
  Roles,
  State,
  announce,
  A11yDefaults,
  getContrastRatio,
  meetsContrast,
};
