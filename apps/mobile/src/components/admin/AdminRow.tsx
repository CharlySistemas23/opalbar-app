// ─────────────────────────────────────────────
//  AdminRow — fila canonica de listas/tablas admin
//
//  Patron Figma:
//   · bgCard radius 8 border alpha 0.06
//   · padding 16x / 12y
//   · Subhead title + Caption meta muted
//   · slot derecho: StatusPill, switch, chevron o action
//
//  Componer dentro de scroll/list. Para listas, gap 8 entre rows.
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { Caption, Subhead } from '@/components/ui';

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Force a chevron on the right when onPress and no rightSlot. */
  showChevron?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function AdminRow({
  title,
  subtitle,
  meta,
  leftSlot,
  rightSlot,
  onPress,
  destructive,
  disabled,
  showChevron,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const chevron = showChevron ?? (!!onPress && !rightSlot);
  const titleTone = destructive ? 'danger' : 'primary';

  const inner = (
    <View style={styles.row}>
      {leftSlot ? <View style={styles.left}>{leftSlot}</View> : null}
      <View style={styles.center}>
        <Subhead tone={titleTone} numberOfLines={1}>
          {title}
        </Subhead>
        {subtitle ? (
          <Caption tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Caption>
        ) : null}
        {meta ? (
          <Caption tone="secondary" size="sm" style={{ marginTop: 4 }}>
            {meta}
          </Caption>
        ) : null}
      </View>
      {rightSlot ?? (chevron ? <Chevron /> : null)}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={HitSlop.min}
        accessibilityRole={Roles.button}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint ?? subtitle}
        accessibilityState={{ disabled: !!disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.shell,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.shell, disabled && styles.disabled, style]} testID={testID}>
      {inner}
    </View>
  );
}

function Chevron() {
  return (
    <Feather name="chevron-right" size={18} color={Colors.textMuted} style={styles.chevron} />
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  left: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1 },
  chevron: { marginLeft: Spacing[2] },
});
