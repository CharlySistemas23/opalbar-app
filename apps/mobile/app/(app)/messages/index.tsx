// ─────────────────────────────────────────────
//  Messages · Lista de conversaciones — Editorial Premium
//
//  Header: Kicker "MENSAJES" + Display "Conversaciones"
//  Tabs underline: Activos | Solicitudes (Solicitudes navega a /requests)
//  Lista: ListItem-style con avatar + nombre + preview + timestamp + unread dot.
//
//  Loading → SkeletonList. Empty → <EmptyState>. Error → <ErrorState>.
//  Live: re-fetch on focus + on /rt `message` / `thread` envelopes (debounced).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Caption,
  Display,
  FadeIn,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { relTime, threadPreview } from '@/components/messages';
import { Colors, EditorialSpacing, Radius, Spacing, Typography } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';
import { messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUnreadStore } from '@/stores/unread.store';

const AVATAR_COLORS = ['#C9A961', '#7FA0BC', '#9F8DBE', '#6FA88A', '#C46868', '#C48A8A'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type TabKey = 'active' | 'requests';

interface Thread {
  id: string;
  status?: 'ACCEPTED' | 'PENDING' | 'BLOCKED';
  requestedById?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  otherUser?: {
    id: string;
    profile?: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  } | null;
  lastMessage?: {
    id: string;
    content?: string | null;
    imageUrl?: string | null;
    stickerKey?: string | null;
    audioUrl?: string | null;
    audioDurationSec?: number | null;
    senderId?: string | null;
    isRead?: boolean;
    deletedAt?: string | null;
  } | null;
}

export default function MessagesList() {
  const router = useRouter();
  const language = useAppStore((s) => s.language);
  const meId = useAuthStore((s) => s.user?.id);
  const t = language === 'es';

  const [threads, setThreads] = useState<Thread[]>([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('active');
  const loadedOnce = useRef(false);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setError(null);
    try {
      const [threadsRes, reqRes] = await Promise.all([
        messagesApi.threads(),
        messagesApi.requestsCount().catch(() => null),
      ]);
      setThreads(threadsRes.data?.data ?? []);
      const count = reqRes?.data?.data?.count;
      if (typeof count === 'number') {
        setRequestsCount(count);
        useUnreadStore.getState().set({ messageRequests: count });
      }
      setError(null);
      loadedOnce.current = true;
    } catch (err) {
      // Silent (background) refreshes must not blank a list we already show.
      if (opts.silent && loadedOnce.current) toast(apiError(err), 'danger');
      else setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // First mount → skeleton. Every re-focus (back from a thread that marked
  // itself read, from requests after accepting) → silent refresh.
  useFocusEffect(
    useCallback(() => {
      load({ silent: loadedOnce.current });
    }, [load]),
  );

  // Live updates: new/read/deleted messages and thread lifecycle (request
  // accepted / declined / blocked). Debounced so a burst = one fetch.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);
  useRealtime(['message', 'thread'], () => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      debounce.current = null;
      load({ silent: true });
    }, 300);
  });

  // Switching to Solicitudes pushes the dedicated screen — there's no
  // shared list shape that fits both, and the requests screen has its own
  // accept/decline UX. Snap back to 'active' so returning shows that tab.
  useEffect(() => {
    if (tab === 'requests') {
      router.push('/(app)/messages/requests' as never);
      const timer = setTimeout(() => setTab('active'), 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [tab, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thr) => {
      const o = thr.otherUser;
      const name = `${o?.profile?.firstName ?? ''} ${o?.profile?.lastName ?? ''}`.toLowerCase();
      const preview = threadPreview(thr.lastMessage, meId, t).toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [threads, query, meId, t]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header ───────────────────────────────── */}
      <View style={styles.headerRow}>
        <Pressy
          onPress={() => router.back()}
          accessibilityLabel={t ? 'Volver' : 'Back'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
        <Pressy
          onPress={() => router.push('/(app)/search' as never)}
          accessibilityLabel={t ? 'Nueva conversación' : 'New conversation'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          style={styles.newBtn}
        >
          <Feather name="edit" size={18} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <View style={styles.hero}>
        <FadeIn>
          <Kicker tone="champagne">{t ? 'MENSAJES' : 'MESSAGES'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{t ? 'Conversaciones.' : 'Conversations.'}</Display>
        </FadeIn>
      </View>

      <FadeIn delay={160} style={styles.tabsWrap}>
        <Tabs<TabKey>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t ? 'Activos' : 'Active' },
            {
              value: 'requests',
              label: `${t ? 'Solicitudes' : 'Requests'}${requestsCount > 0 ? ` (${requestsCount})` : ''}`,
            },
          ]}
        />
      </FadeIn>

      {threads.length > 0 && !loading ? (
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t ? 'Buscar' : 'Search'}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel={t ? 'Buscar conversaciones' : 'Search conversations'}
          />
          {query.length > 0 && (
            <Pressy
              onPress={() => setQuery('')}
              accessibilityLabel={t ? 'Limpiar búsqueda' : 'Clear search'}
              hitSlop={HitSlop.expand}
              haptic="select"
            >
              <Feather name="x-circle" size={15} color={Colors.textMuted} />
            </Pressy>
          )}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.listPad}>
          <SkeletonList count={6} itemHeight={72} />
        </View>
      ) : error && threads.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { playUiSound('swoosh'); setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index, 6) * 60}>
              <ThreadRow
                thread={item}
                meId={meId}
                t={t}
                onPress={() => router.push(`/(app)/messages/${item.id}` as never)}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            query.length > 0 ? (
              <View style={styles.emptySearch}>
                <Feather name="search" size={20} color={Colors.textMuted} />
                <Body size="sm" tone="secondary" style={{ marginTop: Spacing[2] }}>
                  {t ? 'Sin resultados para ' : 'No results for '}
                  <Body size="sm" tone="primary" weight="bold">
                    {'"' + query + '"'}
                  </Body>
                </Body>
              </View>
            ) : (
              <EmptyState
                icon="message-circle"
                title={t ? 'Aún no hay mensajes' : 'No messages yet'}
                message={
                  t
                    ? 'Cuando inicies una conversación aparecerá aquí.'
                    : 'When you start a conversation it will show up here.'
                }
                actionLabel={t ? 'Buscar personas' : 'Find people'}
                onAction={() => router.push('/(app)/search' as never)}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function ThreadRow({
  thread,
  meId,
  t,
  onPress,
}: {
  thread: Thread;
  meId?: string;
  t: boolean;
  onPress: () => void;
}) {
  const other = thread.otherUser;
  const first = other?.profile?.firstName ?? '';
  const last = other?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
  const lastMsg = thread.lastMessage;
  const isMine = !!lastMsg && lastMsg.senderId === meId;
  const unread = thread.unreadCount ?? 0;
  const hasUnread = unread > 0;
  const pendingMine = thread.status === 'PENDING' && thread.requestedById === meId;
  const preview = threadPreview(lastMsg, meId, t);

  const a11yState = pendingMine
    ? (t ? 'Solicitud pendiente.' : 'Request pending.')
    : hasUnread
      ? (t ? `${unread} sin leer.` : `${unread} unread.`)
      : '';

  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={`${name}. ${a11yState} ${preview || (t ? 'Sin mensajes' : 'No messages')}`}
      style={styles.row}
    >
      <View style={styles.avatarWrap}>
        {other?.profile?.avatarUrl ? (
          <Image source={{ uri: other.profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colorFor(other?.id || thread.id) }]}>
            <Body size="md" tone="inverse" weight="bold">{initials}</Body>
          </View>
        )}
        {hasUnread && <View style={styles.unreadDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Subhead numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </Subhead>
          {pendingMine ? (
            <View style={{ marginLeft: Spacing[2] }}>
              <Badge label={t ? 'Pendiente' : 'Pending'} variant="warning" size="sm" outline />
            </View>
          ) : null}
          <Caption
            size="sm"
            tone={hasUnread ? 'accent' : 'muted'}
            style={{ marginLeft: Spacing[2] }}
          >
            {relTime(thread.lastMessageAt, t)}
          </Caption>
        </View>
        <View style={styles.rowBottom}>
          {isMine && lastMsg && !lastMsg.deletedAt && (
            <Feather
              name={lastMsg.isRead ? 'check-circle' : 'check'}
              size={11}
              color={lastMsg.isRead ? Colors.accentPrimary : Colors.textMuted}
              style={{ marginRight: 5 }}
            />
          )}
          <Body
            size="sm"
            tone={hasUnread ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={[{ flex: 1 }, ...(lastMsg?.deletedAt ? [{ fontStyle: 'italic' as const }] : [])]}
            weight={hasUnread ? 'semiBold' : 'regular'}
          >
            {preview
              || (pendingMine
                ? (t ? 'Esperando que acepte tu solicitud' : 'Waiting for them to accept')
                : (t ? 'Empieza a conversar' : 'Start the conversation'))}
          </Body>
          {hasUnread && (
            <View style={{ marginLeft: Spacing[2] }}>
              <Badge
                label={unread > 99 ? '99+' : String(unread)}
                variant="accent"
                size="sm"
              />
            </View>
          )}
        </View>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  newBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing[2],
  },

  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[5],
  },

  tabsWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },

  searchWrap: {
    marginHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[4],
    marginBottom: Spacing[2],
    paddingHorizontal: Spacing[4],
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    padding: 0,
  },

  listPad: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
  },
  listContent: {
    paddingTop: Spacing[3],
    paddingBottom: Spacing[10],
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginLeft: EditorialSpacing.pageGutter + 54 + Spacing[3],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentPrimary,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  emptySearch: {
    alignItems: 'center',
    paddingTop: Spacing[10],
    gap: Spacing[2],
  },
});
