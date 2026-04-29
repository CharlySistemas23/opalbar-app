// ─────────────────────────────────────────────
//  UserPicker — modal compacto para buscar y elegir un usuario.
//  Se usa en: Crear reserva manual, Crear ticket, Mensaje como plataforma.
//  · Buscador con debounce 300ms
//  · Lista con avatar + nombre + email
//  · onSelect devuelve el user completo
// ─────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Modal, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { adminApi } from '@/api/client';

export interface PickedUser {
  id: string;
  email: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string | null };
}

export function UserPicker({
  visible,
  onClose,
  onSelect,
  title = 'Buscar usuario',
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (u: PickedUser) => void;
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PickedUser[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!visible) { setSearch(''); setResults([]); return; }
  }, [visible]);

  useEffect(() => {
    if (!visible || debounced.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    adminApi.users({ search: debounced, limit: 12 })
      .then((r) => {
        if (cancelled) return;
        const list = r.data?.data?.data ?? r.data?.data ?? r.data ?? [];
        setResults(Array.isArray(list) ? list : []);
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [debounced, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Nombre o email…"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              style={styles.searchInput}
            />
          </View>

          {debounced.length < 2 ? (
            <Text style={styles.hint}>Escribí al menos 2 caracteres</Text>
          ) : loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : results.length === 0 ? (
            <Text style={styles.hint}>Sin resultados.</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const fn = item.profile?.firstName ?? '';
                const ln = item.profile?.lastName ?? '';
                const fullName = `${fn} ${ln}`.trim() || item.email;
                const initials = ((fn[0] ?? item.email[0] ?? '?')).toUpperCase();
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(item); onClose(); }}
                    style={styles.row}
                  >
                    {item.profile?.avatarUrl ? (
                      <Image source={{ uri: item.profile.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.initials}>{initials}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                      <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', backgroundColor: Colors.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Inter_700Bold' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 4 },
  hint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { backgroundColor: Colors.accentPrimary + '22', alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: Colors.accentPrimary, fontSize: 13 },
  name: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  email: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
});
