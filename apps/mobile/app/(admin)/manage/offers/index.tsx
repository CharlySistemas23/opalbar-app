import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, offersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

type Filter = 'all' | 'ACTIVE' | 'DRAFT' | 'EXPIRED';

export default function AdminOffersList() {
  const router = useRouter();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await offersApi.list({ limit: 100, includeAll: true });
      setOffers(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(id: string, title: string) {
    Alert.alert(
      'Eliminar oferta',
      `¿Eliminar "${title}" permanentemente? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // Optimistic: desaparece al instante.
            const previous = offers;
            setOffers((prev) => prev.filter((o) => o.id !== id));
            try {
              await adminApi.deleteOffer(id);
            } catch (err) {
              setOffers(previous);
              Alert.alert('Error', apiError(err));
            }
          },
        },
      ],
    );
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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Ofertas</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(admin)/manage/offers/new' as never)}
          hitSlop={10}
        >
          <Feather name="plus" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar oferta..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label={`Todas (${offers.length})`} onPress={() => setFilter('all')} />
        <Tab active={filter === 'ACTIVE'} label="Activas" onPress={() => setFilter('ACTIVE')} />
        <Tab active={filter === 'DRAFT'} label="Borrador" onPress={() => setFilter('DRAFT')} />
        <Tab active={filter === 'EXPIRED'} label="Archivadas" onPress={() => setFilter('EXPIRED')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="tag" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay ofertas que coincidan.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/manage/offers/${item.id}` as never)}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Feather name="tag" size={22} color={Colors.accentPrimary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {item.venue?.name ?? '—'}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.currentRedemptions ?? 0}{item.maxRedemptions ? ` / ${item.maxRedemptions}` : ''} canjes
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </TouchableOpacity>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push(`/(admin)/manage/offers/${item.id}` as never)}
                  activeOpacity={0.85}
                >
                  <Feather name="edit-2" size={13} color={Colors.accentPrimary} />
                  <Text style={styles.editLbl}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.archiveBtn}
                  onPress={() => confirmDelete(item.id, item.title)}
                  activeOpacity={0.85}
                >
                  <Feather name="trash-2" size={13} color={Colors.accentDanger} />
                  <Text style={styles.archiveLbl}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ACTIVE: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'ACTIVA' },
    DRAFT: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'BORRADOR' },
    EXPIRED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'ARCHIVADA' },
    DEPLETED: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', label: 'AGOTADA' },
  };
  const m = map[status] ?? map.DRAFT;
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[styles.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 8,
    paddingHorizontal: 14, height: 44,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 8, flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12,
  },
  quickActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
    paddingTop: 2,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.12)',
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
  },
  editLbl: { color: Colors.accentPrimary, fontSize: 11, fontWeight: '700' },
  archiveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32, borderRadius: 8,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  archiveLbl: { color: Colors.accentDanger, fontSize: 11, fontWeight: '700' },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(244,163,64,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
