// ─────────────────────────────────────────────
//  OPALBAR Tier System — Full Visual Identity
//
//  Each tier carries its own metallic identity that propagates to:
//    · MembershipCard (card face + edge glint + texture overlay)
//    · Avatar ring (tier-tinted gradient stop)
//    · Tier badge (color + texture)
//    · QR frame border
//    · Progress bar (tier accent)
//    · Stories ring (tier glint)
//    · Stat numbers (tier hint on tier-locked screens)
//
//  Philosophy: NO solid color blocks. Each tier is a *material*:
//  copper brushed, silver satin, matte gold, titanium platinum.
//
//  Implementation uses 3-stop gradients to fake the metallic surface,
//  with a "glint" stop offset slightly that catches highlight.
// ─────────────────────────────────────────────

export type TierKey = 'Bronce' | 'Plata' | 'Oro' | 'Diamante';

export interface TierVisual {
  /** Display label, locale-neutral key */
  key: TierKey;
  /** Spanish label */
  labelEs: string;
  /** English label */
  labelEn: string;
  /** Primary tone (use for solid touches like badges, dots, single-color cases) */
  base: string;
  /** Darker tone for shadows / pressed states */
  baseDark: string;
  /** Brightest tone for glint highlights */
  baseLight: string;
  /** Card background base — DEEP variant of base, dark surface */
  cardBg: string;
  /** Card secondary tone (gradient stop 2) */
  cardMid: string;
  /** Card glint tone (gradient stop 3 — catches light) */
  cardGlint: string;
  /** Hairline glint color (top edge of card) */
  edgeGlint: string;
  /** Text color on the card (ivory by default — high contrast on dark) */
  text: string;
  /** Muted text on card */
  textMuted: string;
  /** The "material" description (for screen-reader / dev docs) */
  material: string;
}

const TIERS: Record<TierKey, TierVisual> = {
  Bronce: {
    key: 'Bronce',
    labelEs: 'Bronce',
    labelEn: 'Bronze',
    base: '#A87148',
    baseDark: '#6E4A30',
    baseLight: '#C99672',
    cardBg: '#1A1208',
    cardMid: '#2A1B0E',
    cardGlint: '#3D2918',
    edgeGlint: 'rgba(201,150,114,0.45)',
    text: '#EAE2D0',
    textMuted: '#9B8B73',
    material: 'brushed copper',
  },
  Plata: {
    key: 'Plata',
    labelEs: 'Plata',
    labelEn: 'Silver',
    base: '#B4B0A6',
    baseDark: '#76736C',
    baseLight: '#D4D0C6',
    cardBg: '#15151A',
    cardMid: '#22222A',
    cardGlint: '#33333E',
    edgeGlint: 'rgba(212,208,198,0.40)',
    text: '#EAE2D0',
    textMuted: '#8E8B83',
    material: 'satin aluminum',
  },
  Oro: {
    key: 'Oro',
    labelEs: 'Oro',
    labelEn: 'Gold',
    base: '#C9A961',
    baseDark: '#8C7440',
    baseLight: '#E5C77E',
    cardBg: '#1A1408',
    cardMid: '#2A210E',
    cardGlint: '#3D3018',
    edgeGlint: 'rgba(229,199,126,0.50)',
    text: '#EAE2D0',
    textMuted: '#A28D5E',
    material: 'matte gold',
  },
  Diamante: {
    key: 'Diamante',
    labelEs: 'Diamante',
    labelEn: 'Diamond',
    base: '#9FB6BE',
    baseDark: '#69787E',
    baseLight: '#C5D6DC',
    cardBg: '#0C1418',
    cardMid: '#16212A',
    cardGlint: '#243340',
    edgeGlint: 'rgba(197,214,220,0.50)',
    text: '#EAE2D0',
    textMuted: '#7E8E94',
    material: 'platinum titanium',
  },
} as const;

/** Fallback when user has no tier assigned yet (Club / Aspirante). */
export const NEUTRAL_TIER: TierVisual = {
  key: 'Bronce', // for typing — not displayed
  labelEs: 'Club',
  labelEn: 'Club',
  base: '#9B9587',
  baseDark: '#6B6760',
  baseLight: '#C9C3B3',
  cardBg: '#0A0808',
  cardMid: '#141210',
  cardGlint: '#1E1B17',
  edgeGlint: 'rgba(234,226,208,0.20)',
  text: '#EAE2D0',
  textMuted: '#6B6760',
  material: 'matte ivory',
};

/** Normalize any tier name string to a TierKey. Accepts es/en/lowercased. */
export function resolveTier(name?: string | null): TierVisual {
  if (!name) return NEUTRAL_TIER;
  const n = name.trim().toLowerCase();
  if (n === 'bronce' || n === 'bronze') return TIERS.Bronce;
  if (n === 'plata' || n === 'silver') return TIERS.Plata;
  if (n === 'oro' || n === 'gold') return TIERS.Oro;
  if (n === 'diamante' || n === 'diamond' || n === 'platino' || n === 'platinum') return TIERS.Diamante;
  return NEUTRAL_TIER;
}

/** All tiers in display order (lowest to highest). */
export const TIERS_ORDERED: TierVisual[] = [
  TIERS.Bronce,
  TIERS.Plata,
  TIERS.Oro,
  TIERS.Diamante,
];

export { TIERS };
