import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Switch, Modal, TextInput, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

interface Flag {
  id: string;
  key: string;
  enabled: boolean;
  description?: string | null;
  updatedAt?: string;
}

const SUGGESTIONS: { key: string; description: string }[] = [
  { key: 'guest_mode', description: 'Permite navegar como invitado sin login' },
  { key: 'community_enabled', description: 'Muestra la pestaña de Comunidad' },
  { key: 'reservations_enabled', description: 'Permite hacer reservas desde la app' },
  { key: 'push_marketing', description: 'Envío de push promocionales' },
  { key: 'reviews_enabled', description: 'Permite dejar reseñas' },
  { key: 'qr_checkin', description: 'Check-in por QR en venue' },
];

export default function AdminFlags() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'SUPER_ADMIN';

  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await adminApi.featureFlags();
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      setFlags(rows);
    } catch (err) { setError(apiError(err)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(flag: Flag, enabled: boolean) {
    setPending((p) => ({ ...p, [flag.key]: true }));
    setFlags((p) => p.map((f) => f.key === flag.key ? { ...f, enabled } : f));
    try {
      await adminApi.updateFeatureFlag(flag.key, enabled);
    } catch (err) {
      Alert.alert('Error', apiError(err));
      setFlags((p) => p.map((f) => f.key === flag.key ? { ...f, enabled: !enabled } : f));
    } finally { setPending((p) => ({ ...p, [flag.key]: false })); }
  }

  async function addFlag(key: string) {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!k) return;
    try {
      await adminApi.updateFeatureFlag(k, false);
      setShowAdd(false); setNewKey('');
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
  }

  const unsuggested = SUGGESTIONS.filter((s) => !flags.some((f) => f.key === s.key));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Feature flags</Text>
        {canEdit ? (
          <TouchableOpacity onPress={() => setShowAdd(true)} style={[styles.backBtn, { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary }]} hitSlop={10}>
            <Feather name="plus" size={18} color={Colors.textInverse} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
      </View>

      <View style={styles.warn}>
        <Feather name="alert-triangle" size={16} color="#F59E0B" />
        <Text style={styles.warnText}>
          Cambios aplican en caliente a todos los clientes. Usa con precaución en producción.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={Colors.accentDanger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryLbl}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={flags}
          keyExtractor={(x) => x.id ?? x.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="toggle-left" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Sin flags todavía</Text>
              {canEdit && (
                <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.retryBtn}>
                  <Text style={styles.retryLbl}>Crear primero</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.flagKey}>{item.key}</Text>
                {item.description ? <Text style={styles.flagDesc}>{item.description}</Text> : null}
                <View style={styles.flagMeta}>
                  <View style={[styles.statusDot, { backgroundColor: item.enabled ? Colors.accentSuccess : Colors.textMuted }]} />
                  <Text style={styles.flagMetaText}>{item.enabled ? 'Activo' : 'Inactivo'}</Text>
                </View>
              </View>
              {pending[item.key] ? (
                <ActivityIndicator color={Colors.accentPrimary} />
              ) : (
                <Switch
                  value={item.enabled}
                  onValueChange={(v) => toggle(item, v)}
                  disabled={!canEdit}
                  trackColor={{ true: Colors.accentPrimary, false: Colors.bgElevated }}
                  thumbColor={Colors.textInverse}
                />
              )}
            </View>
          )}
          ListFooterComponent={
            canEdit && unsuggested.length > 0 ? (
              <View style={styles.suggestBox}>
                <Text style={styles.suggestTitle}>Sugerencias</Text>
                {unsuggested.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={styles.suggestRow}
                    activeOpacity={0.85}
                    onPress={() => addFlag(s.key)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.flagKey}>{s.key}</Text>
                      <Text style={styles.flagDesc}>{s.description}</Text>
                    </View>
                    <Feather name="plus-circle" size={18} color={Colors.accentPrimary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowAdd(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva flag</Text>
            <Text style={styles.modalSub}>Usa snake_case. Se creará desactivada.</Text>
            <TextInput
              style={[styles.input, { marginTop: 14 }]}
              autoCapitalize="none"
              autoCorrect={false}
              value={newKey}
              onChangeText={setNewKey}
              placeholder="ej. chat_ai"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => addFlag(newKey)}
              activeOpacity={0.85}
            >
              <Text style={styles.saveLbl}>Crear</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 12, padding: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  warnText: { flex: 1, color: '#F59E0B', fontSize: 12, lineHeight: 17, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.accentPrimary, marginTop: 4 },
  retryLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, backgroundColor: Colors.bgCard,
    borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.border,
  },
  flagKey: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', fontFamily: 'monospace' },
  flagDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  flagMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  flagMetaText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },

  suggestBox: {
    marginTop: 18, padding: 14, gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed' as const,
  },
  suggestTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  modalSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 14,
  },
  saveBtn: {
    height: 48, borderRadius: 12,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  saveLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
});
