// ─────────────────────────────────────────────
//  Toast — Editorial Premium notification
//
//  Global toast queue + host portal. Use:
//   · toast('Mensaje enviado', 'success')
//   · toast('No pudimos conectarte', 'danger')
//
//  Editorial choice: dot+label, not big colored bars. The toast is a
//  hairline-outlined card with a small color dot to signal variant.
//
//  Behavior:
//   · 3.2s auto-dismiss (configurable per toast)
//   · Fade + 6px rise enter, fade + 6px out
//   · Stacks vertically with stagger
//   · accessibilityLiveRegion='polite' + announceForAccessibility on push
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { create } from 'zustand';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Durations } from '@/constants/motion';
import { HitSlop } from '@/constants/a11y';

type Variant = 'success' | 'danger' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
  durationMs: number;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, variant?: Variant, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const DEFAULT_MS = 3200;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, variant = 'info', durationMs = DEFAULT_MS) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { id, message, variant, durationMs }] }));
    AccessibilityInfo.announceForAccessibility(message);
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), durationMs);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, variant?: Variant, durationMs?: number) {
  useToastStore.getState().push(message, variant, durationMs);
}

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.host}>
      <View style={styles.stack} pointerEvents="box-none">
        {items.map((it) => (
          <ToastItemView key={it.id} item={it} onDismiss={() => dismiss(it.id)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    opacity.value = withTiming(1, { duration: Durations.fast, easing: ease });
    translateY.value = withTiming(0, { duration: Durations.fast, easing: ease });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const { icon, color, label } = variantMeta(item.variant);

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${label}: ${item.message}`}
      style={[styles.item, animatedStyle]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} accessibilityElementsHidden />
      <Feather name={icon} size={14} color={color} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[TypePresets.body, styles.message]} numberOfLines={3}>
        {item.message}
      </Text>
      <Pressable
        onPress={onDismiss}
        hitSlop={HitSlop.expand}
        accessibilityRole="button"
        accessibilityLabel="Descartar notificación"
      >
        <Feather name="x" size={16} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

function variantMeta(v: Variant): {
  icon: 'check-circle' | 'alert-circle' | 'info' | 'alert-triangle';
  color: string;
  label: string;
} {
  if (v === 'success') return { icon: 'check-circle', color: Colors.accentSuccess, label: 'Éxito' };
  if (v === 'danger') return { icon: 'alert-circle', color: Colors.accentDanger, label: 'Error' };
  if (v === 'warning') return { icon: 'alert-triangle', color: Colors.accentWarning, label: 'Advertencia' };
  return { icon: 'info', color: Colors.accentInfo, label: 'Aviso' };
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  stack: { padding: Spacing[3], gap: Spacing[2] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.highlightTop,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  message: {
    color: Colors.textPrimary,
    flex: 1,
  },
});
