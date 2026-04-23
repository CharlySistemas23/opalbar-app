// ─────────────────────────────────────────────
//  Typography Primitives
//
//  Use these instead of <Text> everywhere. They pick the correct
//  family + size + line-height + letter-spacing from tokens, so the
//  whole app moves together when we iterate the design system.
//
//  Hierarchy:
//    <Display>   Fraunces · large · hero titles, numbers on profile
//    <Heading>   Fraunces · screen titles, section titles
//    <Subhead>   Inter   · strong · labels above content blocks
//    <Body>      Inter   · default paragraph/UI text
//    <Caption>   Inter   · small · secondary/tertiary info
//    <Label>     Inter   · small caps · tags, metadata, overlines
// ─────────────────────────────────────────────
import { Text, TextProps, TextStyle } from 'react-native';
import { Colors, Typography } from '@/constants/tokens';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'champagne' | 'danger' | 'inverse';

const toneColor: Record<Tone, string> = {
  primary: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  accent: Colors.accentPrimary,
  champagne: Colors.accentChampagne,
  danger: Colors.accentDanger,
  inverse: Colors.textInverse,
};

type BaseProps = Omit<TextProps, 'style'> & {
  tone?: Tone;
  align?: TextStyle['textAlign'];
  style?: TextStyle | TextStyle[];
};

function build(base: TextStyle) {
  return function Primitive({ tone = 'primary', align, style, ...rest }: BaseProps) {
    const composed: TextStyle[] = [
      base,
      { color: toneColor[tone] },
      align ? { textAlign: align } : null,
      ...(Array.isArray(style) ? style : [style]),
    ].filter(Boolean) as TextStyle[];
    return <Text {...rest} style={composed} />;
  };
}

// ── Display (hero serif) ─────────────────────
// Variants: 'xl' (48) | 'lg' (38) | 'md' (30) | 'sm' (24)
export function Display(props: BaseProps & { size?: 'xl' | 'lg' | 'md' | 'sm' }) {
  const size = props.size ?? 'lg';
  const map = { xl: 48, lg: 38, md: 30, sm: 24 };
  return build({
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: map[size],
    lineHeight: map[size] * 1.1,
    letterSpacing: Typography.letterSpacing.tightest,
  })({ ...props, tone: props.tone ?? 'primary' });
}

// ── Heading (serif · screen titles) ──────────
// Variants: 'lg' (24) | 'md' (20) | 'sm' (17)
export function Heading(props: BaseProps & { size?: 'lg' | 'md' | 'sm' }) {
  const size = props.size ?? 'md';
  const map = { lg: 24, md: 20, sm: 17 };
  return build({
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: map[size],
    lineHeight: map[size] * 1.25,
    letterSpacing: Typography.letterSpacing.tighter,
  })({ ...props, tone: props.tone ?? 'primary' });
}

// ── Subhead (sans · strong) ──────────────────
export function Subhead(props: BaseProps) {
  return build({
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: Typography.letterSpacing.tight,
  })({ ...props, tone: props.tone ?? 'primary' });
}

// ── Body (sans · default UI text) ────────────
// Variants: 'lg' (17) | 'md' (15) | 'sm' (13)
export function Body(props: BaseProps & { size?: 'lg' | 'md' | 'sm'; weight?: 'regular' | 'medium' | 'semiBold' | 'bold' }) {
  const size = props.size ?? 'md';
  const weight = props.weight ?? 'regular';
  const sizeMap = { lg: 17, md: 15, sm: 13 };
  const familyMap = {
    regular: Typography.fontFamily.sans,
    medium: Typography.fontFamily.sansMedium,
    semiBold: Typography.fontFamily.sansSemiBold,
    bold: Typography.fontFamily.sansBold,
  };
  return build({
    fontFamily: familyMap[weight],
    fontSize: sizeMap[size],
    lineHeight: sizeMap[size] * 1.5,
  })({ ...props, tone: props.tone ?? 'primary' });
}

// ── Caption (small secondary info) ───────────
export function Caption(props: BaseProps & { weight?: 'regular' | 'medium' | 'semiBold' }) {
  const weight = props.weight ?? 'regular';
  const familyMap = {
    regular: Typography.fontFamily.sans,
    medium: Typography.fontFamily.sansMedium,
    semiBold: Typography.fontFamily.sansSemiBold,
  };
  return build({
    fontFamily: familyMap[weight],
    fontSize: 12,
    lineHeight: 16,
  })({ ...props, tone: props.tone ?? 'muted' });
}

// ── Label (small caps overline · tags/meta) ──
export function Label(props: BaseProps) {
  return build({
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
  })({ ...props, tone: props.tone ?? 'muted' });
}
