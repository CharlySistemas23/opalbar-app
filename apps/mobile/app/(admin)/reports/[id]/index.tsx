import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const TYPE_META: Record<string, { icon: FeatherIcon; color: string; label: string }> = {
  POST: { icon: 'message-square', color: Colors.accentPrimary, label: 'Post' },
  COMMENT: { icon: 'message-circle', color: '#60A5FA', label: 'Comentario' },
  USER: { icon: 'user', color: '#A855F7', label: 'Usuario' },
  REVIEW: { icon: 'star', color: '#EC4899', label: 'Reseña' },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  PENDING: { color: Colors.accentPrimary, label: 'PENDIENTE' },
  RESOLVED: { color: Colors.accentSuccess, label: 'RESUELTO' },
  DISMISSED: { color: Colors.textMuted, label: 'DESCARTADO' },
};

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.reportDetail(id);
      setData(r.data?.data ?? r.data);
    } catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function act(action: 'RESOLVED' | 'DISMISSED', banAuthor = false) {
    setBusy(true);
    try {
      if (banAuthor && data?.target?.user?.id) {
        await adminApi.banUser(data.target.user.id, `Reporte: ${data.report.reason}`);
      }
      await adminApi.resolveReport(id, action);
      router.back();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setBusy(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!data?.report) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Reporte no encontrado</Text></View>;

  const { report, target, otherReports } = data;
  const meta = TYPE_META[report.targetType] ?? TYPE_META.POST;
  const status = STATUS_META[report.status] ?? STATUS_META.PENDING;
  const isPending = report.status === 'PENDING';

  const targetUser = target?.user ?? target;
  const targetName = targetUser
    ? `${targetUser.profile?.firstName ?? ''} ${targetUser.profile?.lastName ?? ''}`.trim() || targetUser.email
    : 'Desconocido';

  const reporter = report.reporter;
  const reporterName = reporter
    ? `${reporter.profile?.firstName ?? ''} ${reporter.profile?.lastName ?? ''}`.trim() || reporter.email
    : 'Anónimo';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Detalle Reporte</Text>
        <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 14 }}>
        <View style={styles.typeCard}>
          <View style={[styles.typeIcon, { backgroundColor: meta.color + '20' }]}>
            <Feather name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeLabel}>CONTENIDO REPORTADO</Text>
            <Text style={styles.typeName}>Reporte de {meta.label.toLowerCase()}</Text>
            <Text style={styles.reason}>{report.reason.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>REPORTADO POR</Text>
          <View style={styles.row}>
            <View style={styles.miniAv}>
              <Text style={styles.miniAvText}>{reporterName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLbl}>{reporterName}</Text>
              <Text style={styles.rowSub}>{reporter?.email ?? '—'}</Text>
            </View>
            <Text style={styles.rowTime}>{new Date(report.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</Text>
          </View>
          {otherReports > 0 && (
            <View style={styles.moreReports}>
              <Feather name="alert-triangle" size={13} color={Colors.accentDanger} />
              <Text style={styles.moreReportsText}>
                {otherReports} {otherReports === 1 ? 'reporte adicional' : 'reportes adicionales'} sobre el mismo contenido
              </Text>
            </View>
          )}
        </View>

        {report.description && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>DESCRIPCIÓN DEL REPORTE</Text>
            <Text style={styles.desc}>{report.description}</Text>
          </View>
        )}

        {target && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONTENIDO</Text>
            {report.targetType === 'POST' && (
              <>
                <View style={styles.targetHead}>
                  <View style={styles.miniAv}>
                    <Text style={styles.miniAvText}>{targetName[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLbl}>{targetName}</Text>
                    <Text style={styles.rowSub}>
                      {target._count?.reactions ?? 0} likes · {target._count?.comments ?? 0} comentarios
                    </Text>
                  </View>
                </View>
                {target.content && (
                  <Text style={styles.postBody}>{target.content}</Text>
                )}
                {target.imageUrl && (
                  <Image source={{ uri: target.imageUrl }} style={styles.targetImg} />
                )}
              </>
            )}
            {report.targetType === 'COMMENT' && (
              <>
                <View style={styles.targetHead}>
                  <View style={styles.miniAv}>
                    <Text style={styles.miniAvText}>{targetName[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <Text style={styles.rowLbl}>{targetName}</Text>
                </View>
                <Text style={styles.postBody}>"{target.content}"</Text>
              </>
            )}
            {report.targetType === 'USER' && (
              <View style={styles.targetHead}>
                <View style={styles.miniAv}>
                  <Text style={styles.miniAvText}>{targetName[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLbl}>{targetName}</Text>
                  <Text style={styles.rowSub}>{target.email}</Text>
                  <Text style={styles.rowSub}>Miembro desde {new Date(target.createdAt).toLocaleDateString('es')}</Text>
                </View>
              </View>
            )}
            {targetUser?.id && (
              <TouchableOpacity
                style={styles.viewUserBtn}
                onPress={() => router.push(`/(admin)/users/${targetUser.id}` as never)}
              >
                <Feather name="external-link" size={13} color={Colors.accentPrimary} />
                <Text style={styles.viewUserLbl}>Ver perfil del usuario</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isPending && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ACCIONES</Text>
            <TouchableOpacity style={styles.resolveBtn} onPress={() => act('RESOLVED')} disabled={busy}>
              {busy
                ? <ActivityIndicator color={Colors.textInverse} size="small" />
                : <><Feather name="check" size={16} color={Colors.textInverse} />
                    <Text style={styles.resolveLbl}>Marcar como resuelto</Text></>}
            </TouchableOpacity>
            {targetUser?.id && targetUser?.role === 'USER' && (
              <TouchableOpacity style={styles.banBtn} onPress={() => act('RESOLVED', true)} disabled={busy}>
                <Feather name="slash" size={16} color={Colors.accentDanger} />
                <Text style={styles.banLbl}>Resolver y banear autor</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.dismissBtn} onPress={() => act('DISMISSED')} disabled={busy}>
              <Feather name="x" size={14} color={Colors.textSecondary} />
              <Text style={styles.dismissLbl}>Descartar reporte</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  typeCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  typeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  typeName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  reason: { color: Colors.accentDanger, fontSize: 12, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAv: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  miniAvText: { color: Colors.textInverse, fontWeight: '800', fontSize: 13 },
  rowLbl: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  rowTime: { color: Colors.textMuted, fontSize: 11 },

  moreReports: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  moreReportsText: { color: Colors.accentDanger, fontSize: 11, fontWeight: '700', flex: 1 },

  desc: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },

  targetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postBody: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  targetImg: { width: '100%', height: 180, borderRadius: 10 },
  viewUserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderRadius: 8, alignSelf: 'flex-start',
  },
  viewUserLbl: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '700' },

  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12,
    backgroundColor: Colors.accentSuccess,
  },
  resolveLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },

  banBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  banLbl: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },

  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
  },
  dismissLbl: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
