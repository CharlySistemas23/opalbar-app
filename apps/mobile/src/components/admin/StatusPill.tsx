// ─────────────────────────────────────────────
//  StatusPill — color-tinted chip para estados admin
//
//  Pill compacto con bg tintado en alpha y texto en color full.
//  Usado en filas de listas, detail screens, headers.
//
//  Variants:
//    · neutral  — gris muted (sin color)
//    · accent   — gold (default cuando no se especifica)
//    · success  — verde
//    · danger   — rojo
//    · warning  — amber (alias accent)
//    · info     — azul
// ─────────────────────────────────────────────
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Text } from 'react-native';

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

interface Props {
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const toneMap: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'rgba(184,177,162,0.12)', fg: Colors.textSecondary },
  accent: { bg: 'rgba(201,169,97,0.14)', fg: Colors.accentPrimary },
  success: { bg: 'rgba(111,168,138,0.14)', fg: Colors.accentSuccess },
  danger: { bg: 'rgba(196,104,104,0.14)', fg: Colors.accentDanger },
  warning: { bg: 'rgba(201,169,97,0.14)', fg: Colors.accentPrimary },
  info: { bg: 'rgba(127,160,188,0.14)', fg: Colors.accentInfo },
};

export function StatusPill({ label, tone = 'neutral', size = 'sm', style }: Props) {
  const { bg, fg } = toneMap[tone];
  const sizeStyle = size === 'md' ? styles.md : styles.sm;
  const fontSize = size === 'md' ? 12 : 11;
  return (
    <View style={[styles.shell, sizeStyle, { backgroundColor: bg }, style]}>
      <Text
        style={[
          TypePresets.label,
          { color: fg, fontSize, letterSpacing: 0.6 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
  },
});
