import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  Input,
  Kicker,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { AdminHeader } from '@/components/admin';

function relTime(d?: string) {
  if (!d) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function PushBroadcast() {
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage');
  const me = useAuthStore((s) => s.user);
  // Backend: POST /admin/notifications/broadcast is ADMIN/SUPER_ADMIN only.
  const canSend = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'ADMINS'>('ALL');
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const r = await adminApi.listBroadcasts();
      const rows = r.data?.data ?? r.data ?? [];
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setHistoryError(apiError(err));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  async function performSend() {
    setConfirmSend(false);
    setSending(true);
    try {
      const r = await adminApi.sendBroadcast({
        title: title.trim(),
        body: body.trim(),
        audience,
      });
      const data = r.data?.data ?? r.data;
      Alert.alert(
        'Enviado',
        `${data?.sent ?? 0} notificaciones enviadas a ${data?.totalUsers ?? 0} usuarios.`,
      );
      setTitle('');
      setBody('');
      loadHistory();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSending(false);
    }
  }

  function send() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Faltan datos', 'Título y mensaje son obligatorios.');
      return;
    }
    setConfirmSend(true);
  }

  if (!canSend) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <AdminHeader title="Push Notifications" kicker="Marketing" onBack={goBack} />
        <EmptyState
          icon="lock"
          title="Sin acceso"
          message="Necesitas rol de admin para enviar notificaciones push."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Push Notifications" kicker="Marketing" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[3] }}>
        <View style={styles.card}>
          <Kicker tone="muted">Audiencia</Kicker>
          <View style={styles.audRow}>
            <AudButton
              label="Todos los usuarios"
              icon="users"
              active={audience === 'ALL'}
              onPress={() => setAudience('ALL')}
            />
            <AudButton
              label="Solo staff"
              icon="shield"
              active={audience === 'ADMINS'}
              onPress={() => setAudience('ADMINS')}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Input
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder="Nuevo evento este viernes"
            maxLength={60}
            required
            helper={`${title.length}/60`}
          />
          <Input
            label="Mensaje"
            value={body}
            onChangeText={setBody}
            placeholder="Descripción corta del mensaje que verán los usuarios..."
            multiline
            maxLength={160}
            required
            helper={`${body.length}/160`}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
        </View>

        {/* Preview */}
        <View style={styles.card}>
          <Kicker tone="muted">Vista previa</Kicker>
          <View style={styles.notif}>
            <View style={styles.notifIcon}>
              <Body tone="inverse" weight="bold">O</Body>
            </View>
            <View style={{ flex: 1 }}>
              <Kicker tone="muted">OPALBAR</Kicker>
              <Subhead style={{ marginTop: 2 }}>{title || 'Título del push'}</Subhead>
              <Caption tone="secondary" style={{ marginTop: 2 }}>
                {body || 'Mensaje que verán los usuarios...'}
              </Caption>
            </View>
            <Caption tone="muted" size="sm">ahora</Caption>
          </View>
        </View>

        <Button
          label={sending ? 'Enviando...' : 'Enviar notificación'}
          variant="primary"
          size="lg"
          onPress={send}
          loading={sending}
          disabled={sending || !title.trim() || !body.trim()}
          leftIcon={<Feather name="send" size={16} color={Colors.textInverse} />}
        />

        <View style={styles.warn}>
          <Feather name="alert-triangle" size={14} color={Colors.accentPrimary} />
          <Caption tone="secondary" size="sm" style={{ flex: 1 }}>
            Las notificaciones se envían vía Expo Push. Solo llegan a dispositivos con el app
            instalada y la sesión iniciada.
          </Caption>
        </View>

        {/* Historial de broadcasts */}
        <View style={styles.card}>
          <Kicker tone="muted">Historial</Kicker>
          {loadingHistory ? (
            <ActivityIndicator color={Colors.accentPrimary} style={{ marginVertical: Spacing[4] }} />
          ) : historyError ? (
            <ErrorState message={historyError} onRetry={loadHistory} />
          ) : history.length === 0 ? (
            <Caption tone="muted" align="center" style={{ paddingVertical: Spacing[4] }}>
              Sin envíos todavía.
            </Caption>
          ) : (
            <View style={{ gap: Spacing[2] }}>
              {history.map((h) => (
                <View key={h.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Body size="sm" weight="semiBold" numberOfLines={1}>{h.title}</Body>
                    <Caption tone="muted" size="sm" numberOfLines={1} style={{ marginTop: 2 }}>
                      {h.body}
                    </Caption>
                    <Caption tone="muted" size="sm" style={{ marginTop: 4 }}>
                      {h.audience === 'ADMINS' ? 'Solo staff' : 'Todos'} · {relTime(h.sentAt)}
                    </Caption>
                  </View>
                  <View style={styles.historyCount}>
                    <Feather name="send" size={11} color={Colors.accentSuccess} />
                    <Caption size="sm" style={{ color: Colors.accentSuccess, fontWeight: '700' }}>
                      {h.sentCount}
                    </Caption>
                    {h.failedCount > 0 ? (
                      <Caption size="sm" style={{ color: Colors.accentDanger, fontWeight: '700' }}>
                        {' '}· {h.failedCount} fallidos
                      </Caption>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={performSend}
        title="Enviar push"
        description={`Enviar este mensaje a ${audience === 'ALL' ? 'todos los usuarios' : 'admins y moderadores'}?`}
        confirmLabel="Enviar"
      />
    </SafeAreaView>
  );
}

function AudButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.audBtn,
        active && styles.audBtnActive,
        pressed && styles.pressed,
      ]}
    >
      <Feather
        name={icon}
        size={15}
        color={active ? Colors.textInverse : Colors.textSecondary}
      />
      <Caption
        tone={active ? 'inverse' : 'secondary'}
        size="sm"
        style={{ fontWeight: '700' }}
      >
        {label}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing[2],
  },

  audRow: { flexDirection: 'row', gap: Spacing[2] },
  audBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  audBtnActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },

  notif: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'flex-start',
    backgroundColor: 'rgba(246,241,231,0.04)',
    borderRadius: Radius.lg,
    padding: Spacing[3],
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  historyCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  warn: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'flex-start',
    backgroundColor: 'rgba(201,169,97,0.08)',
    borderRadius: Radius.lg,
    padding: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,97,0.25)',
  },
});
