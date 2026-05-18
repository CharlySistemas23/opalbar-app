// ─────────────────────────────────────────────
//  Following — Editorial Premium
//
//  Mirror of /followers, but for the "siguiendo" roster.
// ─────────────────────────────────────────────
import { Image, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
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

export default function Following() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    usersApi
      .following(id)
      .then((r) => setItems(r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
            {t ? 'Siguiendo' : 'Following'}
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
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="user-plus"
          title={t ? 'No sigues a nadie aún' : 'Not following anyone yet'}
          message={
            t
              ? 'Explora usuarios para verlos aquí cuando los sigas.'
              : 'Explore users to see them here once you follow.'
          }
        />
      ) : (
        <FadeIn style={styles.body}>
          <View style={styles.listShell}>
            {items.map((u, idx) => (
              <View key={u.id}>
                <UserRow u={u} onPress={() => router.push(`/(app)/users/${u.id}` as never)} />
                {idx < items.length - 1 ? (
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
