import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Modal, Alert } from 'react-native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';

interface StaffUser {
  id: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'USER';
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  createdAt?: string;
}

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'];

export default function AdminStaff() {
  const router = useRouter();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<StaffUser[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function changeRole(id: string, role: StaffUser['role']) {
    setSaving(true);
    try {
      await adminApi.updateUserRole(id, role);
      await load();
      setEditing(null);
      setShowInvite(false);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally { setSaving(false); }
  }

  async function searchUsers(q: string) {
    setInviteSearch(q);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    setInviteLoading(true);
    try {
      const r = await adminApi.users({ search: q, limit: 20 });
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      setInviteResults(rows.filter((u: StaffUser) => u.role === 'USER'));
    } catch {} finally { setInviteLoading(false); }
  }

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await adminApi.users({ limit: 200 });
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      setUsers(rows.filter((u: StaffUser) => STAFF_ROLES.includes(u.role)));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q);
    });
  }, [users, search]);

  const counts = useMemo(() => ({
    SUPER_ADMIN: users.filter((u) => u.role === 'SUPER_ADMIN').length,
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    MODERATOR: users.filter((u) => u.role === 'MODERATOR').length,
  }), [users]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Equipo staff</Text>
        {isSuperAdmin ? (
          <TouchableOpacity onPress={() => setShowInvite(true)} style={[styles.backBtn, { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary }]} hitSlop={10}>
            <Feather name="user-plus" size={18} color={Colors.textInverse} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
      </View>

      <View style={styles.summary}>
        <View style={[styles.statCard, { borderColor: Colors.accentPrimary + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.accentPrimary }]}>{counts.SUPER_ADMIN}</Text>
          <Text style={styles.statLbl}>Super admin</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#60A5FA' + '40' }]}>
          <Text style={[styles.statValue, { color: '#60A5FA' }]}>{counts.ADMIN}</Text>
          <Text style={styles.statLbl}>Admin</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.accentSuccess + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.accentSuccess }]}>{counts.MODERATOR}</Text>
          <Text style={styles.statLbl}>Moderador</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o correo"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
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
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = `${item.profile?.firstName ?? ''} ${item.profile?.lastName ?? ''}`.trim() || item.email || '—';
            const initials = ((item.profile?.firstName?.[0] ?? 'S') + (item.profile?.lastName?.[0] ?? '')).toUpperCase();
            const roleMeta = roleInfo(item.role);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => isSuperAdmin ? setEditing(item) : router.push(`/(admin)/users/${item.id}` as never)}
              >
                <View style={[styles.avatar, { backgroundColor: roleMeta.color }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                  {item.email ? <Text style={styles.cardSub} numberOfLines={1}>{item.email}</Text> : null}
                  <View style={[styles.rolePill, { backgroundColor: roleMeta.color + '20' }]}>
                    <Feather name={roleMeta.icon} size={10} color={roleMeta.color} />
                    <Text style={[styles.roleLbl, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Change role modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditing(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar rol</Text>
            <Text style={styles.modalSub}>
              {editing?.profile?.firstName ?? editing?.email ?? ''}
            </Text>
            <View style={{ gap: 8, marginTop: 14 }}>
              {(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'USER'] as const).map((r) => {
                const meta = roleInfo(r as StaffUser['role']);
                const active = editing?.role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, active && { borderColor: meta.color, backgroundColor: meta.color + '15' }]}
                    disabled={saving}
                    onPress={() => editing && changeRole(editing.id, r)}
                    activeOpacity={0.85}
                  >
                    <Feather name={meta.icon} size={16} color={meta.color} />
                    <Text style={styles.roleOptionLbl}>{meta.label}</Text>
                    {active && <Feather name="check" size={16} color={meta.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {saving && <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 10 }} />}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={saving}>
              <Text style={styles.cancelLbl}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Invite staff modal */}
      <Modal visible={showInvite} transparent animationType="fade" onRequestClose={() => setShowInvite(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowInvite(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Asignar rol staff</Text>
            <Text style={styles.modalSub}>Busca al usuario por nombre o correo.</Text>
            <View style={[styles.searchBox, { marginTop: 12, marginHorizontal: 0 }]}>
              <Feather name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar usuarios"
                placeholderTextColor={Colors.textMuted}
                value={inviteSearch}
                onChangeText={searchUsers}
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <View style={{ maxHeight: 260, marginTop: 10 }}>
              {inviteLoading ? (
                <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 12 }} />
              ) : inviteResults.length === 0 ? (
                <Text style={styles.emptyMini}>
                  {inviteSearch.trim().length < 2 ? 'Escribe al menos 2 caracteres.' : 'Sin resultados.'}
                </Text>
              ) : (
                <FlatList
                  data={inviteResults}
                  keyExtractor={(x) => x.id}
                  renderItem={({ item }) => {
                    const name = `${item.profile?.firstName ?? ''} ${item.profile?.lastName ?? ''}`.trim() || item.email || '—';
                    return (
                      <TouchableOpacity
                        style={styles.inviteRow}
                        activeOpacity={0.85}
                        onPress={() => setEditing(item)}
                      >
                        <View style={[styles.avatar, { backgroundColor: Colors.textMuted, width: 36, height: 36, borderRadius: 18 }]}>
                          <Text style={[styles.avatarText, { fontSize: 13 }]}>
                            {(item.profile?.firstName?.[0] ?? 'U').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                          {item.email ? <Text style={styles.cardSub} numberOfLines={1}>{item.email}</Text> : null}
                        </View>
                        <Feather name="chevron-right" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
              <Text style={styles.cancelLbl}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function roleInfo(role: StaffUser['role']) {
  if (role === 'SUPER_ADMIN') return { label: 'Super admin', color: Colors.accentPrimary, icon: 'star' as const };
  if (role === 'ADMIN') return { label: 'Admin', color: '#60A5FA', icon: 'shield' as const };
  if (role === 'MODERATOR') return { label: 'Moderador', color: Colors.accentSuccess, icon: 'check-circle' as const };
  return { label: 'Usuario', color: Colors.textMuted, icon: 'user' as const };
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

  summary: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  statCard: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.bgCard, borderWidth: 1,
    alignItems: 'center', gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLbl: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12,
    paddingHorizontal: 14, height: 44,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

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
    flexDirection: 'row', gap: 12, alignItems: 'center',
    padding: 12, backgroundColor: Colors.bgCard,
    borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 16, fontWeight: '800' },
  cardName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  roleLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  modalSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  roleOptionLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  cancelBtn: {
    marginTop: 12, height: 44, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },

  emptyMini: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 14 },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
});
