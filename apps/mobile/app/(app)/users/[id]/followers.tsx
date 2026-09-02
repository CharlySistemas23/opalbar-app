// ─────────────────────────────────────────────
//  Followers — Editorial Premium
//
//  Magazine-style follower roster:
//   · Top bar: back + Kicker count (meta.total) + Heading "Seguidores"
//   · Body: card-shelled FlatList, paginated (GET /users/:id/followers?page&limit)
//   · Private accounts → 403 → "Cuenta privada" state
//   · Empty / Error / Loading via primitives (EmptyState/ErrorState/SkeletonList)
// ─────────────────────────────────────────────
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { Badge, Body, Caption, Hairline, Heading, Kicker, Pressy, SkeletonList } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { useRealtime } from '@/hooks/useRealtime';

interface UserRecord {
  id: string;
  isPrivate?: boolean;
  since?: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string | null };
}

interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

const PAGE_SIZE = 30;

export default function Followers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const fetchPage = useCallback(
    async (page: number) => {
      const reqId = ++reqRef.current;
      const r = await usersApi.followers(id, { page, limit: PAGE_SIZE });
      if (reqId !== reqRef.current) return null;
      const payload = r.data?.data ?? {};
      const rows: UserRecord[] = Array.isArray(payload.data) ? payload.data : [];
      return { rows, meta: (payload.meta ?? null) as PageMeta | null };
    },
    [id],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetchPage(1);
        if (!res) return;
        setItems(res.rows);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!silent) setError(apiError(err));
        else toast(apiError(err), 'danger');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !meta?.hasNextPage) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(meta.page + 1);
      if (!res) return;
      setItems((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...res.rows.filter((u) => !seen.has(u.id))];
      });
      setMeta(res.meta);
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, meta]);

  useEffect(() => {
    void load();
  }, [id, load]);

  // Follow/unfollow events targeting this user → silent refresh.
  useRealtime('user', (env) => {
    const d: any = env?.data ?? {};
    if (typeof d?.follow !== 'boolean') return;
    if (env?.id === id) void load(true);
  });

  const total = meta?.total ?? items.length;
  const isPrivateError = !!error && /privad|private/i.test(error);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header
        title={t ? 'Seguidores' : 'Followers'}
        count={total}
        backLabel={t ? 'Volver' : 'Back'}
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={6} itemHeight={64} />
        </View>
      ) : error && items.length === 0 ? (
        isPrivateError ? (
          <EmptyState
            icon="lock"
            title={t ? 'Cuenta privada' : 'Private account'}
            message={
              t
                ? 'Sigue a esta persona para ver quién la sigue.'
                : 'Follow this person to see who follows them.'
            }
            actionLabel={t ? 'Ver perfil' : 'View profile'}
            onAction={() => router.back()}
          />
        ) : (
          <ErrorState
            message={error}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={() => load()}
          />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon="users"
          title={t ? 'Sin seguidores todavía' : 'No followers yet'}
          message={
            t
              ? 'Cuando alguien siga a este usuario, aparecerá aquí.'
              : 'When someone follows this user, they will appear here.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.body}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.rowShell,
                index === 0 && styles.rowShellFirst,
                index === items.length - 1 && styles.rowShellLast,
              ]}
            >
              <UserRow
                u={item}
                t={t}
                onPress={() => router.push(`/(app)/users/${item.id}` as never)}
              />
              {index < items.length - 1 ? (
                <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
              ) : null}
            </View>
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={Colors.accentPrimary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Header ───────────────────────────────────
function Header({
  title,
  count,
  backLabel,
  onBack,
}: {
  title: string;
  count: number;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressy
        onPress={onBack}
        haptic="select"
        hitSlop={HitSlop.expand}
        accessibilityRole={Roles.button}
        accessibilityLabel={backLabel}
        style={styles.backBtn}
      >
        <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
      </Pressy>
      <View style={styles.headerTitleBlock}>
        {count > 0 ? <Kicker tone="muted">{`${count}`}</Kicker> : null}
        <Heading size="md" style={{ marginTop: count > 0 ? Spacing[1] : 0 }}>
          {title}
        </Heading>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}

// ── User row ────────────────────────────────
function UserRow({ u, t, onPress }: { u: UserRecord; t: boolean; onPress: () => void }) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';

  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={fullName}
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
          {fullName}
        </Body>
        {u.since ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {t ? 'Te sigue desde' : 'Following since'} {formatSince(u.since, t)}
          </Caption>
        ) : null}
      </View>
      {u.isPrivate ? <Badge label={t ? 'Privado' : 'Private'} size="sm" outline /> : null}
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </Pressy>
  );
}

function formatSince(iso: string, es: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(es ? 'es-MX' : 'en-US', { month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[5],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  headerTitleBlock: {
    flex: 1,
  },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
  },
  rowShell: {
    backgroundColor: Colors.bgCard,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowShellFirst: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.highlightTop,
  },
  rowShellLast: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
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
  footer: {
    paddingVertical: Spacing[5],
    alignItems: 'center',
  },
});
