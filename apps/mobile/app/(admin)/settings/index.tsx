import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

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

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'CAMBIO DE MODO',
      rows: [
        { icon: 'smartphone', label: 'Modo Usuario', sub: 'Regresa a la app como cliente', color: '#60A5FA', onPress: () => router.replace('/(tabs)/home' as never) },
        { icon: 'camera', label: 'Escanear QR (Staff)', sub: 'Check-in de reservas y canjes', color: Colors.accentSuccess, path: '/(app)/staff/scan' },
      ],
    },
    {
      title: 'COMUNICACIÓN',
      rows: [
        { icon: 'bell', label: 'Push Notifications', sub: 'Enviar notificación masiva', color: Colors.accentPrimary, path: '/(admin)/notifications' },
        { icon: 'bar-chart-2', label: 'Analytics', sub: 'Métricas del sistema', color: '#A855F7', path: '/(admin)/analytics' },
      ],
    },
    {
      title: 'OPERACIÓN',
      rows: [
        { icon: 'users', label: 'Equipo staff', sub: 'Administradores y moderadores', color: '#60A5FA', path: '/(admin)/staff' },
        { icon: 'award', label: 'Niveles de fidelidad', sub: 'Beneficios por nivel', color: Colors.accentPrimary, path: '/(admin)/loyalty' },
        { icon: 'toggle-left', label: 'Feature flags', sub: 'Activar o desactivar funciones', color: '#F59E0B', path: '/(admin)/flags' },
      ],
    },
    {
      title: 'SISTEMA',
      rows: [
        { icon: 'activity', label: 'Actividad reciente', sub: 'Historial de eventos', color: '#EC4899', path: '/(admin)/activity' },
        { icon: 'shield', label: 'Solicitudes GDPR', sub: 'Exportación y eliminación de datos', color: Colors.accentDanger, path: '/(admin)/gdpr' },
        { icon: 'info', label: 'Acerca de', sub: 'OPALBAR v1.0.0 · Build 2026-04', color: Colors.textMuted },
      ],
    },
    {
      title: 'SESIÓN',
      rows: [
        {
          icon: 'log-out', label: 'Cerrar sesión', color: Colors.accentDanger, destructive: true,
          onPress: () => Alert.alert('Cerrar sesión', '¿Seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Cerrar sesión', style: 'destructive',
              onPress: async () => {
                await logout();
                router.replace('/(auth)/login' as never);
              },
            },
          ]),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logo}><Feather name="settings" size={16} color={Colors.accentPrimary} /></View>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 18 }}>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.profile?.firstName?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>
              {user?.profile?.firstName ?? 'Admin'} {user?.profile?.lastName ?? ''}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.rolePill}>
              <Feather name="shield" size={10} color={Colors.accentPrimary} />
              <Text style={styles.roleText}>{user?.role}</Text>
            </View>
          </View>
        </View>

        {sections.map((sec) => (
          <View key={sec.title} style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>{sec.title}</Text>
            <View style={styles.group}>
              {sec.rows.map((r, i) => (
                <TouchableOpacity
                  key={r.label}
                  style={[styles.row, r.destructive && styles.rowDestructive, i > 0 && styles.rowBorder]}
                  activeOpacity={0.85}
                  onPress={() => { r.onPress ? r.onPress() : r.path ? router.push(r.path as never) : null; }}
                  disabled={!r.onPress && !r.path}
                >
                  <View style={[styles.rowIcon, { backgroundColor: r.color + '20' }]}>
                    <Feather name={r.icon} size={16} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, r.destructive && { color: Colors.accentDanger }]}>{r.label}</Text>
                    {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
                  </View>
                  {(r.onPress || r.path) && !r.destructive && (
                    <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  logo: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },

  userCard: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  userAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: Colors.textInverse, fontSize: 22, fontWeight: '800' },
  userName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  userEmail: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(244,163,64,0.15)',
    marginTop: 6,
  },
  roleText: { color: Colors.accentPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  group: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  rowDestructive: {},
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
