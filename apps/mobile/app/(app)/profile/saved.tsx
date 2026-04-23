import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { toast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Radius } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Tab = 'ALL' | 'EVENT' | 'OFFER' | 'POST' | 'VENUE';

interface SavedItem {
  id: string;
  type: 'EVENT' | 'OFFER' | 'POST' | 'VENUE';
  targetId: string;
  createdAt: string;
  target?: {
    id: string;
    title?: string;
    name?: string;
    imageUrl?: string;
    coverUrl?: string;
    venue?: { name?: string };
  };
}

const TAB_META: { key: Tab; labelEs: string; labelEn: string; icon: FeatherIcon }[] = [
  { key: 'ALL', labelEs: 'Todo', labelEn: 'All', icon: 'bookmark' },
  { key: 'EVENT', labelEs: 'Eventos', labelEn: 'Events', icon: 'calendar' },
  { key: 'OFFER', labelEs: 'Ofertas', labelEn: 'Offers', icon: 'tag' },
  { key: 'POST', labelEs: 'Posts', labelEn: 'Posts', icon: 'message-square' },
  { key: 'VENUE', labelEs: 'Bares', labelEn: 'Bars', icon: 'map-pin' },
];

export default function Saved() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('ALL');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tab: Tab) => {
    try {
      setError(null);
      const r = await usersApi.savedItems(tab === 'ALL' ? undefined : tab);
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      setItems(rows);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(tab); }, [tab, load]);

  function openItem(it: SavedItem) {
    const base =
      it.type === 'EVENT' ? '/(app)/events'
      : it.type === 'OFFER' ? '/(app)/offers'
      : it.type === 'POST' ? '/(app)/community/posts'
      : '/(app)/venue';
    router.push(`${base}/${it.targetId}` as never);
  }

  async function unsave(it: SavedItem) {
    setItems((p) => p.filter((x) => x.id !== it.id));
    try {
      await usersApi.toggleSave(it.type, it.targetId);
      toast(t ? 'Quitado de guardados.' : 'Removed from saved.', 'info');
    } catch {
      load(tab);
      toast(t ? 'No se pudo actualizar.' : 'Could not update.', 'danger');
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Guardados' : 'Saved'}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabs}>
        <FlatList
          horizontal
          data={TAB_META}
          keyExtractor={(x) => x.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          renderItem={({ item }) => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(item.key)}
                activeOpacity={0.85}
              >
                <Feather name={item.icon} size={14} color={active ? Colors.textInverse : Colors.textSecondary} />
                <Text style={[styles.tabLbl, active && styles.tabLblActive]}>
                  {t ? item.labelEs : item.labelEn}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(tab); }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={t ? 'Aún no tienes nada guardado' : 'Nothing saved yet'}
          message={t
            ? 'Toca el ícono de guardar en eventos, ofertas o posts para encontrarlos aquí.'
            : 'Tap the save icon on events, offers or posts to find them here.'}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(tab); }}
              tintColor={Colors.accentPrimary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openItem(item)}>
              {item.target?.imageUrl || item.target?.coverUrl ? (
                <Image source={{ uri: (item.target.imageUrl ?? item.target.coverUrl)! }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Feather name={iconFor(item.type)} size={22} color={Colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.typeChip}>{labelFor(item.type, t)}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.target?.title ?? item.target?.name ?? (t ? 'Elemento guardado' : 'Saved item')}
                </Text>
                {item.target?.venue?.name ? (
                  <Text style={styles.cardSub} numberOfLines={1}>{item.target.venue.name}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => unsave(item)} hitSlop={10} style={styles.removeBtn}>
                <Feather name="bookmark" size={18} color={Colors.accentPrimary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function iconFor(type: SavedItem['type']): FeatherIcon {
  return type === 'EVENT' ? 'calendar'
    : type === 'OFFER' ? 'tag'
    : type === 'POST' ? 'message-square'
    : 'map-pin';
}

function labelFor(type: SavedItem['type'], t: boolean) {
  return type === 'EVENT' ? (t ? 'Evento' : 'Event')
    : type === 'OFFER' ? (t ? 'Oferta' : 'Offer')
    : type === 'POST' ? 'Post'
    : (t ? 'Bar' : 'Bar');
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

  tabs: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  tabLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabLblActive: { color: Colors.textInverse },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.accentPrimary, marginTop: 4,
  },
  retryLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyMsg: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    padding: 12, backgroundColor: Colors.bgCard,
    borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.border,
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: Colors.bgElevated },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  typeChip: {
    color: Colors.accentPrimary, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  cardSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
