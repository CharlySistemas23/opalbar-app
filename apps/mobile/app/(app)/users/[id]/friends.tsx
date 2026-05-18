// ─────────────────────────────────────────────
//  Friends — Editorial Premium
//
//  Magazine roster (same shell as Followers/Following).
//   · Owner: shows the local friend list; visitors get a "lista privada" empty.
//   · Inline search shortcut routes to the global /search screen.
// ─────────────────────────────────────────────
import { Image, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface UserRecord {
  id: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  email?: string;
}

export default function Friends() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query] = useState('');

  // Backend exposes friends.list only for the authenticated user. Visiting
  // another user's friends route therefore falls back to "private list".
  const isMe = me?.id === id;

  const load = () => {
    setError(null);
    setLoading(true);
    friendshipsApi
      .list(200)
      .then((r) => setItems(r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isMe) {
      setItems([]);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isMe]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const name = `${u?.profile?.firstName ?? ''} ${u?.profile?.lastName ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [items, query]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
        <View style={styles.headerTitleBlock}>
          {items.length > 0 ? <Kicker tone="muted">{`${items.length}`}</Kicker> : null}
          <Heading size="md" style={{ marginTop: items.length > 0 ? Spacing[1] : 0 }}>
            {t ? 'Amigos' : 'Friends'}
          </Heading>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={6} itemHeight={64} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={load}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={isMe ? 'users' : 'lock'}
          title={
            isMe
              ? t
                ? 'Sin amigos aún'
                : 'No friends yet'
              : t
                ? 'Lista privada'
                : 'Private list'
          }
          message={
            isMe
              ? t
                ? 'Cuando aceptes solicitudes, los amigos aparecerán aquí.'
                : 'Once you accept requests, friends will appear here.'
              : t
                ? 'Solo tú puedes ver tus amigos por ahora.'
                : 'Only you can see your friends list for now.'
          }
        />
      ) : (
        <FadeIn style={styles.body}>
          {isMe ? (
            <Pressy
              onPress={() => router.push('/(app)/search' as never)}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Buscar amigos' : 'Search friends'}
              style={styles.searchShortcut}
            >
              <Feather name="search" size={16} color={Colors.textMuted} />
              <Caption tone="muted" style={{ flex: 1 }}>
                {t ? 'Buscar amigos' : 'Search friends'}
              </Caption>
            </Pressy>
          ) : null}

          <View style={styles.listShell}>
            {filtered.map((u, idx) => (
              <View key={u.id}>
                <UserRow u={u} onPress={() => router.push(`/(app)/users/${u.id}` as never)} />
                {idx < filtered.length - 1 ? (
                  <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
                ) : null}
              </View>
            ))}
          </View>
        </FadeIn>
      )}
    </SafeAreaView>
  );
}

function UserRow({ u, onPress }: { u: UserRecord; onPress: () => void }) {
  const first = u?.profile?.firstName ?? '';
  const last = u?.profile?.lastName ?? '';
  const fullName = `${first} ${last}`.trim() || (u.email?.split('@')[0] ?? 'Usuario');
  const initials =
    ((first[0] || '') + (last[0] || '')).toUpperCase() ||
    (u.email?.[0] ?? 'U').toUpperCase();
  const handle = (u.email || '').split('@')[0];

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
        {handle ? (
          <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            @{handle}
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
  headerTitleBlock: { flex: 1 },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
    gap: Spacing[4],
  },

  searchShortcut: {
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

  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    minHeight: 64,
  },
  rowText: { flex: 1 },
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
});
