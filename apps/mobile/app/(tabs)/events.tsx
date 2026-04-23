import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, ImageBackground, RefreshControl } from 'react-native';
import { Pressy, FadeIn } from '@/components/ui';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface EventItem {
  id: string;
  title?: string;
  name?: string;
  startDate?: string;
  imageUrl?: string;
  category?: string;
  spotsLeft?: number;
  attendees?: number;
  badge?: string;
  badgeColor?: string;
  tagLabel?: string;
  tagColor?: string;
  isFree?: boolean;
}

export default function Events() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await eventsApi.list({});
      setItems(r.data?.data?.data ?? []);
    } catch (err) {
      setItems([]);
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const data = items;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t ? 'Eventos' : 'Events'}</Text>
        <TouchableOpacity
          style={styles.searchBtn}
          hitSlop={8}
          onPress={() => router.push('/(app)/search' as never)}
        >
          <Feather name="search" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Event list */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accentPrimary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 24 }} />
        ) : error && data.length === 0 ? (
          <ErrorState
            title={t ? 'No se pudieron cargar' : 'Could not load'}
            message={error}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={() => { setLoading(true); load(); }}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t ? 'Sin eventos por ahora' : 'No events yet'}
            message={t ? 'Pronto habrá nuevos eventos. Desliza hacia abajo para refrescar.' : 'New events coming soon. Pull down to refresh.'}
          />
        ) : (
          data.map((ev, idx) => (
            <FadeIn key={ev.id} delay={idx * 70} from={24}>
              <EventCard
                ev={ev}
                t={t}
                lang={language}
                onPress={() => router.push(`/(app)/events/${ev.id}` as never)}
              />
            </FadeIn>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({
  ev, t, lang, onPress,
}: { ev: EventItem; t: boolean; lang: 'es' | 'en'; onPress: () => void }) {
  return (
    <Pressy style={styles.card} onPress={onPress}>
      {ev.imageUrl ? (
        <ImageBackground
          source={{ uri: ev.imageUrl }}
          style={styles.cardImg}
          imageStyle={{ borderTopLeftRadius: Radius.card, borderTopRightRadius: Radius.card }}
        />
      ) : (
        <View style={[styles.cardImg, { backgroundColor: Colors.bgElevated }]} />
      )}

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          {(() => {
            const cat = (ev as any).category;
            const label = cat?.name ?? ev.tagLabel;
            const color = cat?.color ?? ev.tagColor ?? Colors.accentPrimary;
            if (!label) return null;
            return (
              <View style={[styles.tagPill, { backgroundColor: color + '20' }]}>
                <Text style={[styles.tagPillText, { color }]}>
                  {String(label).toUpperCase()}
                </Text>
              </View>
            );
          })()}
          {ev.isFree && (
            <View style={[styles.tagPill, { backgroundColor: Colors.accentSuccess + '20' }]}>
              <Text style={[styles.tagPillText, { color: Colors.accentSuccess }]}>
                {t ? 'Entrada libre' : 'Free entry'}
              </Text>
            </View>
          )}
          {!ev.isFree && ev.badge && (
            <View style={[styles.tagPill, { backgroundColor: (ev.badgeColor || Colors.accentDanger) + '20' }]}>
              <Text style={[styles.tagPillText, { color: ev.badgeColor || Colors.accentDanger }]}>
                {ev.badge}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {ev.title || ev.name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {ev.startDate
                ? new Date(ev.startDate).toLocaleDateString(lang, {
                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                : t ? 'Vie 18 Abr • 21:00' : 'Fri Apr 18 • 21:00'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="users" size={12} color={Colors.accentPrimary} />
            <Text style={[styles.metaText, { color: Colors.accentPrimary }]}>
              {t ? `${ev.spotsLeft ?? 12} plazas libres` : `${ev.spotsLeft ?? 12} spots left`}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.attendees}>
            {t ? `${ev.attendees ?? 23} asistentes confirmados` : `${ev.attendees ?? 23} confirmed attendees`}
          </Text>
          <View style={styles.bookBtn}>
            <Text style={styles.bookBtnLabel}>{t ? 'Reservar mesa' : 'Book a table'}</Text>
          </View>
        </View>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800' },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, paddingTop: 8 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  cardImg: { height: 140, width: '100%' },
  cardBody: { padding: 16, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textSecondary, fontSize: 12 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  attendees: { color: Colors.textMuted, fontSize: 12 },
  bookBtn: {
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.button,
  },
  bookBtnLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
});
