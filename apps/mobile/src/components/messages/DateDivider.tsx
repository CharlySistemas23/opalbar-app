// ─────────────────────────────────────────────
//  DateDivider — Editorial Premium chat divider
//
//  Magazine-style date marker between message groups: a Kicker label
//  framed by two thin hairlines. No pill, no bgCard chip.
// ─────────────────────────────────────────────
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/tokens';
import { Kicker } from '@/components/ui';

interface Props {
  date: Date;
  language: 'es' | 'en' | string;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dateLabel(d: Date, t: boolean) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return t ? 'Hoy' : 'Today';
  if (isSameDay(d, yesterday)) return t ? 'Ayer' : 'Yesterday';
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  if (d > weekAgo) {
    return d.toLocaleDateString(t ? 'es' : 'en', { weekday: 'long' });
  }
  return d.toLocaleDateString(t ? 'es' : 'en', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function DateDivider({ date, language }: Props) {
  const t = language === 'es';
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={styles.line} />
      <Kicker tone="muted" style={styles.label}>
        {dateLabel(date, t).toUpperCase()}
      </Kicker>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginVertical: Spacing[5],
    paddingHorizontal: Spacing[2],
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  label: {
    paddingHorizontal: Spacing[1],
  },
});
