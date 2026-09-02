// ─────────────────────────────────────────────
//  Messages · Solicitudes — Editorial Premium
//
//  Header: Kicker "SOLICITUDES" + Heading
//  Disclaimer en Body tone="secondary" — sin pill ni recuadro.
//  Lista de pendientes; cada row tiene Accept (Button primary) /
//  Decline (Button ghost) / Block (Button ghost danger).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  Display,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Sheet,
  SkeletonList,
  Subhead,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { messagePreview, relTime } from '@/components/messages';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { playUiSound } from '@/hooks/useFeedback';
import { useRealtime } from '@/hooks/useRealtime';
import { messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';

const AVATAR_COLORS = ['#C9A961', '#7FA0BC', '#9F8DBE', '#6FA88A', '#C46868', '#C48A8A'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type Request = {
  id: string;
  lastMessageAt?: string;
  lastMessage?: {
    id: string;
    content?: string | null;
    imageUrl?: string | null;
    stickerKey?: string | null;
    audioUrl?: string | null;
    audioDurationSec?: number | null;
    createdAt: string;
    senderId: string;
  } | null;
  otherUser: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  };
};

function nameOf(req: Request) {
  const p = req.otherUser?.profile;
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Usuario';
}

export default function MessageRequestsScreen() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<Request | null>(null);
  const [blockTarget, setBlockTarget] = useState<Request | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setError(null);
    try {
      const r = await messagesApi.requests();
      setItems(r.data?.data ?? []);
      setError(null);
      loadedOnce.current = true;
    } catch (err) {
      if (opts.silent && loadedOnce.current) toast(apiError(err), 'danger');
      else setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ silent: loadedOnce.current });
    }, [load]),
  );

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);
  useRealtime(['thread', 'message'], () => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      debounce.current = null;
      load({ silent: true });
    }, 300);
  });

  function removeLocal(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function accept(req: Request) {
    setBusyId(req.id);
    try {
      await messagesApi.acceptRequest(req.id);
      removeLocal(req.id);
      router.push(`/(app)/messages/${req.id}` as never);
    } catch {
      Alert.alert(t ? 'Error' : 'Error', t ? 'No se pudo aceptar' : "Couldn't accept");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(req: Request) {
    setBusyId(req.id);
    try {
      await messagesApi.declineRequest(req.id);
      removeLocal(req.id);
    } catch {
      Alert.alert(t ? 'Error' : 'Error', t ? 'No se pudo rechazar' : "Couldn't decline");
    } finally {
      setBusyId(null);
    }
  }

  async function block(req: Request) {
    setBusyId(req.id);
    setBlockTarget(null);
    try {
      await messagesApi.blockRequest(req.id);
      removeLocal(req.id);
    } catch {
      Alert.alert(t ? 'Error' : 'Error', t ? 'No se pudo bloquear' : "Couldn't block");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
      </View>

      <View style={styles.hero}>
        <FadeIn>
          <Kicker tone="champagne">{t ? 'SOLICITUDES' : 'REQUESTS'}</Kicker>
        </FadeIn>
        <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
          <Display size="md">{t ? 'Solicitudes.' : 'Requests.'}</Display>
        </FadeIn>
        {items.length > 0 && (
          <FadeIn delay={140} style={{ marginTop: Spacing[2] }}>
            <Caption tone="accent">
              {items.length} {t ? (items.length === 1 ? 'pendiente' : 'pendientes') : (items.length === 1 ? 'pending' : 'pending')}
            </Caption>
          </FadeIn>
        )}
        <FadeIn delay={200} style={{ marginTop: Spacing[4] }}>
          <Body tone="secondary">
            {t
              ? 'Mensajes de personas que aún no apruebas. No verán que los leíste.'
              : "Messages from people you haven't approved yet. They won't see you've read them."}
          </Body>
        </FadeIn>
      </View>

      <Hairline variant="subtle" marginHorizontal={EditorialSpacing.pageGutter} />

      {loading ? (
        <View style={styles.listPad}>
          <SkeletonList count={4} itemHeight={140} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { playUiSound('swoosh'); setRefreshing(true); load(); }}
              tintColor={Colors.accentPrimary}
            />
          }
          ItemSeparatorComponent={() => (
            <Hairline variant="subtle" marginHorizontal={EditorialSpacing.pageGutter} />
          )}
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index, 6) * 60}>
              <RequestRow
                req={item}
                busy={busyId === item.id}
                t={t}
                onAccept={() => accept(item)}
                onDecline={() => decline(item)}
                onMenu={() => setMenuTarget(item)}
                onBlock={() => setBlockTarget(item)}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="inbox"
              title={t ? 'Sin solicitudes' : 'No requests'}
              message={
                t
                  ? 'Cuando alguien que no sigues te escriba, aparecerá aquí primero.'
                  : "When someone you don't follow messages you, it'll show up here first."
              }
            />
          }
        />
      )}

      <Sheet
        open={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        title={menuTarget ? nameOf(menuTarget) : ''}
      >
        {menuTarget ? (
          <View style={{ gap: Spacing[1], paddingBottom: Spacing[2] }}>
            <Pressy
              onPress={() => {
                const uid = menuTarget.otherUser?.id;
                setMenuTarget(null);
                if (uid) router.push(`/(app)/users/${uid}` as never);
              }}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Ver perfil' : 'View profile'}
              haptic="select"
              style={styles.sheetRow}
            >
              <Feather name="user" size={18} color={Colors.textPrimary} />
              <Body>{t ? 'Ver perfil' : 'View profile'}</Body>
            </Pressy>
            <Pressy
              onPress={() => {
                const target = menuTarget;
                setMenuTarget(null);
                setBlockTarget(target);
              }}
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Bloquear' : 'Block'}
              haptic="destructive"
              style={styles.sheetRow}
            >
              <Feather name="slash" size={18} color={Colors.accentDanger} />
              <Body tone="danger">{t ? 'Bloquear' : 'Block'}</Body>
            </Pressy>
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={async () => { if (blockTarget) await block(blockTarget); }}
        title={
          blockTarget
            ? (t ? `Bloquear a ${nameOf(blockTarget)}?` : `Block ${nameOf(blockTarget)}?`)
            : ''
        }
        description={
          t
            ? 'No podrá enviarte más mensajes.'
            : "They won't be able to send you any more messages."
        }
        confirmLabel={t ? 'Bloquear' : 'Block'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

function RequestRow({
  req,
  busy,
  t,
  onAccept,
  onDecline,
  onMenu,
  onBlock,
}: {
  req: Request;
  busy: boolean;
  t: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onMenu: () => void;
  onBlock: () => void;
}) {
  const name = nameOf(req);
  const initials = name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const avatar = req.otherUser?.profile?.avatarUrl;
  const preview = messagePreview(req.lastMessage, t);

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colorFor(req.otherUser?.id || req.id) }]}>
            <Body size="md" tone="inverse" weight="bold">{initials || 'U'}</Body>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Subhead numberOfLines={1}>{name}</Subhead>
          <Caption tone="muted" size="sm" style={{ marginTop: 2 }}>
            {relTime(req.lastMessageAt, t)}
          </Caption>
        </View>
        <Pressy
          onPress={onMenu}
          accessibilityLabel={t ? 'Más opciones' : 'More options'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          haptic="select"
        >
          <Feather name="more-horizontal" size={20} color={Colors.textMuted} />
        </Pressy>
      </View>

      {preview ? (
        <Body size="sm" tone="secondary" numberOfLines={3} style={styles.preview}>
          {preview}
        </Body>
      ) : null}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            label={t ? 'Aceptar' : 'Accept'}
            onPress={onAccept}
            disabled={busy}
            variant="primary"
            size="sm"
            fullWidth
            haptic="success"
            leftIcon={<Feather name="check" size={13} color={Colors.textInverse} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t ? 'Rechazar' : 'Decline'}
            onPress={onDecline}
            disabled={busy}
            variant="secondary"
            size="sm"
            fullWidth
          />
        </View>
        <Pressy
          onPress={onBlock}
          accessibilityLabel={t ? 'Bloquear' : 'Block'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          haptic="destructive"
          disabled={busy}
          style={styles.blockBtn}
        >
          <Caption tone="danger" size="sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {t ? 'Bloquear' : 'Block'}
          </Caption>
        </Pressy>
      </View>
    </View>
  );
}

// Heading imported but used only via primitive composition above (no direct
// JSX). Keep the symbol referenced so a future tree-shake doesn't strip it.
void Heading;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  headerRow: {
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

  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[6],
  },

  listPad: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[5],
  },
  listContent: {
    paddingBottom: Spacing[10],
    paddingTop: Spacing[2],
  },

  row: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[4],
    gap: Spacing[3],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  preview: {
    marginLeft: 48 + Spacing[3],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginLeft: 48 + Spacing[3],
    alignItems: 'center',
  },
  blockBtn: {
    minHeight: 40,
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    minHeight: 52,
  },
});
