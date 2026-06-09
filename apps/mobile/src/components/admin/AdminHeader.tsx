// ─────────────────────────────────────────────
//  AdminHeader — Editorial Premium screen header
//
//  Pattern canonico para todas las pantallas /(admin)/*:
//   · Back chevron (router.back) izquierda
//   · Subhead title centrado a la izquierda con kicker opcional
//   · Slot derecho opcional (action button, count badge, etc.)
//
//  Mantiene el chrome consistente — no logica, solo layout.
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { Kicker, Subhead } from '@/components/ui';

interface Props {
  title: string;
  kicker?: string;
  /** Right-aligned slot — icon button, count badge, etc. */
  right?: ReactNode;
  /** Override the back behavior; defaults to router.back(). */
  onBack?: () => void;
  hideBack?: boolean;
}

export function AdminHeader({ title, kicker, right, onBack, hideBack }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.shell}>
      {hideBack ? (
        <View style={styles.iconSlot} />
      ) : (
        <Pressable
          onPress={handleBack}
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.iconSlot, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={22} color={Colors.textPrimary} />
        </Pressable>
      )}

      <View style={styles.titleWrap}>
        {kicker ? <Kicker tone="muted">{kicker}</Kicker> : null}
        <Subhead numberOfLines={1}>{title}</Subhead>
      </View>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    minHeight: 52,
    gap: Spacing[2],
  },
  iconSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  right: {
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
