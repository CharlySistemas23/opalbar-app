import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { Colors } from '@/constants/tokens';

type Filter = 'all' | 'ACTIVE' | 'BANNED' | 'PENDING_VERIFICATION';

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'ACTIVO' },
  BANNED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'BANEADO' },
  PENDING_VERIFICATION: { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'SIN VERIF.' },
  DELETED: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'ELIMINADO' },
};

const ROLE_COLOR: Record<string, string> = {
  USER: Colors.textMuted,
  MODERATOR: '#60A5FA',
  ADMIN: Colors.accentPrimary,
  SUPER_ADMIN: '#A855F7',
};

function relTime(iso?: string | null): string {
  if (!iso) return 'nunca';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}a`;
}

export default function AdminUsersList() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await adminApi.users({ limit: 100 });
      setUsers(r.data?.data?.data ?? r.data?.data ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    let list = users;
    if (filter !== 'all') list = list.filter((u) => u.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => {
        const n = `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.toLowerCase();
        return n.includes(q) || (u.email ?? '').toLowerCase().includes(q);
      });
    }
    return list;
  }, [users, filter, search]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logo}><Feather name="users" size={16} color={Colors.accentPrimary} /></View>
        <Text style={styles.title}>Usuarios</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.insightsBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/(admin)/analytics' as never)}
        >
          <Feather name="bar-chart-2" size={14} color={Colors.accentPrimary} />
          <Text style={styles.insightsBtnLbl}>Mis clientes</Text>
        </TouchableOpacity>
        <Text style={styles.count}>{users.length}</Text>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar nombre o email..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <View style={styles.tabs}>
        <Tab active={filter === 'all'} label="Todos" onPress={() => setFilter('all')} />
        <Tab active={filter === 'ACTIVE'} label="Activos" onPress={() => setFilter('ACTIVE')} />
        <Tab active={filter === 'BANNED'} label="Baneados" onPress={() => setFilter('BANNED')} />
        <Tab active={filter === 'PENDING_VERIFICATION'} label="Sin verif." onPress={() => setFilter('PENDING_VERIFICATION')} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sin usuarios que coincidan.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const fn = item.profile?.firstName ?? '';
            const ln = item.profile?.lastName ?? '';
            const name = `${fn} ${ln}`.trim() || item.email || 'Usuario';
            const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || (name[0]?.toUpperCase() ?? '?');
            const meta = STATUS_META[item.status] ?? STATUS_META.ACTIVE;
            const level = item.profile?.loyaltyLevel;
            const points = item.points ?? 0;
            const posts = item._count?.posts ?? 0;
            const reservations = item._count?.reservations ?? 0;
            const reported = item._count?.reportedItems ?? 0;
            const topInterest = item.interests?.[0]?.category;
            const city = item.profile?.city;
            const signedUpDays = Math.floor(
              (Date.now() - new Date(item.createdAt).getTime()) / 86400000,
            );
            const isNew = signedUpDays <= 7;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(admin)/users/${item.id}` as never)}
              >
                <View style={styles.cardTop}>
                  {item.profile?.avatarUrl ? (
                    <Image source={{ uri: item.profile.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{name}</Text>
                      {item.role !== 'USER' && (
                        <Text style={[styles.role, { color: ROLE_COLOR[item.role] ?? Colors.textMuted }]}>
                          · {item.role}
                        </Text>
                      )}
                      {isNew && (
                        <View style={styles.newDot}>
                          <Text style={styles.newDotText}>NUEVO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.email} numberOfLines={1}>
                      {item.email ?? item.phone ?? '—'}
                      {city ? ` · ${city}` : ''}
                    </Text>
                  </View>
                  <View style={styles.pillsCol}>
                    <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {reported > 0 && (
                      <View style={styles.alertPill}>
                        <Feather name="alert-triangle" size={10} color={Colors.accentDanger} />
                        <Text style={styles.alertPillText}>{reported}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.metaRow}>
                  {level && (
                    <View style={[styles.metaChip, { backgroundColor: (level.color || Colors.accentPrimary) + '1F' }]}>
                      <Feather
                        name={(level.icon as any) || 'star'}
                        size={10}
                        color={level.color || Colors.accentPrimary}
                      />
                      <Text style={[styles.metaChipText, { color: level.color || Colors.accentPrimary }]}>
                        {level.name}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaStat}>
                    <Feather name="award" size={10} color={Colors.accentPrimary} />
                    <Text style={styles.metaStatText}>{points}</Text>
                  </View>
                  <View style={styles.metaStat}>
                    <Feather name="message-square" size={10} color={Colors.textMuted} />
                    <Text style={styles.metaStatText}>{posts}</Text>
                  </View>
                  <View style={styles.metaStat}>
                    <Feather name="bookmark" size={10} color={Colors.textMuted} />
                    <Text style={styles.metaStatText}>{reservations}</Text>
                  </View>
                  {topInterest && (
                    <View style={[styles.metaChip, { borderColor: (topInterest.color || Colors.accentPrimary) + '55', borderWidth: StyleSheet.hairlineWidth }]}>
                      {topInterest.icon && (
                        <Feather
                          name={topInterest.icon as any}
                          size={10}
                          color={topInterest.color || Colors.accentPrimary}
                        />
                      )}
                      <Text style={[styles.metaChipText, { color: topInterest.color || Colors.accentPrimary }]}>
                        {topInterest.name}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <View style={styles.metaStat}>
                    <Feather name="clock" size={10} color={Colors.textMuted} />
                    <Text style={styles.metaStatText}>{relTime(item.lastLoginAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Tab({ active, label, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  logo: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  count: {
    color: Colors.accentPrimary, fontSize: 14, fontWeight: '800',
    backgroundColor: 'rgba(244,163,64,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  insightsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.45)',
  },
  insightsBtnLbl: {
    color: Colors.accentPrimary, fontSize: 12, fontWeight: '800',
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 8,
    paddingHorizontal: 14, height: 40,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 13, padding: 0 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  role: { fontSize: 10, fontWeight: '800' },
  newDot: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(56,199,147,0.18)',
  },
  newDotText: {
    color: Colors.accentSuccess, fontSize: 8, fontWeight: '800', letterSpacing: 0.4,
  },
  email: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  pillsCol: { alignItems: 'flex-end', gap: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  alertPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(228,88,88,0.15)',
  },
  alertPillText: {
    color: Colors.accentDanger, fontSize: 10, fontWeight: '800',
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 10, fontWeight: '700' },
  metaStat: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  metaStatText: {
    color: Colors.textSecondary, fontSize: 10, fontWeight: '700',
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
