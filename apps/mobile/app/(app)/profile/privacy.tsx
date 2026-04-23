import { View, Text, StyleSheet, Switch, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

export default function Privacy() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [settings, setSettings] = useState({ showProfile: true, showActivity: false, allowMessages: true });

  // Optimistic auto-save — toggling sends immediately, reverts on error.
  async function toggle(key: keyof typeof settings) {
    const prev = settings[key];
    const next = !prev;
    setSettings((p) => ({ ...p, [key]: next }));
    try {
      await usersApi.updatePrivacy({ ...settings, [key]: next });
    } catch (err: any) {
      setSettings((p) => ({ ...p, [key]: prev }));
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    }
  }

  const items = [
    { key: 'showProfile' as const, label: t ? 'Perfil público' : 'Public profile', desc: t ? 'Otros usuarios pueden ver tu perfil' : 'Other users can see your profile' },
    { key: 'showActivity' as const, label: t ? 'Mostrar actividad' : 'Show activity', desc: t ? 'Tu actividad reciente es visible' : 'Your recent activity is visible' },
    { key: 'allowMessages' as const, label: t ? 'Recibir mensajes' : 'Receive messages', desc: t ? 'Otros pueden enviarte mensajes' : 'Others can send you messages' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Privacidad' : 'Privacy'}</Text>
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
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingVertical: Spacing[4] },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  rowDesc: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
