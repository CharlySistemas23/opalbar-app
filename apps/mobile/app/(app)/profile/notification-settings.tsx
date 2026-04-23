import { View, Text, StyleSheet, Switch, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

export default function NotificationSettings() {
  const router = useRouter();
  const {
    language,
    hapticsEnabled, setHapticsEnabled,
    soundsEnabled, setSoundsEnabled,
  } = useAppStore();
  const t = language === 'es';
  const [settings, setSettings] = useState({
    events: true,
    offers: true,
    community: false,
    reservations: true,
    marketing: false,
  });
  const [saving, setSaving] = useState<string | null>(null);

  // Optimistic auto-save: toggling a switch sends the update immediately.
  // If the request fails we revert. Feels instant.
  async function toggle(key: keyof typeof settings) {
    const previous = settings[key];
    const next = !previous;
    setSettings((prev) => ({ ...prev, [key]: next }));
    setSaving(key);
    try {
      await usersApi.updateNotifications({ ...settings, [key]: next });
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, [key]: previous }));
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setSaving(null);
    }
  }

  const items = [
    { key: 'events', label: t ? 'Eventos' : 'Events', desc: t ? 'Nuevos eventos y recordatorios' : 'New events and reminders' },
    { key: 'offers', label: t ? 'Ofertas' : 'Offers', desc: t ? 'Descuentos y promociones' : 'Discounts and promotions' },
    { key: 'community', label: t ? 'Comunidad' : 'Community', desc: t ? 'Comentarios y reacciones' : 'Comments and reactions' },
    { key: 'reservations', label: t ? 'Reservaciones' : 'Reservations', desc: t ? 'Estado de tus reservaciones' : 'Your reservation status' },
    { key: 'marketing', label: t ? 'Marketing' : 'Marketing', desc: t ? 'Novedades y noticias' : 'News and updates' },
  ] as const;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Notificaciones' : 'Notifications'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {items.map((item, i) => (
            <View key={item.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                thumbColor={Colors.textInverse}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t ? 'Feedback táctil y sonido' : 'Haptics & sound'}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{t ? 'Vibración' : 'Haptics'}</Text>
              <Text style={styles.rowDesc}>
                {t ? 'Vibración al tocar, enviar, confirmar' : 'Vibration on tap, send, confirm'}
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
              thumbColor={Colors.textInverse}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{t ? 'Sonidos' : 'Sounds'}</Text>
              <Text style={styles.rowDesc}>
                {t ? 'Sonidos de like, mensaje, canje' : 'Sounds on like, message, redemption'}
              </Text>
            </View>
            <Switch
              value={soundsEnabled}
              onValueChange={setSoundsEnabled}
              trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
              thumbColor={Colors.textInverse}
            />
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingBottom: Spacing[6] },
  sectionHeader: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing[4], marginBottom: -Spacing[2], paddingHorizontal: Spacing[1] },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  rowDesc: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
