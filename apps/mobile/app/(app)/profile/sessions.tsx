// ─────────────────────────────────────────────
//  Sessions — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header + Lead summary copy
//   · FlatList of editorial rows: device icon + device name + OS line +
//     meta (ip · last active) + "Este dispositivo" pill OR ghost "Cerrar"
//   · Revoke one → <ConfirmDialog> → DELETE /auth/sessions/:id (optimistic,
//     rollback on failure)
//   · "Cerrar sesión en todos los demás" → POST /auth/logout-others
//   · Skeleton / ErrorState with retry / EmptyState
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { authApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Badge,
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
  deviceName?: string | null;
  deviceOs?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
  isCurrent?: boolean;
}

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function deviceIcon(s: SessionRow): FeatherIcon {
  const hay = `${s.deviceOs ?? ''} ${s.deviceName ?? ''} ${s.userAgent ?? ''}`.toLowerCase();
  if (/ipad|tablet/.test(hay)) return 'tablet';
  if (/ios|iphone|android|mobile/.test(hay)) return 'smartphone';
  if (/mac|windows|linux|mozilla|chrome|safari/.test(hay)) return 'monitor';
  return 'smartphone';
}

function relativeTime(iso: string | undefined, t: boolean): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 2) return t ? 'Activa ahora' : 'Active now';
  if (min < 60) return t ? `Hace ${min} min` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return t ? `Hace ${h} h` : `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return t ? `Hace ${d} ${d === 1 ? 'día' : 'días'}` : `${d} ${d === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString(t ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
}

export default function Sessions() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authApi.sessions();
      const payload = r.data?.data;
      const items: SessionRow[] = Array.isArray(payload) ? payload : payload?.items ?? [];
      setSessions(items);
    } catch (err) {
      setError(apiError(err, t ? 'No se pudieron cargar las sesiones.' : 'Could not load sessions.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const others = sessions.filter((s) => !s.isCurrent);

  async function revoke(id: string) {
    const prev = sessions;
    setBusyIds((b) => new Set(b).add(id));
    setSessions((p) => p.filter((s) => s.id !== id));
    try {
      await authApi.revokeSession(id);
      fb.success();
      toast(t ? 'Sesión cerrada en ese dispositivo.' : 'Session signed out on that device.', 'success');
    } catch (err) {
      setSessions(prev);
      fb.error();
      toast(apiError(err, t ? 'No se pudo cerrar la sesión.' : "Couldn't revoke the session."), 'danger');
    } finally {
      setBusyIds((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
    }
  }

  async function revokeOthers() {
    const prev = sessions;
    setSessions((p) => p.filter((s) => s.isCurrent));
    try {
      const r = await authApi.logoutOthers();
      const revoked = Number(r.data?.data?.revoked ?? others.length);
      fb.success();
      toast(
        revoked === 1
          ? t ? 'Se cerró 1 sesión.' : '1 session signed out.'
          : t ? `Se cerraron ${revoked} sesiones.` : `${revoked} sessions signed out.`,
        'success',
      );
      load();
    } catch (err) {
      setSessions(prev);
      fb.error();
      toast(apiError(err, t ? 'No se pudieron cerrar las sesiones.' : "Couldn't sign out the other sessions."), 'danger');
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
            ? 'Dispositivos donde tu cuenta tiene sesión abierta. Si no reconoces alguno, ciérralo y cambia tu contraseña.'
            : "Devices where your account is signed in. If you don't recognise one, sign it out and change your password."}
        </Lead>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter }}>
          <SkeletonList count={3} itemHeight={88} />
        </View>
      ) : error && sessions.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={load}
          icon="shield-off"
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
                t={t}
                busy={busyIds.has(item.id)}
                onRevoke={() => setConfirmId(item.id)}
              />
            </FadeIn>
          )}
          ListFooterComponent={
            others.length > 0 ? (
              <FadeIn delay={40 * sessions.length + 60} style={{ marginTop: Spacing[4] }}>
                <Button
                  label={
                    t
                      ? `Cerrar sesión en todos los demás (${others.length})`
                      : `Sign out of all other devices (${others.length})`
                  }
                  onPress={() => setOthersOpen(true)}
                  variant="secondary"
                  size="md"
                  fullWidth
                  haptic="warning"
                  leftIcon={<Feather name="log-out" size={16} color={Colors.textPrimary} />}
                />
              </FadeIn>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ minHeight: 280 }}>
              <EmptyState
                icon="shield"
                title={t ? 'Sin sesiones activas' : 'No active sessions'}
                message={
                  t
                    ? 'Cuando inicies sesión en otro dispositivo aparecerá aquí.'
                    : 'When you sign in on another device it will show up here.'
                }
              />
            </View>
          }
        />
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          const id = confirmId;
          setConfirmId(null);
          if (id) await revoke(id);
        }}
        title={t ? '¿Cerrar esta sesión?' : 'Sign out this session?'}
        description={
          t
            ? 'Ese dispositivo perderá el acceso de inmediato y tendrá que iniciar sesión de nuevo.'
            : 'That device loses access immediately and will need to sign in again.'
        }
        confirmLabel={t ? 'Cerrar sesión' : 'Sign out'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
        confirmVariant="danger"
      />

      <ConfirmDialog
        open={othersOpen}
        onClose={() => setOthersOpen(false)}
        onConfirm={async () => {
          setOthersOpen(false);
          await revokeOthers();
        }}
        title={t ? '¿Cerrar las demás sesiones?' : 'Sign out of other devices?'}
        description={
          t
            ? `Se cerrará la sesión en ${others.length} ${others.length === 1 ? 'dispositivo' : 'dispositivos'}. Este dispositivo seguirá conectado.`
            : `${others.length} ${others.length === 1 ? 'device' : 'devices'} will be signed out. This device stays connected.`
        }
        confirmLabel={t ? 'Cerrar las demás' : 'Sign out others'}
        cancelLabel={t ? 'Cancelar' : 'Cancel'}
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

function SessionCard({
  session,
  t,
  busy,
  onRevoke,
}: {
  session: SessionRow;
  t: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const icon = deviceIcon(session);
  const name = session.deviceName?.trim() || session.deviceOs?.trim() || (t ? 'Dispositivo desconocido' : 'Unknown device');
  const os = session.deviceName?.trim() && session.deviceOs?.trim() ? session.deviceOs.trim() : null;
  const last = relativeTime(session.lastActiveAt ?? session.updatedAt, t);
  const meta = [session.ipAddress, last].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, session.isCurrent && styles.cardCurrent]}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={20} color={session.isCurrent ? Colors.accentPrimary : Colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Subhead numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Subhead>
          {session.isCurrent ? (
            <Badge label={t ? 'Este dispositivo' : 'This device'} variant="accent" size="sm" />
          ) : null}
        </View>
        {os ? (
          <Caption tone="secondary" numberOfLines={1}>
            {os}
          </Caption>
        ) : null}
        {meta ? (
          <Caption tone="muted" numberOfLines={1}>
            {meta}
          </Caption>
        ) : null}
      </View>
      {!session.isCurrent ? (
        <Button
          label={t ? 'Cerrar' : 'Sign out'}
          onPress={onRevoke}
          variant="ghost"
          size="sm"
          fullWidth={false}
          disabled={busy}
          loading={busy}
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
  cardCurrent: {
    borderColor: 'rgba(201,169,97,0.35)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
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
