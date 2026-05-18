// ─────────────────────────────────────────────
//  ListItem — Editorial Premium list row
//
//  Composable row for settings lists, action menus, profile subpages.
//  Slots: leftIcon | title + subtitle + meta | rightSlot (chevron, switch,
//         badge, etc.) — only render what's needed.
//
//  Behavior:
//   · Hairline separators between rows (use <ListItem.Separator /> if you
//     need a manual hairline outside a List wrapper)
//   · 56pt min height by default (>= HitSlop.min)
//   · When `onPress` is provided, wraps in <Pressy> with role=button
//   · `selected` adds an accent left bar (no full background fill — too
//     loud for editorial)
//   · `destructive` switches the title color to danger
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Spacing, TypePresets } from '@/constants/tokens';
import { A11yDefaults, HitSlop, Roles } from '@/constants/a11y';
import { Pressy } from './Pressy';

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  destructive?: boolean;
  /** Show a > chevron on the right (auto-true if onPress and no rightSlot). */
  showChevron?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function ListItem({
  title,
  subtitle,
  meta,
  leftIcon,
  rightSlot,
  onPress,
  disabled,
  selected,
  destructive,
  showChevron,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const titleColor = destructive ? Colors.accentDanger : Colors.textPrimary;
  const chevron = showChevron ?? (!!onPress && !rightSlot);

  const content = (
    <View style={styles.row}>
      {leftIcon ? (
        <View style={styles.leftIcon} {...A11yDefaults.decorativeIcon}>
          {leftIcon}
        </View>
      ) : null}

      <View style={styles.center}>
        <Text style={[TypePresets.subhead, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[TypePresets.caption, { color: Colors.textMuted, marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {meta ? (
        <Text
          style={[TypePresets.caption, { color: Colors.textSecondary, marginRight: chevron ? Spacing[2] : 0 }]}
          numberOfLines={1}
        >
          {meta}
        </Text>
      ) : null}

      {rightSlot ?? (chevron ? <Chevron /> : null)}
    </View>
  );

  const accent = selected ? <View style={styles.selectedBar} /> : null;

  if (onPress) {
    return (
      <Pressy
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={Roles.button}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint ?? subtitle}
        style={[styles.shell, disabled && styles.disabled]}
        testID={testID}
      >
        {accent}
        {content}
      </Pressy>
    );
  }

  return (
    <View style={[styles.shell, disabled && styles.disabled]} testID={testID}>
      {accent}
      {content}
    </View>
  );
}

function Chevron() {
  return (
    <View style={styles.chevron} {...A11yDefaults.decorativeIcon}>
      <View style={styles.chevronLine1} />
      <View style={styles.chevronLine2} />
    </View>
  );
}

ListItem.Separator = function Separator() {
  return <View style={styles.separator} />;
};

const styles = StyleSheet.create({
  shell: {
    minHeight: 56,
    paddingHorizontal: Spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
  },
  leftIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  selectedBar: {
    position: 'absolute',
    left: 0,
    top: Spacing[3],
    bottom: Spacing[3],
    width: 2,
    borderRadius: 1,
    backgroundColor: Colors.accentPrimary,
  },
  chevron: {
    width: 10,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing[1],
  },
  chevronLine1: {
    position: 'absolute',
    width: 7,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Colors.textMuted,
    transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: -3 }],
  },
  chevronLine2: {
    position: 'absolute',
    width: 7,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Colors.textMuted,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: 3 }],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing[5] + 28 + Spacing[3],
  },
});
