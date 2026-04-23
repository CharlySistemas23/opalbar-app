import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

function isMobileOs(os?: string | null) {
  if (!os) return false;
  return /ios|android|mobile|iphone|ipad/i.test(os);
}

export default function Sessions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    authApi.sessions()
      .then((r) => {
        const payload = r.data?.data;
        const items = Array.isArray(payload) ? payload : payload?.items ?? [];
        setSessions(items);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleRevoke(sessionId: string) {
    Alert.alert(
      t ? 'Cerrar sesión' : 'Sign out',
      t ? '¿Cerrar esta sesión?' : 'Sign out of this session?',
      [
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: t ? 'Cerrar' : 'Sign out', style: 'destructive',
          onPress: async () => {
            try {
              await authApi.revokeSession(sessionId);
              setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            } catch {}
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Sesiones activas' : 'Active sessions'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: Spacing[8] }} />
      ) : error && sessions.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.sessionCard}>
              <View style={styles.sessionIcon}>
                <Text style={styles.sessionEmoji}>{isMobileOs(item.deviceOs) ? '📱' : '💻'}</Text>
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionDevice}>
                  {item.deviceName ?? item.deviceOs ?? (t ? 'Dispositivo desconocido' : 'Unknown device')}
                </Text>
                <Text style={styles.sessionMeta}>
                  {[item.ipAddress, item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(language) : null].filter(Boolean).join(' · ')}
                </Text>
                {item.isCurrent && <Text style={styles.currentTag}>{t ? 'Esta sesión' : 'This session'}</Text>}
              </View>
              {!item.isCurrent && (
                <TouchableOpacity onPress={() => handleRevoke(item.id)} style={styles.revokeBtn}>
                  <Text style={styles.revokeText}>{t ? 'Cerrar' : 'Revoke'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="shield"
              title={t ? 'Sin sesiones activas' : 'No active sessions'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  list: { paddingHorizontal: Spacing[5], gap: Spacing[3], paddingBottom: Spacing[8] },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing[4] },
  sessionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center' },
  sessionEmoji: { fontSize: 20 },
  sessionInfo: { flex: 1, gap: 2 },
  sessionDevice: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textPrimary },
  sessionMeta: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  currentTag: { fontSize: Typography.fontSize.xs, color: Colors.accentPrimary, marginTop: 2 },
  revokeBtn: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] },
  revokeText: { fontSize: Typography.fontSize.sm, color: Colors.accentDanger },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing[8] },
});
