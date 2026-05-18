// ─────────────────────────────────────────────
//  Search — Editorial Premium
//
//  Magazine search bay:
//   · Header: back + inline search input (hairline outlined)
//   · Tabs (underline) — Personas / Bares / Eventos
//   · Results: Card list with avatar + heading + caption + chevron
//   · Empty / Error / Loading via EmptyState/ErrorState/SkeletonList
// ─────────────────────────────────────────────
import {
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi, eventsApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  Hairline,
  Pressy,
  SkeletonList,
  Tabs,
  type SegmentOption,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type Tab = 'people' | 'bars' | 'events';

export default function Search() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const tabOptions: SegmentOption<Tab>[] = [
    { value: 'people', label: t ? 'Personas' : 'People' },
    { value: 'bars', label: t ? 'Bares' : 'Bars' },
    { value: 'events', label: t ? 'Eventos' : 'Events' },
  ];

  const [tab, setTab] = useState<Tab>('people');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (query: string, which: Tab) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setResults([]);
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => runSearch(q, tab), 300);
    return () => clearTimeout(id);
  }, [q, tab, runSearch]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ────────────────────────── */}
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel="Volver"
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressy>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.textMuted} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={t ? 'Buscar personas, bares, eventos' : 'Search people, bars, events'}
            placeholderTextColor={Colors.textDisabled}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            accessibilityLabel={t ? 'Buscador' : 'Search'}
          />
          {q.length > 0 ? (
            <Pressable
              onPress={() => setQ('')}
              hitSlop={HitSlop.expand}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Limpiar' : 'Clear'}
            >
              <Feather name="x-circle" size={16} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Tabs (underline) ──────────────── */}
      <View style={styles.tabsWrap}>
        <Tabs value={tab} onChange={setTab} options={tabOptions} />
      </View>

      {/* ── Results ──────────────────────── */}
      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[5] }}>
          <SkeletonList count={5} itemHeight={72} />
        </View>
      ) : q.trim().length === 0 ? (
        <EmptyState
          icon="search"
          title={t ? 'Empieza a buscar' : 'Start searching'}
          message={t ? 'Personas, bares o eventos.' : 'People, bars or events.'}
        />
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => runSearch(q, tab)}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon="frown"
          title={t ? 'Sin resultados' : 'No results'}
          message={t ? `No encontramos nada para "${q}".` : `Nothing found for "${q}".`}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(x: any) => x.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
          )}
          renderItem={({ item }) => {
            if (tab === 'people')
              return (
                <PersonRow
                  u={item}
                  onPress={() => router.push(`/(app)/users/${item.id}` as never)}
                />
              );
            if (tab === 'bars')
              return (
                <VenueRow
                  v={item}
                  onPress={() => router.push(`/(app)/venue/${item.id}` as never)}
                />
              );
            return (
              <EventRow
                ev={item}
                language={language}
                onPress={() => router.push(`/(app)/events/${item.id}` as never)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Person row ──────────────────────────────
function PersonRow({ u, onPress }: { u: any; onPress: () => void }) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || (u.email?.split('@')[0] ?? 'Usuario');
  const initials =
    ((first[0] || '') + (last[0] || '')).toUpperCase() || (u.email?.[0] ?? 'U').toUpperCase();
  const followers = u?._count?.followers ?? 0;
  const posts = u?._count?.posts ?? 0;
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={name}
      style={styles.row}
    >
      {u?.profile?.avatarUrl ? (
        <Image source={{ uri: u.profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Body weight="semiBold" numberOfLines={1}>
          {name}
        </Body>
        {u?.profile?.bio ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {u.profile.bio}
          </Caption>
        ) : null}
        <Caption tone="muted" style={{ marginTop: 2 }}>
          {`${followers} · ${posts}`}
        </Caption>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

// ── Venue row ───────────────────────────────
function VenueRow({ v, onPress }: { v: any; onPress: () => void }) {
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={v.name}
      style={styles.row}
    >
      <View style={styles.iconBox}>
        <Feather name="map-pin" size={20} color={Colors.accentChampagne} />
      </View>
      <View style={styles.rowText}>
        <Body weight="semiBold" numberOfLines={1}>
          {v.name}
        </Body>
        {v.city ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {v.city}
          </Caption>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

// ── Event row ───────────────────────────────
function EventRow({
  ev,
  language,
  onPress,
}: {
  ev: any;
  language: string;
  onPress: () => void;
}) {
  const dateLabel = ev.startDate
    ? new Date(ev.startDate).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
      })
    : '';
  const subtitle = [dateLabel, ev.venue?.name].filter(Boolean).join(' · ');
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={ev.title}
      style={styles.row}
    >
      <View style={styles.iconBox}>
        <Feather name="calendar" size={20} color={Colors.accentChampagne} />
      </View>
      <View style={styles.rowText}>
        <Body weight="semiBold" numberOfLines={1}>
          {ev.title}
        </Body>
        {subtitle ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Caption>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    minHeight: 44,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    ...TypePresets.body,
    padding: 0,
  },

  tabsWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginBottom: Spacing[2],
  },

  list: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[10],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    minHeight: 64,
  },
  rowText: {
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    ...TypePresets.label,
    color: Colors.textPrimary,
    fontSize: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
