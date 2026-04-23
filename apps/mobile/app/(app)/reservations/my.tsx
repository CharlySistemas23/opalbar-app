import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { reservationsApi, eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

const STATUS_STYLE: Record<string, { color: string; label: { es: string; en: string } }> = {
  CONFIRMED: { color: Colors.accentSuccess, label: { es: 'Confirmada', en: 'Confirmed' } },
  PENDING:   { color: Colors.accentPrimary, label: { es: 'Pendiente',  en: 'Pending'   } },
  CANCELLED: { color: Colors.accentDanger,  label: { es: 'Cancelada',  en: 'Cancelled' } },
  COMPLETED: { color: Colors.textMuted,     label: { es: 'Completada', en: 'Completed' } },
};

type Tab = 'tables' | 'events';

export default function MyReservations() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tab, setTab] = useState<Tab>('tables');
  const [tables, setTables] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, eRes] = await Promise.all([
        reservationsApi.my(),
        eventsApi.my(),
      ]);
      setTables(tRes?.data?.data?.data ?? tRes?.data?.data ?? []);
      setEvents(eRes?.data?.data ?? []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    load();
  }

  const data = tab === 'tables' ? tables : events;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Mis reservas' : 'My bookings'}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/reservations/new' as never)}
          hitSlop={10}
        >
          <Feather name="plus" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TabButton
          active={tab === 'tables'}
          label={t ? `Mesas (${tables.length})` : `Tables (${tables.length})`}
          onPress={() => setTab('tables')}
        />
        <TabButton
          active={tab === 'events'}
          label={t ? `Eventos (${events.length})` : `Events (${events.length})`}
          onPress={() => setTab('events')}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error && data.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id ?? String(i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentPrimary} />}
          renderItem={({ item }) => tab === 'tables'
            ? <TableCard item={item} t={t} language={language} onPress={() => router.push(`/(app)/reservations/${item.id}` as never)} />
            : <EventCard item={item} t={t} language={language} onPress={() => router.push(`/(app)/events/${item.event?.id ?? item.eventId}` as never)} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'tables' ? 'calendar' : 'star'}
              title={tab === 'tables'
                ? (t ? 'Aún no tienes mesas reservadas' : 'No tables booked yet')
                : (t ? 'Aún no asistes a ningún evento' : 'Not attending any events yet')}
              actionLabel={tab === 'tables'
                ? (t ? 'Reservar mesa' : 'Book a table')
                : (t ? 'Explorar eventos' : 'Explore events')}
              onAction={() => router.push(tab === 'tables' ? '/(app)/reservations/new' as never : '/(tabs)/events' as never)}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TableCard({ item, t, language, onPress }: any) {
  const status = STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDING;
  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString(language, { day: 'numeric', month: 'short' })
    : '';
  const timeStr = item.timeSlot ?? '';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Feather name="calendar" size={20} color={Colors.accentPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.venue?.name || (t ? 'Reserva' : 'Booking')}
          </Text>
          <Text style={styles.cardMeta}>
            {dateStr}{timeStr ? ` · ${timeStr}` : ''} · {item.partySize ?? 2} {t ? 'personas' : 'people'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label[language as 'es' | 'en']}</Text>
        </View>
      </View>
      {item.specialRequests ? <Text style={styles.notes} numberOfLines={2}>{item.specialRequests}</Text> : null}
    </TouchableOpacity>
  );
}

function EventCard({ item, t, language, onPress }: any) {
  const ev = item.event ?? item;
  const title = language === 'es' ? ev.title : (ev.titleEn || ev.title);
  const dateStr = ev.date
    ? new Date(ev.date).toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  const venue = ev.venue?.name;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
          <Feather name="star" size={20} color="#A855F7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardMeta}>
            {dateStr}{venue ? ` · ${venue}` : ''}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: 'rgba(56,199,147,0.2)' }]}>
          <Text style={[styles.statusText, { color: Colors.accentSuccess }]}>
            {t ? 'Asistiré' : 'Attending'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(244,163,64,0.15)',
    borderColor: Colors.accentPrimary,
  },
  tabLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: Colors.accentPrimary, fontWeight: '700' },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.card, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  notes: { color: Colors.textMuted, fontSize: 12, paddingLeft: 60 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  newBtn: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Colors.accentPrimary, borderRadius: Radius.button,
  },
  newBtnLabel: { color: Colors.textInverse, fontWeight: '700' },
});
