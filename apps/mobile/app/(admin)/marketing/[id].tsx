import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

type Detail = {
  id: string;
  subject: string;
  preheader: string | null;
  headline: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  template: string;
  audienceType: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  unsubCount: number;
  failCount: number;
  createdAt: string;
  openRate: number;
  recentOpens: Array<{ email: string; openedAt: string }>;
  recentUnsubs: Array<{ email: string; unsubedAt: string }>;
};

const STATUS_META: Record<Detail['status'], { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Borrador',   color: Colors.textSecondary, bg: 'rgba(180,180,187,0.12)' },
  SCHEDULED: { label: 'Programada', color: Colors.accentInfo,    bg: 'rgba(96,165,250,0.14)' },
  SENDING:   { label: 'Enviando',   color: Colors.accentWarning, bg: 'rgba(244,163,64,0.14)' },
  SENT:      { label: 'Enviada',    color: Colors.accentSuccess, bg: 'rgba(56,199,147,0.14)' },
  FAILED:    { label: 'Fallida',    color: Colors.accentDanger,  bg: 'rgba(228,88,88,0.14)' },
  CANCELLED: { label: 'Cancelada',  color: Colors.textMuted,     bg: 'rgba(107,107,120,0.14)' },
};

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.marketing.campaign(id);
      const payload = res.data?.data ?? res.data;
      setData(payload);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'No pudimos cargar la campaña'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Live-poll while the campaign is sending
  useEffect(() => {
    if (data?.status !== 'SENDING') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data?.status, load]);

  async function sendNow() {
    if (!data) return;
    Alert.alert(
      'Enviar ahora',
      `Se enviarán ${data.recipientCount || '— ver al iniciar'} correos. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await adminApi.marketing.sendNow(data.id);
              await load();
            } catch (err: any) {
              Alert.alert('Error', apiError(err, 'No pudimos iniciar el envío'));
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  }

  async function remove() {
    if (!data) return;
    Alert.alert(
      'Eliminar campaña',
      data.status === 'SENT'
        ? 'Esta campaña ya fue enviada. Al eliminarla se perderán sus estadísticas (aperturas, bajas, destinatarios). ¿Continuar?'
        : '¿Eliminar esta campaña? No se puede deshacer.',
      [
        { text: 'Mantener', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await adminApi.marketing.delete(data.id);
              router.back();
            } catch (err: any) {
              Alert.alert('Error', apiError(err, 'No pudimos eliminar la campaña'));
              setActing(false);
            }
          },
        },
      ],
    );
  }

  async function cancel() {
    if (!data) return;
    Alert.alert('Cancelar campaña', 'No se enviará. ¿Confirmas?', [
      { text: 'Mantener', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await adminApi.marketing.cancel(data.id);
            await load();
          } catch (err: any) {
            Alert.alert('Error', apiError(err, 'No pudimos cancelar'));
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={Colors.accentDanger} />
          <Text style={styles.errorText}>{error || 'Campaña no encontrada'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnLabel}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[data.status];
  const canSendNow = data.status === 'DRAFT' || data.status === 'SCHEDULED';
  const canCancel = data.status === 'DRAFT' || data.status === 'SCHEDULED';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.hint}>Campaña</Text>
          <Text style={styles.title} numberOfLines={1}>{data.subject}</Text>
        </View>
        {data.status !== 'SENDING' && (
          <TouchableOpacity
            onPress={remove}
            style={styles.iconBtn}
            hitSlop={10}
            disabled={acting}
          >
            <Feather name="trash-2" size={18} color={Colors.accentDanger} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusRow]}>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {data.status === 'SENDING' && (
            <ActivityIndicator color={Colors.accentPrimary} style={{ marginLeft: 8 }} />
          )}
        </View>

        <View style={styles.statsGrid}>
          <BigStat label="Aperturas" value={`${data.openRate}%`} hint={`${data.openCount} de ${data.sentCount}`} />
          <BigStat label="Enviados" value={String(data.sentCount)} hint={`de ${data.recipientCount}`} />
          <BigStat label="Bajas" value={String(data.unsubCount)} hint="unsubscribes" />
          <BigStat label="Fallidos" value={String(data.failCount)} hint="rebotes / errores" />
        </View>

        <Section title="Contenido">
          <View style={styles.contentBox}>
            <Text style={styles.subject}>{data.subject}</Text>
            {data.preheader ? <Text style={styles.preheader}>{data.preheader}</Text> : null}
            <View style={styles.divider} />
            <Text style={styles.headline}>{data.headline}</Text>
            <Text style={styles.body}>{data.body}</Text>
            {data.ctaLabel && data.ctaUrl ? (
              <View style={styles.previewCta}>
                <Text style={styles.previewCtaLabel}>{data.ctaLabel}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="Detalles">
          <Row label="Plantilla" value={data.template} />
          <Row label="Audiencia" value={data.audienceType} />
          <Row
            label="Creada"
            value={new Date(data.createdAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          />
          {data.scheduledAt ? (
            <Row
              label="Programada"
              value={new Date(data.scheduledAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            />
          ) : null}
          {data.sentAt ? (
            <Row
              label="Enviada"
              value={new Date(data.sentAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            />
          ) : null}
        </Section>

        {data.recentOpens.length > 0 && (
          <Section title="Últimas aperturas">
            {data.recentOpens.map((o, i) => (
              <Row key={i} label={o.email} value={new Date(o.openedAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} />
            ))}
          </Section>
        )}

        {data.recentUnsubs.length > 0 && (
          <Section title="Últimas bajas">
            {data.recentUnsubs.map((u, i) => (
              <Row key={i} label={u.email} value={new Date(u.unsubedAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} />
            ))}
          </Section>
        )}

        <View style={{ gap: 10, marginTop: 24 }}>
          {canSendNow && (
            <TouchableOpacity
              style={[styles.primaryBtn, acting && styles.btnDisabled]}
              onPress={sendNow}
              disabled={acting}
              activeOpacity={0.85}
            >
              {acting
                ? <ActivityIndicator color={Colors.textInverse} />
                : (
                  <>
                    <Feather name="send" size={16} color={Colors.textInverse} />
                    <Text style={styles.primaryBtnLabel}>Enviar ahora</Text>
                  </>
                )}
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[styles.dangerBtn, acting && styles.btnDisabled]}
              onPress={cancel}
              disabled={acting}
              activeOpacity={0.85}
            >
              <Feather name="x-circle" size={16} color={Colors.accentDanger} />
              <Text style={styles.dangerBtnLabel}>Cancelar campaña</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
      <Text style={styles.bigStatHint}>{hint}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bigStat: {
    flexGrow: 1,
    minWidth: '47%',
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bigStatValue: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800' },
  bigStatLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  bigStatHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  sectionTitle: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.7, textTransform: 'uppercase',
    marginBottom: 8, paddingHorizontal: 4,
  },
  sectionBody: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  contentBox: { padding: 16, gap: 10 },
  subject: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  preheader: { color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 4 },
  headline: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  previewCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: Colors.accentPrimary, borderRadius: 10,
  },
  previewCtaLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.accentDanger,
  },
  dangerBtnLabel: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },

  secondaryBtn: {
    height: 44, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },

  btnDisabled: { opacity: 0.5 },
  errorText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
});
