// ─────────────────────────────────────────────
//  Blocked users — Editorial Premium
//
//  · Kicker + Heading header
//  · FlatList of blocked people: avatar + name + "Bloqueado el …"
//    + inline "Desbloquear" (ConfirmDialog → DELETE /friendships/:id/block)
//  · Optimistic removal with rollback + toast. Skeleton / ErrorState / Empty.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { friendshipsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  ConfirmDialog,
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

const AVATAR_COLORS = ['#E89F4A', '#85ADCE', '#A8966F', '#7BB594', '#D96A6A', '#D7BE94'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type BlockedRow = {
  id: string;
  isPrivate?: boolean;
  blockedAt?: string | null;
  friendshipId?: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string | null; bio?: string | null };
};

function fullName(row: BlockedRow, t: boolean) {
  const first = row.profile?.firstName ?? '';
  const last = row.profile?.lastName ?? '';
  return `${first} ${last}`.trim() || (t ? 'Usuario' : 'User');
}

export default function BlockedUsers() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [items, setItems] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BlockedRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await friendshipsApi.blocked();
      const data = res?.data?.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(apiError(err, t ? 'No se pudo cargar la lista.' : 'Could not load the list.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function unblock(row: BlockedRow) {
    const prevItems = items;
    setBusyId(row.id);
    setItems((p) => p.filter((r) => r.id !== row.id));
    try {
      await friendshipsApi.unblock(row.id);
      fb.success();
      toast(
        t ? `${fullName(row, t)} ya no está bloqueado.` : `${fullName(row, t)} is no longer blocked.`,
        'success',
      );
    } catch (err) {
      setItems(prevItems);
      fb.error();
      toast(apiError(err, t ? 'No se pudo desbloquear.' : "Couldn't unblock."), 'danger');
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(iso?: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(t ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
        <Kicker tone="muted">{t ? 'PRIVACIDAD' : 'PRIVACY'}</Kicker>
        <Heading size="md">{t ? 'Usuarios bloqueados' : 'Blocked users'}</Heading>
        <Caption tone="muted">
          {t
            ? 'No pueden ver tu perfil, escribirte ni etiquetarte. Puedes desbloquear cuando quieras.'
            : "They can't see your profile, message you or tag you. Unblock whenever you want."}
        </Caption>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, marginTop: Spacing[4] }}>
          <SkeletonList count={5} itemHeight={88} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={load}
          icon="slash"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[4],
            paddingBottom: Spacing[12],
            gap: Spacing[4],
          }}
          renderItem={({ item, index }) => {
            const name = fullName(item, t);
            const first = item.profile?.firstName ?? '';
            const last = item.profile?.lastName ?? '';
            const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
            const when = formatDate(item.blockedAt);
            return (
              <FadeIn delay={40 * index}>
                <View style={styles.row}>
                  {item.profile?.avatarUrl ? (
                    <Image source={{ uri: item.profile.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colorFor(item.id) }]}>
                      <Subhead tone="inverse">{initials}</Subhead>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{name}</Subhead>
                    <Caption tone="muted" style={{ marginTop: 2 }}>
                      {when
                        ? t ? `Bloqueado el ${when}` : `Blocked on ${when}`
                        : t ? 'Bloqueado' : 'Blocked'}
                    </Caption>
                  </View>
                  <Button
                    label={t ? 'Desbloquear' : 'Unblock'}
                    onPress={() => setPending(item)}
                    variant="secondary"
                    size="sm"
                    disabled={busyId === item.id}
                    loading={busyId === item.id}
                    haptic="select"
                  />
                </View>
              </FadeIn>
            );
          }}
          ListEmptyComponent={
            <View style={{ minHeight: 320 }}>
              <EmptyState
                icon="user-check"
                title={t ? 'No has bloqueado a nadie' : "You haven't blocked anyone"}
                message={
                  t
                    ? 'Cuando bloquees a alguien desde su perfil, aparecerá aquí.'
                    : 'When you block someone from their profile, they will appear here.'
                }
              />
            </View>
          }
        />
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={t ? '¿Desbloquear?' : 'Unblock?'}
        description={
          pending
            ? t
              ? `${fullName(pending, t)} podrá volver a ver tu perfil, enviarte solicitudes y escribirte según tus ajustes de privacidad.`
              : `${fullName(pending, t)} will be able to see your profile, send you requests and message you according to your privacy settings.`
            : ''
        }
        confirmLabel={t ? 'Desbloquear' : 'Unblock'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
        onConfirm={async () => {
          const row = pending;
          setPending(null);
          if (row) await unblock(row);
        }}
      />
    </SafeAreaView>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    padding: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
