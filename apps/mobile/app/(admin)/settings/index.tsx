import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Caption, ConfirmDialog, Kicker, Subhead } from '@/components/ui';
import { AdminHeader } from '@/components/admin';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

// Same source as the user-facing About screen — real version/build instead
// of a hand-typed string that goes stale the moment it ships.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? '');

interface Row {
  icon: FeatherIcon;
  label: string;
  sub?: string;
  path?: string;
  onPress?: () => void;
  color: string;
  destructive?: boolean;
}

export default function AdminSettings() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Backend: notifications/broadcast + insights/audience are ADMIN/SUPER_ADMIN only.
  const canSeeComms = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  async function performLogout() {
    setConfirmLogout(false);
    await logout();
    router.replace('/(auth)/login' as never);
  }

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Cambio de modo',
      rows: [
        { icon: 'smartphone', label: 'Modo Usuario', sub: 'Regresa a la app como cliente', color: Colors.accentInfo, onPress: () => router.replace('/(tabs)/home' as never) },
        { icon: 'camera', label: 'Escanear QR (Staff)', sub: 'Check-in de reservas y canjes', color: Colors.accentSuccess, path: '/(app)/staff/scan' },
      ],
    },
    ...(canSeeComms
      ? [{
          title: 'Comunicación',
          rows: [
            { icon: 'bell' as FeatherIcon, label: 'Push Notifications', sub: 'Enviar notificación masiva', color: Colors.accentPrimary, path: '/(admin)/notifications' },
            { icon: 'bar-chart-2' as FeatherIcon, label: 'Analytics', sub: 'Métricas del sistema', color: Colors.accentChampagne, path: '/(admin)/analytics' },
          ],
        }]
      : []),
    {
      title: 'Operación',
      rows: [
        { icon: 'users', label: 'Equipo staff', sub: 'Administradores y moderadores', color: Colors.accentInfo, path: '/(admin)/staff' },
        { icon: 'award', label: 'Niveles de fidelidad', sub: 'Beneficios por nivel', color: Colors.accentPrimary, path: '/(admin)/loyalty' },
        { icon: 'toggle-left', label: 'Feature flags', sub: 'Activar o desactivar funciones', color: Colors.accentPrimary, path: '/(admin)/flags' },
      ],
    },
    {
      title: 'Sistema',
      rows: [
        { icon: 'activity', label: 'Actividad reciente', sub: 'Historial de eventos', color: Colors.accentChampagne, path: '/(admin)/activity' },
        { icon: 'shield', label: 'Solicitudes GDPR', sub: 'Exportación y eliminación de datos', color: Colors.accentDanger, path: '/(admin)/gdpr' },
        { icon: 'info', label: 'Acerca de', sub: `OPALBAR v${APP_VERSION}${BUILD_NUMBER ? ` · Build ${BUILD_NUMBER}` : ''}`, color: Colors.textMuted },
      ],
    },
    {
      title: 'Sesión',
      rows: [
        {
          icon: 'log-out',
          label: 'Cerrar sesión',
          color: Colors.accentDanger,
          destructive: true,
          onPress: () => setConfirmLogout(true),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader title="Ajustes" kicker="Admin" hideBack />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120, gap: Spacing[4] }}>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Body tone="inverse" weight="bold" size="lg">
              {(user?.profile?.firstName?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()}
            </Body>
          </View>
          <View style={{ flex: 1 }}>
            <Subhead>
              {user?.profile?.firstName ?? 'Admin'} {user?.profile?.lastName ?? ''}
            </Subhead>
            <Caption tone="muted" style={{ marginTop: 2 }}>
              {user?.email}
            </Caption>
            <View style={styles.rolePill}>
              <Feather name="shield" size={10} color={Colors.accentPrimary} />
              <Kicker tone="accent" style={{ fontSize: 10 }}>{user?.role}</Kicker>
            </View>
          </View>
        </View>

        {sections.map((sec) => (
          <View key={sec.title} style={{ gap: Spacing[2] }}>
            <Kicker tone="muted">{sec.title}</Kicker>
            <View style={styles.group}>
              {sec.rows.map((r, i) => (
                <Pressable
                  key={r.label}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (r.onPress) r.onPress();
                    else if (r.path) router.push(r.path as never);
                  }}
                  disabled={!r.onPress && !r.path}
                  accessibilityRole="button"
                  accessibilityLabel={r.label}
                  accessibilityHint={r.sub}
                >
                  <View style={[styles.rowIcon, { backgroundColor: r.color + '20' }]}>
                    <Feather name={r.icon} size={16} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Subhead tone={r.destructive ? 'danger' : 'primary'}>{r.label}</Subhead>
                    {r.sub ? (
                      <Caption tone="muted" style={{ marginTop: 2 }}>
                        {r.sub}
                      </Caption>
                    ) : null}
                  </View>
                  {(r.onPress || r.path) && !r.destructive && (
                    <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={performLogout}
        title="Cerrar sesión"
        description="¿Seguro que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        confirmVariant="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  userCard: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.lg,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,169,97,0.14)',
    marginTop: 6,
  },

  group: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
