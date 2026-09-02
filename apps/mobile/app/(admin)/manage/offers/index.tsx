import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, offersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Caption,
  ConfirmDialog,
  Input,
  Kicker,
  SegmentedControl,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { AdminHeader, StatusPill } from '@/components/admin';
import type { SegmentOption } from '@/components/ui';

type Filter = 'all' | 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'EXPIRED';

const STATUS_TONE: Record<
  string,
  { tone: 'success' | 'neutral' | 'danger' | 'info'; label: string }
> = {
  ACTIVE: { tone: 'success', label: 'ACTIVA' },
  DRAFT: { tone: 'neutral', label: 'BORRADOR' },
  PAUSED: { tone: 'info', label: 'PAUSADA' },
  EXPIRED: { tone: 'danger', label: 'ARCHIVADA' },
  DEPLETED: { tone: 'info', label: 'AGOTADA' },
};

export default function AdminOffersList() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const me = useAuthStore((s) => s.user);
  // Backend: offers create/update/delete are ADMIN/SUPER_ADMIN only.
  const canWrite = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await offersApi.list({ limit: 100, includeAll: true });
      setOffers(r.data?.data?.data ?? r.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function performDelete() {
    if (!confirmDel) return;
    const id = confirmDel.id;
    const previous = offers;
    setOffers((prev) => prev.filter((o) => o.id !== id));
    setConfirmDel(null);
    try {
      await adminApi.deleteOffer(id);
    } catch (err) {
      setOffers(previous);
      Alert.alert('Error', apiError(err));
    }
  }

  const shown = useMemo(() => {
    let list = offers;
    if (filter !== 'all') list = list.filter((o) => o.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => (o.title ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [offers, filter, search]);

  const segments: SegmentOption<Filter>[] = [
    { value: 'all', label: `Todas (${offers.length})` },
    { value: 'ACTIVE', label: 'Activas' },
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'PAUSED', label: 'Pausadas' },
    { value: 'EXPIRED', label: 'Archivadas' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Ofertas"
        kicker="Gestión"
        onBack={goBack}
        right={
          canWrite ? (
            <Pressable
              onPress={() => router.push('/(admin)/manage/offers/new' as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Nueva oferta"
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Feather name="plus" size={18} color={Colors.textInverse} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.searchWrap}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar oferta..."
          leftIcon={<Feather name="search" size={16} color={Colors.textMuted} />}
        />
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={segments} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="tag" size={32} color={Colors.textMuted} />
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                No hay ofertas que coincidan.
              </Caption>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_TONE[item.status] ?? STATUS_TONE.DRAFT;
            return (
              <View style={styles.card}>
                <Pressable
                  style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                  onPress={() => router.push(`/(admin)/manage/offers/${item.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Feather name="tag" size={20} color={Colors.accentPrimary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{item.title}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {item.venue?.name ?? '—'}
                    </Caption>
                    <Caption tone="muted" size="sm" style={{ marginTop: 2 }}>
                      {item.currentRedemptions ?? 0}
                      {item.maxRedemptions ? ` / ${item.maxRedemptions}` : ''} canjes
                    </Caption>
                  </View>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </Pressable>
                <View style={styles.quickActions}>
                  <Pressable
                    style={({ pressed }) => [styles.chip, styles.chipAccent, pressed && styles.pressed]}
                    onPress={() => router.push(`/(admin)/manage/offers/${item.id}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel="Editar"
                  >
                    <Feather name="edit-2" size={12} color={Colors.accentPrimary} />
                    <Kicker style={{ color: Colors.accentPrimary, fontSize: 10 }}>Editar</Kicker>
                  </Pressable>
                  {canWrite ? (
                    <Pressable
                      style={({ pressed }) => [styles.chip, styles.chipDanger, pressed && styles.pressed]}
                      onPress={() => setConfirmDel({ id: item.id, title: item.title })}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar"
                    >
                      <Feather name="trash-2" size={12} color={Colors.accentDanger} />
                      <Kicker style={{ color: Colors.accentDanger, fontSize: 10 }}>Eliminar</Kicker>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={performDelete}
        title="Eliminar oferta"
        description={`¿Eliminar "${confirmDel?.title ?? ''}" permanentemente? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: { paddingHorizontal: Spacing[5], paddingTop: Spacing[2] },
  tabsWrap: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingBottom: Spacing[3],
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 30,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipAccent: {
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderColor: 'rgba(201,169,97,0.30)',
  },
  chipDanger: {
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderColor: 'rgba(196,104,104,0.30)',
  },
  thumb: { width: 56, height: 56, borderRadius: Radius.lg },
  thumbPlaceholder: {
    backgroundColor: 'rgba(201,169,97,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 60 },
});
