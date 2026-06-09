import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
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
import { AdminHeader } from '@/components/admin';

export default function PushBroadcast() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'ADMINS'>('ALL');
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

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
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSending(false);
    }
  }

  function send() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Faltan datos', 'Titulo y mensaje son obligatorios.');
      return;
    }
    setConfirmSend(true);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Push Notifications" kicker="Marketing" onBack={() => router.back()} />

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
            label="Titulo"
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
            placeholder="Descripcion corta del mensaje que veran los usuarios..."
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
              <Subhead style={{ marginTop: 2 }}>{title || 'Titulo del push'}</Subhead>
              <Caption tone="secondary" style={{ marginTop: 2 }}>
                {body || 'Mensaje que veran los usuarios...'}
              </Caption>
            </View>
            <Caption tone="muted" size="sm">ahora</Caption>
          </View>
        </View>

        <Button
          label={sending ? 'Enviando...' : 'Enviar notificacion'}
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
            Las notificaciones se envian via Expo Push. Solo llegan a dispositivos con el app
            instalada y la sesion iniciada.
          </Caption>
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
