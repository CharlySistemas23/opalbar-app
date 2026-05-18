// ─────────────────────────────────────────────
//  SegmentedControl & Tabs — Editorial Premium
//
//  Two patterns:
//   · <SegmentedControl /> — filled pill bg, used for filter switches
//     (e.g., "Activas / Pasadas", "Yo / Equipo")
//   · <Tabs /> — underline only, used for in-screen content tabs
//     (e.g., "Posts / Stories", "Seguidores / Siguiendo / Amigos")
//
//  Editorial choice: tabs are NEVER pill-shaped with background fill.
//  Underline tabs read as "magazine section dividers".
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Durations } from '@/constants/motion';
import { A11yDefaults, HitSlop, Roles } from '@/constants/a11y';
import { Pressy } from './Pressy';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  fullWidth?: boolean;
}

// ── SegmentedControl ─────────────────────────
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidth = true,
}: SegmentedProps<T>) {
  return (
    <View
      accessibilityRole={Roles.tablist}
      style={[styles.segmentedShell, fullWidth && styles.fullWidth]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressy
            key={opt.value}
            onPress={() => onChange(opt.value)}
            haptic="select"
            accessibilityRole={Roles.tab}
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            style={[styles.segment, fullWidth && { flex: 1 }, active && styles.segmentActive]}
          >
            <Text
              style={[
                TypePresets.subhead,
                { color: active ? Colors.textPrimary : Colors.textMuted, textAlign: 'center' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressy>
        );
      })}
    </View>
  );
}

// ── Tabs (underline) ─────────────────────────
interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
}

export function Tabs<T extends string>({ value, onChange, options }: TabsProps<T>) {
  return (
    <View accessibilityRole={Roles.tablist} style={styles.tabsRow}>
      {options.map((opt) => (
        <Tab
          key={opt.value}
          option={opt}
          active={opt.value === value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

function Tab<T extends string>({
  option,
  active,
  onPress,
}: {
  option: SegmentOption<T>;
  active: boolean;
  onPress: () => void;
}) {
  const underline = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    underline.value = withTiming(active ? 1 : 0, {
      duration: Durations.fast,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [active, underline]);

  const underlineStyle = useAnimatedStyle(() => ({
    opacity: underline.value,
    transform: [{ scaleX: underline.value }],
  }));

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.tab}
      accessibilityLabel={option.label}
      accessibilityState={{ selected: active }}
      hitSlop={HitSlop.expand}
      style={styles.tab}
    >
      <Text
        style={[
          TypePresets.subhead,
          { color: active ? Colors.textPrimary : Colors.textMuted, textAlign: 'center' },
        ]}
      >
        {option.label}
      </Text>
      <Animated.View style={[styles.tabUnderline, underlineStyle]} />
    </Pressy>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },

  // SegmentedControl
  segmentedShell: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 4,
    gap: 2,
  },
  segment: {
    minHeight: 36,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  segmentActive: {
    backgroundColor: Colors.bgElevated,
  },

  // Tabs (underline)
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.textPrimary,
  },
});
