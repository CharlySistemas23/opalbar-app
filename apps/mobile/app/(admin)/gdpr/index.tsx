import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

type Tab = 'export' | 'deletion';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'PENDIENTE' },
  PROCESSING: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'PROCESANDO' },
  COMPLETED: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'COMPLETADO' },
  REJECTED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'RECHAZADO' },
};

function userName(u: any) {
  if (!u) return 'Usuario';
  return `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.email || 'Usuario';
}

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function daysSince(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / (24 * 60 * 60 * 1000));
}

export default function GdprRequests() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('export');
  const [exports, setExports] = useState<any[]>([]);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.gdprRequests();
      const d = r.data?.data ?? r.data ?? {};
      setExports(d.exports ?? []);
      setDeletions(d.deletions ?? []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pending = useMemo(() => ({
    export: exports.filter((r) => r.status === 'PENDING').length,
    deletion: deletions.filter((r) => r.status === 'PENDING').length,
  }), [exports, deletions]);

  async function processExport(id: string, action: 'APPROVE' | 'REJECT') {
    setProcessingId(id);
    try {
      await adminApi.processExport(id, action);
      await load();
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setProcessingId(null); }
  }

  async function processDeletion(id: string, action: 'APPROVE' | 'REJECT') {
    setProcessingId(id);
    try {
      await adminApi.processDeletion(id, action);
      await load();
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setProcessingId(null); }
  }

  function confirmApproveDeletion(id: string, userName: string) {
    Alert.alert(
      'Eliminar cuenta permanentemente',
      `¿Procesar la eliminación de ${userName}? La cuenta se marcará como ELIMINADA y los datos se anonimizarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar eliminación', style: 'destructive', onPress: () => processDeletion(id, 'APPROVE') },
      ],
    );
  }

  const list = tab === 'export' ? exports : deletions;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Solicitudes GDPR</Text>
          <Text style={styles.subtitle}>{pending.export + pending.deletion} pendientes</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'export' && styles.tabActive]}
          onPress={() => setTab('export')}
        >
          <Feather name="download" size={14} color={tab === 'export' ? Colors.textInverse : Colors.textSecondary} />
          <Text style={[styles.tabLbl, tab === 'export' && styles.tabLblActive]}>
            Exportar ({exports.length})
            {pending.export > 0 && <Text style={styles.pendBadge}> · {pending.export}</Text>}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'deletion' && styles.tabActive]}
          onPress={() => setTab('deletion')}
        >
          <Feather name="trash-2" size={14} color={tab === 'deletion' ? Colors.textInverse : Colors.textSecondary} />
          <Text style={[styles.tabLbl, tab === 'deletion' && styles.tabLblActive]}>
            Eliminar ({deletions.length})
            {pending.deletion > 0 && <Text style={styles.pendBadge}> · {pending.deletion}</Text>}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="shield" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                Sin solicitudes de {tab === 'export' ? 'exportación' : 'eliminación'}
              </Text>
              <Text style={styles.emptyText}>
                Cuando un usuario solicite sus datos o eliminar su cuenta aparecerá aquí.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.PENDING;
            const uName = userName(item.user);
            const isPending = item.status === 'PENDING';
            const isProcessing = processingId === item.id;

            let countdownText = '';
            let countdownColor = Colors.textMuted;
            if (tab === 'deletion' && item.scheduledFor) {
              const daysUntilScheduled = Math.floor((new Date(item.scheduledFor).getTime() - Date.now()) / (24*60*60*1000));
              if (isPending && daysUntilScheduled > 0) {
                countdownText = `${daysUntilScheduled} días hasta eliminación automática`;
                countdownColor = daysUntilScheduled < 7 ? Colors.accentDanger : Colors.accentPrimary;
              }
            }

            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{uName[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{uName}</Text>
                    <Text style={styles.cardEmail}>{item.user?.email}</Text>
                    <Text style={styles.cardTime}>Solicitado hace {relTime(item.createdAt)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {tab === 'deletion' && item.reason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLbl}>MOTIVO</Text>
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  </View>
                )}

                {countdownText && (
                  <View style={[styles.countdownRow, { borderColor: countdownColor + '40', backgroundColor: countdownColor + '10' }]}>
                    <Feather name="clock" size={12} color={countdownColor} />
                    <Text style={[styles.countdownText, { color: countdownColor }]}>{countdownText}</Text>
                  </View>
                )}

                {tab === 'export' && item.downloadUrl && item.status === 'COMPLETED' && (
                  <View style={styles.downloadRow}>
                    <Feather name="download" size={13} color={Colors.accentSuccess} />
                    <Text style={styles.downloadText} numberOfLines={1}>
                      {item.expiresAt
                        ? `Descargable hasta ${new Date(item.expiresAt).toLocaleDateString('es')}`
                        : 'Listo para descargar'}
                    </Text>
                  </View>
                )}

                {isPending && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => tab === 'export' ? processExport(item.id, 'REJECT') : processDeletion(item.id, 'REJECT')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <ActivityIndicator color={Colors.accentDanger} size="small" /> : <>
                        <Feather name="x" size={13} color={Colors.accentDanger} />
                        <Text style={styles.rejectLbl}>Rechazar</Text>
                      </>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => {
                        if (tab === 'deletion') confirmApproveDeletion(item.id, uName);
                        else processExport(item.id, 'APPROVE');
                      }}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <ActivityIndicator color={Colors.textInverse} size="small" /> : <>
                        <Feather name={tab === 'export' ? 'download' : 'check'} size={13} color={Colors.textInverse} />
                        <Text style={styles.approveLbl}>
                          {tab === 'export' ? 'Procesar export' : 'Aprobar'}
                        </Text>
                      </>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLbl: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  tabLblActive: { color: Colors.textInverse },
  pendBadge: { color: Colors.accentDanger, fontWeight: '800' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },
  cardName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardEmail: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  cardTime: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  reasonBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 10, padding: 10, gap: 4,
  },
  reasonLbl: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  reasonText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 17 },

  countdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  countdownText: { fontSize: 11, fontWeight: '700' },

  downloadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(56,199,147,0.1)',
    borderWidth: 1, borderColor: 'rgba(56,199,147,0.3)',
  },
  downloadText: { color: Colors.accentSuccess, fontSize: 11, fontWeight: '700', flex: 1 },

  actions: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  rejectLbl: { color: Colors.accentDanger, fontSize: 11, fontWeight: '700' },
  approveBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 36, borderRadius: 10,
    backgroundColor: Colors.accentSuccess,
  },
  approveLbl: { color: Colors.textInverse, fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
