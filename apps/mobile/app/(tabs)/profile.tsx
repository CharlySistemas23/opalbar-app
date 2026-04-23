import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { StoryRing } from '@/components/StoryRing';
import { Colors, Radius } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface MenuEntry {
  icon: FeatherIcon;
  label: { es: string; en: string };
  tint: string;
  path: string;
}

const ACTIVITY_MENU: MenuEntry[] = [
  { icon: 'calendar', label: { es: 'Mis reservas', en: 'My bookings' }, tint: Colors.accentPrimary, path: '/(app)/reservations/my' },
  { icon: 'star', label: { es: 'Mis puntos', en: 'My points' }, tint: Colors.accentSuccess, path: '/(app)/profile/wallet' },
  { icon: 'gift', label: { es: 'Historial de canjes', en: 'Redemption history' }, tint: '#A855F7', path: '/(app)/profile/redemptions' },
  { icon: 'bookmark', label: { es: 'Guardados', en: 'Saved' }, tint: '#60A5FA', path: '/(app)/profile/saved' },
];

const ACCOUNT_MENU: MenuEntry[] = [
  { icon: 'user', label: { es: 'Editar perfil', en: 'Edit profile' }, tint: Colors.textPrimary, path: '/(app)/profile/edit' },
  { icon: 'message-circle', label: { es: 'Mensajes', en: 'Messages' }, tint: '#60A5FA', path: '/(app)/messages' },
  { icon: 'bell', label: { es: 'Notificaciones', en: 'Notifications' }, tint: '#A855F7', path: '/(app)/profile/notifications' },
  { icon: 'settings', label: { es: 'Configuración', en: 'Settings' }, tint: Colors.textMuted, path: '/(app)/profile/preferences' },
];

const ADMIN_ENTRY: MenuEntry = {
  icon: 'grid',
  label: { es: 'Panel admin', en: 'Admin panel' },
  tint: Colors.accentPrimary,
  path: '/(admin)/dashboard',
};
const STAFF_SCAN: MenuEntry = {
  icon: 'camera',
  label: { es: 'Escanear QR (Staff)', en: 'Scan QR (Staff)' },
  tint: Colors.accentSuccess,
  path: '/(app)/staff/scan',
};
const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const firstName = user?.profile?.firstName ?? 'Ana';
  const lastName = user?.profile?.lastName ?? 'García';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = (firstName[0] || 'A') + (lastName[0] || 'G');
  const points = user?.points ?? 1240;

  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleLogout() {
    setShowLogout(true);
  }

  const fb = useFeedback();

  async function confirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      fb.logout();
      setShowLogout(false);
      router.replace('/(auth)/login' as never);
    } finally { setLoggingOut(false); }
  }

  async function confirmDelete(_input?: string) {
    setDeleting(true);
    try {
      await usersApi.deleteAccount(_input);
      fb.destructive();
      setShowDelete(false);
      await logout();
      router.replace('/(auth)/welcome' as never);
    } catch (err) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally { setDeleting(false); }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ───── 1 · Identidad ───── */}
        <View style={styles.profileHero}>
          <StoryRing
            userId={user?.id}
            avatarUrl={user?.profile?.avatarUrl ?? null}
            initials={initials.toUpperCase()}
            fallbackColor={Colors.accentPrimary}
            size="lg"
            showIdleRing
            onPressNoStories={() => router.push('/(app)/community/new-story' as never)}
          />
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profileHandle}>
            @{(user?.email || '').split('@')[0] || 'anagarcia'}
          </Text>
          <Text style={styles.profileBio}>{t ? 'Miembro desde 2024' : 'Member since 2024'}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{points.toLocaleString(language)}</Text>
            <Text style={styles.statLabel}>{t ? 'Puntos' : 'Points'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>7</Text>
            <Text style={styles.statLabel}>{t ? 'Reservas' : 'Bookings'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>23</Text>
            <Text style={styles.statLabel}>{t ? 'Canjes' : 'Redeemed'}</Text>
          </View>
        </View>

        {/* ───── 2 · Mi muro (bloque protagonista) ───── */}
        <View style={styles.wallBlock}>
          <View style={styles.blockHeader}>
            <Feather name="layout" size={13} color={Colors.accentPrimary} />
            <Text style={styles.blockTitle}>{t ? 'Mi muro' : 'My wall'}</Text>
          </View>
          <View style={styles.wallTiles}>
            <WallTile
              icon="layout"
              label={t ? 'Ver muro' : 'View wall'}
              primary
              onPress={() => router.push(`/(app)/users/${user?.id}` as never)}
            />
            <WallTile
              icon="edit-3"
              label={t ? 'Publicar' : 'Post'}
              onPress={() => router.push('/(app)/community/new-post?surface=wall' as never)}
            />
            <WallTile
              icon="plus-circle"
              label={t ? 'Historia' : 'Story'}
              onPress={() => router.push('/(app)/community/new-story' as never)}
            />
          </View>
        </View>

        {/* ───── 3 · Actividad ───── */}
        <View style={styles.blockHeader}>
          <Feather name="activity" size={13} color={Colors.accentPrimary} />
          <Text style={styles.blockTitle}>{t ? 'Actividad' : 'Activity'}</Text>
        </View>
        <View style={styles.listCard}>
          {ACTIVITY_MENU.map((m, idx) => (
            <MenuRow
              key={m.path}
              entry={m}
              language={language}
              isLast={idx === ACTIVITY_MENU.length - 1}
              onPress={() => router.push(m.path as never)}
            />
          ))}
        </View>

        {/* ───── 4 · Cuenta ───── */}
        <View style={styles.blockHeader}>
          <Feather name="user" size={13} color={Colors.accentPrimary} />
          <Text style={styles.blockTitle}>{t ? 'Cuenta' : 'Account'}</Text>
        </View>
        <View style={styles.listCard}>
          {ACCOUNT_MENU.map((m, idx) => (
            <MenuRow
              key={m.path}
              entry={m}
              language={language}
              isLast={idx === ACCOUNT_MENU.length - 1}
              onPress={() => router.push(m.path as never)}
            />
          ))}
        </View>

        {/* ───── 5 · Staff / Admin (condicional) ───── */}
        {STAFF_ROLES.includes(user?.role ?? '') && (
          <>
            <View style={styles.blockHeader}>
              <Feather name="shield" size={13} color={Colors.accentPrimary} />
              <Text style={styles.blockTitle}>{t ? 'Staff' : 'Staff'}</Text>
            </View>
            <View style={styles.listCard}>
              <MenuRow entry={ADMIN_ENTRY} language={language} isLast={false} onPress={() => router.push(ADMIN_ENTRY.path as never)} />
              <MenuRow entry={STAFF_SCAN} language={language} isLast={true} onPress={() => router.push(STAFF_SCAN.path as never)} />
            </View>
          </>
        )}

        {/* ───── 6 · Danger ───── */}
        <View style={styles.dangerZone}>
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={Colors.accentDanger} />
            <Text style={styles.logoutLabel}>{t ? 'Cerrar sesión' : 'Log out'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountBtn}
            activeOpacity={0.85}
            onPress={() => setShowDelete(true)}
          >
            <Text style={styles.deleteAccountLbl}>
              {t ? 'Eliminar mi cuenta' : 'Delete my account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        icon="log-out"
        variant="danger"
        title={t ? 'Cerrar sesión' : 'Log out'}
        message={t
          ? 'Tu sesión se cerrará en este dispositivo. Podrás volver a iniciar cuando quieras.'
          : 'Your session will end on this device. You can log back in anytime.'}
        confirmLabel={t ? 'Cerrar sesión' : 'Log out'}
        loading={loggingOut}
        onConfirm={confirmLogout}
      />

      <ConfirmSheet
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        icon="trash-2"
        variant="danger"
        title={t ? 'Eliminar cuenta permanentemente' : 'Delete account permanently'}
        message={t
          ? 'Perderás todos tus puntos, reservas, canjes y posts. Esta acción no se puede deshacer.'
          : 'You will lose all your points, reservations, redemptions and posts. This cannot be undone.'}
        inputLabel={t ? 'Confirmación' : 'Confirmation'}
        inputPlaceholder={t ? 'Escribe ELIMINAR' : 'Type DELETE'}
        requireText={t ? 'ELIMINAR' : 'DELETE'}
        confirmLabel={t ? 'Eliminar mi cuenta' : 'Delete my account'}
        loading={deleting}
        onConfirm={confirmDelete}
      />

    </SafeAreaView>
  );
}

function WallTile({
  icon, label, onPress, primary,
}: { icon: FeatherIcon; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.wallTile, primary && styles.wallTilePrimary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.wallTileIcon, primary && styles.wallTileIconPrimary]}>
        <Feather name={icon} size={20} color={primary ? Colors.textInverse : Colors.accentPrimary} />
      </View>
      <Text style={[styles.wallTileLabel, primary && styles.wallTileLabelPrimary]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MenuRow({
  entry, language, isLast, onPress,
}: { entry: MenuEntry; language: 'es' | 'en'; isLast: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !isLast && styles.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuRowIcon, { backgroundColor: entry.tint + '1F' }]}>
        <Feather name={entry.icon} size={17} color={entry.tint} />
      </View>
      <Text style={styles.menuRowLabel}>{entry.label[language]}</Text>
      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 24 },

  // Profile Hero Section (Instagram-style)
  profileHero: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(244, 163, 64, 0.3)',
  },
  profileAvatarText: {
    color: Colors.textInverse,
    fontSize: 32,
    fontWeight: '800',
  },
  profileName: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  profileHandle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  profileBio: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },

  // Stats Container (Instagram-style row)
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: Colors.border,
    borderBottomColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },

  // ───── Block header (grupo) ─────
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 10,
  },
  blockTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  // ───── Mi muro (bloque protagonista) ─────
  wallBlock: {
    paddingHorizontal: 20,
    marginTop: 18,
  },
  wallTiles: {
    flexDirection: 'row',
    gap: 10,
  },
  wallTile: {
    flex: 1,
    height: 88,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wallTilePrimary: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  wallTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,163,64,0.15)',
  },
  wallTileIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  wallTileLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  wallTileLabelPrimary: {
    color: Colors.textInverse,
  },

  // ───── Lista agrupada (estilo iOS settings) ─────
  listCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  menuRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Danger Zone
  dangerZone: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(228, 88, 88, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(228, 88, 88, 0.2)',
  },
  logoutLabel: {
    color: Colors.accentDanger,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteAccountBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteAccountLbl: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
