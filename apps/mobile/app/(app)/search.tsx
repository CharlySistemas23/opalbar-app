import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image, Keyboard } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi, eventsApi, venueApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

type Tab = 'people' | 'bars' | 'events';
const TABS: { key: Tab; label: { es: string; en: string } }[] = [
  { key: 'people', label: { es: 'Personas', en: 'People' } },
  { key: 'bars',   label: { es: 'Bares',    en: 'Bars' } },
  { key: 'events', label: { es: 'Eventos',  en: 'Events' } },
];

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function Search() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('people');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const runSearch = useCallback(async (query: string, which: Tab) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      if (which === 'people') {
        const r = await usersApi.search(query);
        setResults(r.data?.data ?? []);
      } else if (which === 'bars') {
        const r = await venueApi.list({ search: query });
        setResults(r.data?.data?.data ?? r.data?.data ?? []);
      } else {
        const r = await eventsApi.list({ search: query });
        setResults(r.data?.data?.data ?? []);
      }
    } catch {
      setResults([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => runSearch(q, tab), 300);
    return () => clearTimeout(id);
  }, [q, tab, runSearch]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.textMuted} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={t ? 'Buscar…' : 'Search…'}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
              <Feather name="x-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((T) => {
          const selected = T.key === tab;
          return (
            <TouchableOpacity
              key={T.key}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => setTab(T.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                {T.label[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : q.trim().length === 0 ? (
        <View style={styles.center}>
          <Feather name="search" size={42} color={Colors.textMuted} />
          <Text style={styles.placeholder}>
            {t ? 'Busca personas, bares o eventos' : 'Search people, bars or events'}
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Feather name="frown" size={42} color={Colors.textMuted} />
          <Text style={styles.placeholder}>
            {t ? 'Sin resultados para' : 'No results for'} "{q}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (tab === 'people') return <PersonRow u={item} onPress={() => router.push(`/(app)/users/${item.id}` as never)} />;
            if (tab === 'bars')   return <VenueRow v={item} onPress={() => router.push(`/(app)/venue/${item.id}` as never)} />;
            return <EventRow ev={item} t={t} onPress={() => router.push(`/(app)/events/${item.id}` as never)} />;
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PersonRow({ u, onPress }: { u: any; onPress: () => void }) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || (u.email?.split('@')[0] ?? 'Usuario');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || (u.email?.[0] ?? 'U').toUpperCase();
  const followers = u?._count?.followers ?? 0;
  const posts = u?._count?.posts ?? 0;
  const events = u?._count?.events ?? 0;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      {u?.profile?.avatarUrl
        ? <Image source={{ uri: u.profile.avatarUrl }} style={styles.avatar} />
        : <View style={[styles.avatar, { backgroundColor: colorFor(u.id) }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{name}</Text>
        {u?.profile?.bio ? <Text style={styles.rowSub} numberOfLines={1}>{u.profile.bio}</Text> : null}
        <Text style={styles.rowMeta}>
          {followers} seguidores • {posts} posts • {events} eventos
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function VenueRow({ v, onPress }: { v: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.avatar, { backgroundColor: Colors.bgElevated }]}>
        <Feather name="map-pin" size={20} color={Colors.accentPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{v.name}</Text>
        <Text style={styles.rowSub}>{v.city}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function EventRow({ ev, t, onPress }: { ev: any; t: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.avatar, { backgroundColor: Colors.bgElevated }]}>
        <Feather name="calendar" size={20} color={Colors.accentPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{ev.title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : ''} • {ev.venue?.name || ''}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: Colors.textInverse, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  placeholder: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
});
