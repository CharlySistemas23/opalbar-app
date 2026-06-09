import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, Kicker, Numeric, Subhead } from '@/components/ui';
import { AdminHeader, StatusPill } from '@/components/admin';

type Campaign = {
  id: string;
  subject: string;
  template: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  audienceType: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  unsubCount: number;
  failCount: number;
  createdAt: string;
};

const STATUS_TONE: Record<
  Campaign['status'],
  { tone: 'neutral' | 'info' | 'accent' | 'success' | 'danger'; label: string }
> = {
  DRAFT: { tone: 'neutral', label: 'BORRADOR' },
  SCHEDULED: { tone: 'info', label: 'PROGRAMADA' },
  SENDING: { tone: 'accent', label: 'ENVIANDO' },
  SENT: { tone: 'success', label: 'ENVIADA' },
  FAILED: { tone: 'danger', label: 'FALLIDA' },
  CANCELLED: { tone: 'neutral', label: 'CANCELADA' },
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Todos',
  NEW_7D: 'Nuevos (7d)',
  VIP: 'VIP',
  BIRTHDAY_MONTH: 'Cumpleaneros',
  INACTIVE_30D: 'Inactivos (30d)',
  CUSTOM: 'Segmento',
};

export default function MarketingList() {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminApi.marketing.listCampaigns();
      setItems(res.data?.data ?? res.data ?? []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'No pudimos cargar las campanas'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Campanas"
        kicker="Email marketing"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push('/(admin)/marketing/new' as never)}
            accessibilityRole="button"
            accessibilityLabel="Nueva campana"
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          >
            <Feather name="plus" size={14} color={Colors.textInverse} />
            <Caption tone="inverse" style={{ fontWeight: '700' }}>Nueva</Caption>
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Caption tone="danger" style={{ marginBottom: Spacing[3], paddingHorizontal: 4 }}>
              {error}
            </Caption>
          ) : null}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="mail" size={32} color={Colors.textMuted} />
              <Subhead style={{ marginTop: Spacing[2] }}>Aun no hay campanas</Subhead>
              <Caption tone="secondary" align="center" style={{ paddingHorizontal: 24 }}>
                Crea tu primer envio masivo — elige plantilla, audiencia y envia.
              </Caption>
              <View style={{ width: '60%', marginTop: Spacing[2] }}>
                <Button
                  label="Crear campana"
                  variant="primary"
                  onPress={() => router.push('/(admin)/marketing/new' as never)}
                  leftIcon={<Feather name="plus" size={14} color={Colors.textInverse} />}
                />
              </View>
            </View>
          ) : (
            items.map((c) => {
              const meta = STATUS_TONE[c.status];
              const openRate = c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100) : 0;
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => router.push(`/(admin)/marketing/${c.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={c.subject}
                >
                  <View style={styles.cardHead}>
                    <StatusPill label={meta.label} tone={meta.tone} />
                    <Caption tone="muted" style={{ fontWeight: '600' }}>
                      {AUDIENCE_LABEL[c.audienceType] || c.audienceType}
                    </Caption>
                  </View>

                  <Subhead numberOfLines={2}>{c.subject}</Subhead>

                  <View style={styles.statsRow}>
                    <Stat label="Enviados" value={`${c.sentCount}/${c.recipientCount}`} />
                    <View style={styles.statsDivider} />
                    <Stat label="Aperturas" value={`${openRate}%`} />
                    <View style={styles.statsDivider} />
                    <Stat label="Bajas" value={String(c.unsubCount)} />
                  </View>

                  <Caption tone="muted" size="sm">
                    {c.scheduledAt && c.status === 'SCHEDULED'
                      ? `Programada · ${new Date(c.scheduledAt).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : c.sentAt
                        ? `Enviada · ${new Date(c.sentAt).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : `Creada · ${new Date(c.createdAt).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                          })}`}
                  </Caption>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Body weight="bold" size="sm">{value}</Body>
      <Caption tone="muted" size="sm" style={{ marginTop: 2 }}>
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: Spacing[3],
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.full,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    marginBottom: Spacing[2],
    gap: Spacing[2],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[2],
  },
  statsDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: Colors.border },

  empty: {
    marginTop: 60,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing[5],
  },
});
