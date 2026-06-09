// ─────────────────────────────────────────────
//  Sessions — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header + Lead summary copy
//   · FlatList of editorial rows: device icon + device name + meta line
//     (ip · last seen) + current pill OR ghost "Revoke" button
//   · Confirm via <ConfirmDialog> for destructive revoke (was Alert).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  ConfirmDialog,
  FadeIn,
  Heading,
  Kicker,
  Lead,
  Pressy,
  SkeletonList,
  Subhead,
} from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

interface SessionRow {
  id: string;
  deviceName?: string;
  deviceOs?: string;
  ipAddress?: string;
  updatedAt?: string;
  isCurrent?: boolean;
}

function isMobileOs(os?: string | null) {
  if (!os) return false;
  return /ios|android|mobile|iphone|ipad/i.test(os);
}

export default function Sessions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    authApi
      .sessions()
      .then((r) => {
        const payload = r.data?.data;
        const items = Array.isArray(payload) ? payload : payload?.items ?? [];
        setSessions(items);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmRevoke() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await authApi.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast(t ? 'Sesión cerrada.' : 'Session revoked.', 'success');
    } catch (err: any) {
      toast(apiError(err, t ? 'No se pudo cerrar.' : "Couldn't revoke."), 'danger');
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
        <Kicker tone="muted">{t ? 'SEGURIDAD' : 'SECURITY'}</Kicker>
        <Heading size="md">{t ? 'Sesiones activas' : 'Active sessions'}</Heading>
        <Lead tone="secondary" style={{ marginTop: Spacing[2] }}>
          {t
            ? 'Dispositivos donde tu cuenta tiene sesión abierta.'
            : 'Devices where your account is currently signed in.'}
        </Lead>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter }}>
          <SkeletonList count={3} itemHeight={80} />
        </View>
      ) : error && sessions.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{
            paddingHorizontal: EditorialSpacing.pageGutter,
            paddingTop: Spacing[2],
            paddingBottom: Spacing[12],
            gap: Spacing[3],
          }}
          renderItem={({ item, index }) => (
            <FadeIn delay={40 * index}>
              <SessionCard
                session={item}
                language={language}
                t={t}
                onRevoke={() => setConfirmId(item.id)}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={{ minHeight: 280 }}>
              <EmptyState
                icon="shield"
                title={t ? 'Sin sesiones activas' : 'No active sessions'}
              />
            </View>
          }
        />
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={confirmRevoke}
        title={t ? 'Cerrar sesión remota' : 'Revoke session'}
        description={
          t
            ? 'Esta sesión cerrará inmediatamente en su dispositivo.'
            : 'This session will be signed out on its device immediately.'
        }
        confirmLabel={t ? 'Cerrar sesión' : 'Revoke'}
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

function SessionCard({
  session,
  language,
  t,
  onRevoke,
}: {
  session: SessionRow;
  language: 'es' | 'en';
  t: boolean;
  onRevoke: () => void;
}) {
  const icon = isMobileOs(session.deviceOs) ? 'smartphone' : 'monitor';
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={20} color={Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Subhead numberOfLines={1}>
          {session.deviceName ?? session.deviceOs ?? (t ? 'Dispositivo desconocido' : 'Unknown device')}
        </Subhead>
        <Caption tone="muted" style={{ marginTop: 2 }}>
          {[
            session.ipAddress,
            session.updatedAt ? new Date(session.updatedAt).toLocaleDateString(language) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Caption>
        {session.isCurrent ? (
          <Caption tone="champagne" style={{ marginTop: 4 }}>
            {t ? 'ESTA SESIÓN' : 'THIS SESSION'}
          </Caption>
        ) : null}
      </View>
      {!session.isCurrent ? (
        <Button
          label={t ? 'Cerrar' : 'Revoke'}
          onPress={onRevoke}
          variant="ghost"
          size="sm"
          fullWidth={false}
          haptic="warning"
        />
      ) : null}
    </View>
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
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
