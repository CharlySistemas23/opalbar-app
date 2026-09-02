// ─────────────────────────────────────────────
//  OptionSheet — list picker in a bottom sheet
//
//  Replaces every `Alert.alert(title, msg, [N buttons])` picker in the
//  admin panel. Renders a tappable row per option with optional icon,
//  description and tone; the selected value gets a check mark.
// ─────────────────────────────────────────────
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, Sheet } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export interface OptionSheetItem<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: FeatherIcon;
  tone?: 'default' | 'danger' | 'success' | 'accent';
  disabled?: boolean;
}

interface Props<T extends string> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: OptionSheetItem<T>[];
  value?: T | null;
  onSelect: (value: T) => void;
  /** Keep the sheet open after selecting (default: close). */
  keepOpen?: boolean;
}

const TONE: Record<NonNullable<OptionSheetItem['tone']>, string> = {
  default: Colors.textPrimary,
  danger: Colors.accentDanger,
  success: Colors.accentSuccess,
  accent: Colors.accentPrimary,
};

export function OptionSheet<T extends string>({
  open,
  onClose,
  title,
  subtitle,
  options,
  value,
  onSelect,
  keepOpen,
}: Props<T>) {
  const fb = useFeedback();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {subtitle ? (
        <Caption tone="muted" style={{ marginBottom: Spacing[3] }}>
          {subtitle}
        </Caption>
      ) : null}
      <ScrollView bounces={false} style={{ maxHeight: 420 }} contentContainerStyle={{ gap: Spacing[2] }}>
        {options.map((opt) => {
          const color = TONE[opt.tone ?? 'default'];
          const active = value != null && value === opt.value;
          return (
            <Pressable
              key={opt.value}
              disabled={opt.disabled}
              onPress={() => {
                fb.select();
                onSelect(opt.value);
                if (!keepOpen) onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !!opt.disabled }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && { opacity: 0.7 },
                opt.disabled && { opacity: 0.4 },
              ]}
            >
              {opt.icon ? (
                <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
                  <Feather name={opt.icon} size={16} color={color} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Body weight="medium" style={{ color }}>
                  {opt.label}
                </Body>
                {opt.description ? (
                  <Caption tone="muted" style={{ marginTop: 2 }}>
                    {opt.description}
                  </Caption>
                ) : null}
              </View>
              {active ? <Feather name="check" size={16} color={Colors.accentPrimary} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rowActive: { borderColor: Colors.accentPrimary },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
