import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { create } from 'zustand';
import { Colors } from '@/constants/tokens';

type Variant = 'success' | 'danger' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, variant?: Variant) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, variant = 'info') => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, variant?: Variant) {
  useToastStore.getState().push(message, variant);
}

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.host}>
      <View style={styles.stack} pointerEvents="box-none">
        {items.map((it) => <ToastItemView key={it.id} item={it} onDismiss={() => dismiss(it.id)} />)}
      </View>
    </SafeAreaView>
  );
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  const { icon, color } = variantMeta(item.variant);

  return (
    <Animated.View style={[styles.item, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.iconBox, { backgroundColor: color + '25' }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={8}>
        <Feather name="x" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function variantMeta(v: Variant) {
  if (v === 'success') return { icon: 'check-circle' as const, color: Colors.accentSuccess };
  if (v === 'danger') return { icon: 'alert-circle' as const, color: Colors.accentDanger };
  return { icon: 'info' as const, color: '#60A5FA' };
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  stack: { padding: 12, gap: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  message: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});
