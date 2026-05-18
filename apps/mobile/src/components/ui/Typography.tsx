// ─────────────────────────────────────────────
//  Typography Primitives — Editorial Premium
//
//  Use these instead of <Text> everywhere. They pull from `TypePresets`
//  (constants/tokens.ts) so the whole app re-flows in lockstep when the
//  type system is iterated.
//
//  Hierarchy (Editorial Premium):
//    <Hero>      Fraunces · 72 · "Esta noche." page-defining moments
//    <Display>   Fraunces · 44–56 · hero blocks, big numbers
//    <Heading>   Fraunces · 22/28/34 · screen + section titles
//    <Lead>      Fraunces · 20 · serif intro paragraphs
//    <Subhead>   Inter · 15 semibold · UI titles, list group labels
//    <Body>      Inter · 13/15/17 · default paragraph/UI text
//    <Caption>   Inter · 11/12 · secondary/tertiary info
//    <Kicker>    Inter · 11 caps · overlines ("VOL. 12", "ESTA NOCHE")
//    <Label>     Inter · 12 caps · tags, metadata
//    <Numeric>   Fraunces · 20/30/48 · stat blocks, prices
//
//  Tones map to semantic Colors; never hard-code hex in styles.
// ─────────────────────────────────────────────
import { Text, TextProps, TextStyle } from 'react-native';
import { Colors, TypePresets } from '@/constants/tokens';

type Tone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'disabled'
  | 'accent'
  | 'champagne'
  | 'success'
  | 'danger'
  | 'warning'
  | 'inverse';

const toneColor: Record<Tone, string> = {
  primary: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  disabled: Colors.textDisabled,
  accent: Colors.accentPrimary,
  champagne: Colors.accentChampagne,
  success: Colors.accentSuccess,
  danger: Colors.accentDanger,
  warning: Colors.accentWarning,
  inverse: Colors.textInverse,
};

type BaseProps = Omit<TextProps, 'style'> & {
  tone?: Tone;
  align?: TextStyle['textAlign'];
  style?: TextStyle | TextStyle[] | null | undefined;
};

function compose(
  preset: TextStyle,
  tone: Tone,
  align: TextStyle['textAlign'] | undefined,
  style: BaseProps['style'],
  extra?: TextStyle,
): TextStyle[] {
  return [
    preset,
    extra ?? null,
    { color: toneColor[tone] },
    align ? { textAlign: align } : null,
    ...(Array.isArray(style) ? style : [style ?? null]),
  ].filter(Boolean) as TextStyle[];
}

// ── Hero (page-defining serif) ───────────────
export function Hero({ tone = 'primary', align, style, ...rest }: BaseProps) {
  return <Text {...rest} style={compose(TypePresets.hero, tone, align, style)} />;
}

// ── Display (large serif) ────────────────────
// size: 'lg' (56) | 'md' (44) — default 'md'
export function Display({
  size = 'md',
  tone = 'primary',
  align,
  style,
  ...rest
}: BaseProps & { size?: 'lg' | 'md' }) {
  const preset = size === 'lg' ? TypePresets.displayLg : TypePresets.display;
  return <Text {...rest} style={compose(preset, tone, align, style)} />;
}

// ── Heading (screen/section serif) ───────────
// size: 'lg' (34) | 'md' (28) | 'sm' (22) — default 'md'
export function Heading({
  size = 'md',
  tone = 'primary',
  align,
  style,
  ...rest
}: BaseProps & { size?: 'lg' | 'md' | 'sm' }) {
  const preset =
    size === 'lg' ? TypePresets.headingLg : size === 'sm' ? TypePresets.headingSm : TypePresets.heading;
  return <Text {...rest} style={compose(preset, tone, align, style)} />;
}

// ── Lead (serif intro paragraph) ─────────────
export function Lead({ tone = 'secondary', align, style, ...rest }: BaseProps) {
  return <Text {...rest} style={compose(TypePresets.lead, tone, align, style)} />;
}

// ── Subhead (sans UI titles) ─────────────────
export function Subhead({ tone = 'primary', align, style, ...rest }: BaseProps) {
  return <Text {...rest} style={compose(TypePresets.subhead, tone, align, style)} />;
}

// ── Body (default UI text) ───────────────────
// size: 'lg' (17) | 'md' (15) | 'sm' (13) — default 'md'
// weight: 'regular' | 'medium' | 'semiBold' | 'bold' — default 'regular'
export function Body({
  size = 'md',
  weight = 'regular',
  tone = 'primary',
  align,
  style,
  ...rest
}: BaseProps & {
  size?: 'lg' | 'md' | 'sm';
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold';
}) {
  const preset =
    size === 'lg' ? TypePresets.bodyLg : size === 'sm' ? TypePresets.bodySm : TypePresets.body;
  const weightFamily =
    weight === 'regular'
      ? preset.fontFamily
      : weight === 'medium'
        ? 'Inter_500Medium'
        : weight === 'semiBold'
          ? 'Inter_600SemiBold'
          : 'Inter_700Bold';
  return (
    <Text {...rest} style={compose(preset, tone, align, style, { fontFamily: weightFamily })} />
  );
}

// ── Caption (small secondary info) ───────────
// size: 'md' (12) | 'sm' (11) — default 'md'
export function Caption({
  size = 'md',
  tone = 'muted',
  align,
  style,
  ...rest
}: BaseProps & { size?: 'md' | 'sm' }) {
  const preset = size === 'sm' ? TypePresets.captionSm : TypePresets.caption;
  return <Text {...rest} style={compose(preset, tone, align, style)} />;
}

// ── Kicker (overline / small caps) ───────────
// Used for "VOL. 12 · KARMA LOUNGE" style metadata.
export function Kicker({ tone = 'muted', align, style, ...rest }: BaseProps) {
  return <Text {...rest} style={compose(TypePresets.kicker, tone, align, style)} />;
}

// ── Label (small caps tags/meta) ─────────────
export function Label({ tone = 'muted', align, style, ...rest }: BaseProps) {
  return <Text {...rest} style={compose(TypePresets.label, tone, align, style)} />;
}

// ── Numeric (editorial serif numbers) ────────
// size: 'lg' (48) | 'md' (30) | 'sm' (20) — default 'md'
export function Numeric({
  size = 'md',
  tone = 'primary',
  align,
  style,
  ...rest
}: BaseProps & { size?: 'lg' | 'md' | 'sm' }) {
  const preset =
    size === 'lg' ? TypePresets.numericLg : size === 'sm' ? TypePresets.numericSm : TypePresets.numeric;
  return <Text {...rest} style={compose(preset, tone, align, style)} />;
}
