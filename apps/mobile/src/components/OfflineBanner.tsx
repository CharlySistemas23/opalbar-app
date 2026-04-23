import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useOffline } from '@/hooks/useOffline';
import { useAppStore } from '@/stores/app.store';

interface Props {
  /** Optional override. When omitted, reads from `useOffline()`. */
  visible?: boolean;
  message?: string;
}

/**
 * Banner shown at the top when the device has no network connection.
 * By default it auto-detects via `useOffline()` (NetInfo). Pass `visible`
 * explicitly to force a specific state (tests, demos).
 */
export function OfflineBanner({ visible, message }: Props) {
  const autoOffline = useOffline();
  const language = useAppStore((s) => s.language);
  const resolved = typeof visible === 'boolean' ? visible : autoOffline;
  if (!resolved) return null;
  const label = message ?? (language === 'es' ? 'Sin conexión. Revisa tu red.' : 'No connection. Check your network.');
  return (
    <View style={styles.root}>
      <Feather name="wifi-off" size={14} color={Colors.textInverse} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accentWarning,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: { color: Colors.textInverse, fontSize: 12, fontWeight: '700' },
});
