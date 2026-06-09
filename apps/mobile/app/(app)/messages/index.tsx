// ─────────────────────────────────────────────
//  Messages · Lista de conversaciones — Editorial Premium
//
//  Header: Kicker "MENSAJES" + Display "Conversaciones"
//  Tabs underline: Activos | Solicitudes (Solicitudes navega a /requests)
//  Lista: ListItem-style con avatar + nombre + preview + timestamp + unread dot.
//
//  Loading → SkeletonList. Empty → <EmptyState>. Error → <ErrorState>.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
  SkeletonList,
  Subhead,
  Tabs,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, EditorialSpacing, Radius, Spacing, Typography } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import { messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';

const AVATAR_COLORS = ['#C9A961', '#7FA0BC', '#9F8DBE', '#6FA88A', '#C46868', '#C48A8A'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function relTime(d?: string, t?: boolean) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return t ? 'ahora' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  const dt = new Date(d);
  return dt.toLocaleDateString(t ? 'es' : 'en', { day: 'numeric', month: 'short' });
}

type TabKey = 'active' | 'requests';

export default function MessagesList() {
  const router = useRouter();
  const { language } = useAppStore();
  const { user: me } = useAuthStore();
  const t = language === 'es';

  const [threads, setThreads] = useState<any[]>([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('active');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [threadsRes, reqRes] = await Promise.all([
        messagesApi.threads(),
        messagesApi.requestsCount().catch(() => null),
      ]);
      setThreads(threadsRes.data?.data ?? []);
      setRequestsCount(reqRes?.data?.data?.count ?? 0);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const preview = (thr.lastMessage?.content ?? '').toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

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
              tintColor={Colors.textMuted}
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
                meId={me?.id}
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
  thread: any;
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
  const hasUnread = thread.unreadCount > 0;
  const previewBody = lastMsg?.stickerKey
    ? `${lastMsg.stickerKey}  ${t ? 'Sticker' : 'Sticker'}`
    : lastMsg?.imageUrl
      ? (t ? 'Foto' : 'Photo')
      : (lastMsg?.content ?? '');
  const preview = isMine && previewBody
    ? `${t ? 'Tú' : 'You'}: ${previewBody}`
    : previewBody;

  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={`${name}. ${preview || (t ? 'Sin mensajes' : 'No messages')}`}
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
          <Caption
            size="sm"
            tone={hasUnread ? 'accent' : 'muted'}
            style={{ marginLeft: Spacing[2] }}
          >
            {relTime(thread.lastMessageAt, t)}
          </Caption>
        </View>
        <View style={styles.rowBottom}>
          {isMine && lastMsg && (
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
            style={{ flex: 1 }}
            weight={hasUnread ? 'semiBold' : 'regular'}
          >
            {preview || (t ? 'Empieza a conversar' : 'Start the conversation')}
          </Body>
          {hasUnread && (
            <View style={{ marginLeft: Spacing[2] }}>
              <Badge
                label={thread.unreadCount > 99 ? '99+' : String(thread.unreadCount)}
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

// Hairline kept for future use (separator pattern).
void Hairline;
