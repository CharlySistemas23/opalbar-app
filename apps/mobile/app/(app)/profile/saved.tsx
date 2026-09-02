// ─────────────────────────────────────────────
//  Saved — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · Horizontal pill segmented row for type filter (ALL/EVENT/OFFER/POST/VENUE)
//   · Editorial cards: thumb + type kicker + serif subhead + venue meta +
//     bookmark unsave icon
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { formatDateOnly } from '@/utils/date';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

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
    content?: string | null;
    imageUrl?: string;
    coverUrl?: string;
    city?: string | null;
    startDate?: string;
    author?: { firstName?: string | null; lastName?: string | null } | null;
    venue?: { name?: string | null };
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

  const load = useCallback(async (which: Tab) => {
    try {
      setError(null);
      const r = await usersApi.savedItems(which === 'ALL' ? undefined : which);
      const rows = r.data?.data?.data ?? r.data?.data ?? [];
      setItems(rows);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(tab);
  }, [tab, load]);

  function openItem(it: SavedItem) {
    const base =
      it.type === 'EVENT'
        ? '/(app)/events'
        : it.type === 'OFFER'
          ? '/(app)/offers'
          : it.type === 'POST'
            ? '/(app)/community/posts'
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
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <View style={styles.titleBlock}>
        <Kicker tone="muted">{t ? 'COLECCIÓN' : 'COLLECTION'}</Kicker>
        <Heading size="md">{t ? 'Guardados' : 'Saved'}</Heading>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {TAB_META.map((m) => {
          const active = tab === m.key;
          return (
            <Pressy
              key={m.key}
              onPress={() => setTab(m.key)}
              haptic="select"
              accessibilityRole={Roles.tab}
              accessibilityLabel={t ? m.labelEs : m.labelEn}
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Feather
                name={m.icon}
                size={13}
                color={active ? Colors.textInverse : Colors.textSecondary}
              />
              <Caption
                tone={active ? 'inverse' : 'secondary'}
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {t ? m.labelEs : m.labelEn}
              </Caption>
            </Pressy>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[5] }}>
          <SkeletonList count={4} itemHeight={96} />
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load(tab);
          }}
        />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, minHeight: 320 }}>
          <EmptyState
            icon="bookmark"
            title={t ? 'Aún no tienes nada guardado' : 'Nothing saved yet'}
            message={
              t
                ? 'Toca el ícono de guardar en eventos, ofertas o posts para encontrarlos aquí.'
                : 'Tap the save icon on events, offers or posts to find them here.'
            }
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[5],
            paddingBottom: Spacing[12],
            gap: Spacing[3],
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(tab);
              }}
              tintColor={Colors.textMuted}
            />
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={40 * index}>
              <SavedCard item={item} t={t} onPress={() => openItem(item)} onUnsave={() => unsave(item)} />
            </FadeIn>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function SavedCard({
  item,
  t,
  onPress,
  onUnsave,
}: {
  item: SavedItem;
  t: boolean;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const target = item.target;
  const img = target?.imageUrl ?? target?.coverUrl;

  // Each saved type hydrates a different shape from the API — render the
  // fields that actually matter for that type instead of a generic card.
  let title: string;
  let subtitle: string | null = null;
  let metaLine: string | null = null;

  if (item.type === 'POST') {
    const authorName = target?.author
      ? `${target.author.firstName ?? ''} ${target.author.lastName ?? ''}`.trim() || null
      : null;
    title = authorName
      ? t
        ? `Publicación de ${authorName}`
        : `Post by ${authorName}`
      : t
        ? 'Publicación'
        : 'Post';
    subtitle = target?.content?.trim() || null;
  } else if (item.type === 'EVENT') {
    title = target?.title ?? (t ? 'Evento' : 'Event');
    const dateLabel = target?.startDate
      ? formatDateOnly(target.startDate, t ? 'es' : 'en', { month: 'short' })
      : null;
    metaLine = [dateLabel, target?.venue?.name].filter(Boolean).join(' · ') || null;
  } else if (item.type === 'OFFER') {
    title = target?.title ?? (t ? 'Oferta' : 'Offer');
    metaLine = target?.venue?.name ?? null;
  } else {
    title = target?.name ?? (t ? 'Bar' : 'Bar');
    metaLine = target?.city ?? null;
  }

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={title}
      style={styles.card}
    >
      {img ? (
        <Image source={{ uri: img }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Feather name={iconFor(item.type)} size={22} color={Colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Kicker tone="champagne">{labelFor(item.type, t)}</Kicker>
        <Subhead numberOfLines={2} style={{ marginTop: 2 }}>
          {title}
        </Subhead>
        {subtitle ? (
          <Caption tone="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Caption>
        ) : null}
        {metaLine ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {metaLine}
          </Caption>
        ) : null}
      </View>
      <Pressy
        onPress={onUnsave}
        haptic="warning"
        accessibilityRole={Roles.button}
        accessibilityLabel={t ? 'Quitar de guardados' : 'Remove from saved'}
        hitSlop={HitSlop.expand}
        style={styles.unsaveBtn}
      >
        <Feather name="bookmark" size={18} color={Colors.accentPrimary} />
      </Pressy>
    </Pressy>
  );
}

function iconFor(type: SavedItem['type']): FeatherIcon {
  return type === 'EVENT'
    ? 'calendar'
    : type === 'OFFER'
      ? 'tag'
      : type === 'POST'
        ? 'message-square'
        : 'map-pin';
}

function labelFor(type: SavedItem['type'], t: boolean) {
  return type === 'EVENT'
    ? t ? 'EVENTO' : 'EVENT'
    : type === 'OFFER'
      ? t ? 'OFERTA' : 'OFFER'
      : type === 'POST'
        ? 'POST'
        : t ? 'BAR' : 'BAR';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  filters: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minHeight: 36,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    padding: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsaveBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
