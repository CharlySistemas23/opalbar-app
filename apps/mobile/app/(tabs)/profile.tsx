// ─────────────────────────────────────────────
//  Profile — Editorial Premium
//
//  Magazine-style identity page:
//   · Identity block: StoryRing + Display name + handle/since (no cards)
//   · Stats block: 3 numeric (Fraunces serif) with kicker labels beneath,
//     separated by hairlines
//   · "Mi muro" — 3 wall actions as bordered tiles (kicker + icon)
//   · Activity + Account — grouped using <ListItem> primitives with
//     hairline separators (no colored icon bubbles — too tech-app)
//   · Staff section (conditional) — same ListItem treatment
//   · Danger zone — danger Button for logout, ghost link for delete
//
//  Confirmations use <ConfirmDialog> (replaces legacy ConfirmSheet).
//  Delete still asks for an explicit "ELIMINAR" type via Input.
// ─────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useFeedback } from '@/hooks/useFeedback';
import {
  Body,
  Button,
  Caption,
  ConfirmDialog,
  FadeIn,
  Hairline,
  Input,
  Kicker,
  ListItem,
  Numeric,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';
import { MembershipCard } from '@/components/membership';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface MenuEntry {
  icon: FeatherIcon;
  label: { es: string; en: string };
  path: string;
}

const ACTIVITY_MENU: MenuEntry[] = [
  { icon: 'calendar', label: { es: 'Mis reservas', en: 'My bookings' }, path: '/(app)/reservations/my' },
  { icon: 'star', label: { es: 'Mis puntos', en: 'My points' }, path: '/(app)/profile/wallet' },
  { icon: 'gift', label: { es: 'Historial de canjes', en: 'Redemption history' }, path: '/(app)/profile/redemptions' },
  { icon: 'bookmark', label: { es: 'Guardados', en: 'Saved' }, path: '/(app)/profile/saved' },
];

const ACCOUNT_MENU: MenuEntry[] = [
  { icon: 'user', label: { es: 'Editar perfil', en: 'Edit profile' }, path: '/(app)/profile/edit' },
  { icon: 'message-circle', label: { es: 'Mensajes', en: 'Messages' }, path: '/(app)/messages' },
  { icon: 'user-plus', label: { es: 'Solicitudes de amistad', en: 'Friend requests' }, path: '/(app)/profile/friend-requests' },
  { icon: 'user-check', label: { es: 'Solicitudes de etiqueta', en: 'Tag requests' }, path: '/(app)/profile/mention-requests' },
  { icon: 'bell', label: { es: 'Notificaciones', en: 'Notifications' }, path: '/(app)/profile/notifications' },
  { icon: 'settings', label: { es: 'Ajustes', en: 'Settings' }, path: '/(app)/profile/preferences' },
];

const ADMIN_ENTRY: MenuEntry = {
  icon: 'grid',
  label: { es: 'Panel admin', en: 'Admin panel' },
  path: '/(admin)/dashboard',
};
const STAFF_SCAN: MenuEntry = {
  icon: 'camera',
  label: { es: 'Escanear QR (Staff)', en: 'Scan QR (Staff)' },
  path: '/(app)/staff/scan',
};
const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];

export default function Profile() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );

  const firstName = user?.profile?.firstName ?? '';
  const lastName = user?.profile?.lastName ?? '';
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    (user?.email?.split('@')[0] ?? (t ? 'Usuario' : 'User'));
  const initials = ((firstName[0] || fullName[0] || 'U') + (lastName[0] || '')).slice(0, 2);
  const handle = (user?.email || '').split('@')[0] || 'opalbar';
  const points = user?.points ?? 0;
  const bookings = (user as any)?._count?.reservations ?? 0;
  const redemptions = (user as any)?._count?.offerRedemptions ?? 0;
  const memberYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  async function confirmLogout() {
    try {
      await logout();
      fb.logout();
      setShowLogout(false);
      router.replace('/(auth)/login' as never);
    } catch (err) {
      fb.error();
      toast(apiError(err, t ? 'Error al cerrar sesión.' : 'Logout failed.'), 'danger');
    }
  }

  async function confirmDelete() {
    const expected = t ? 'ELIMINAR' : 'DELETE';
    if (deleteConfirmText.trim().toUpperCase() !== expected) {
      toast(
        t ? `Escribe ${expected} para confirmar.` : `Type ${expected} to confirm.`,
        'warning',
      );
      return;
    }
    try {
      await usersApi.deleteAccount(deleteConfirmText);
      fb.destructive();
      setShowDelete(false);
      await logout();
      router.replace('/(auth)/welcome' as never);
    } catch (err) {
      fb.error();
      toast(apiError(err), 'danger');
    }
  }

  // Membership card data
  const tierName = user?.profile?.loyaltyLevel?.name;
  const memberNumber = user?.id ? user.id.slice(-4) : undefined;
  const validThrough = (() => {
    if (!user?.createdAt) return undefined;
    try {
      const created = new Date(user.createdAt);
      const expires = new Date(created.getFullYear() + 1, created.getMonth(), created.getDate());
      const mm = String(expires.getMonth() + 1).padStart(2, '0');
      const yy = String(expires.getFullYear()).slice(-2);
      return `${mm}/${yy}`;
    } catch {
      return undefined;
    }
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <FadeIn style={styles.profileHeader}>
          <Kicker tone="muted">{t ? 'PERFIL' : 'PROFILE'}</Kicker>
          <Caption tone="muted" style={{ marginTop: 2 }}>
            @{handle} · {t ? `Miembro desde ${memberYear}` : `Member since ${memberYear}`}
          </Caption>
        </FadeIn>

        {/* ── Membership Card (flippable) ── */}
        <FadeIn delay={80} style={styles.cardWrap}>
          <MembershipCard
            fullName={fullName}
            memberNumber={memberNumber}
            tierName={tierName}
            points={points}
            validThrough={validThrough}
            size="md"
            flippable
          />
        </FadeIn>

        {/* ── Stats (bookings + redemptions) ── */}
        <FadeIn delay={140}>
          <Hairline variant="subtle" style={{ marginTop: Spacing[4] }} />
          <View style={styles.stats}>
            <StatCell value={String(bookings)} label={t ? 'RESERVAS' : 'BOOKINGS'} />
            <View style={styles.statsDivider} />
            <StatCell value={String(redemptions)} label={t ? 'CANJES' : 'REDEEMED'} />
            <View style={styles.statsDivider} />
            <StatCell value={String(memberYear)} label={t ? 'DESDE' : 'SINCE'} />
          </View>
          <Hairline variant="subtle" />
        </FadeIn>

        {/* ── Mi muro ── */}
        <FadeIn delay={200} style={styles.wallBlock}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'MI MURO' : 'MY WALL'}
          </Kicker>
          <View style={styles.wallTiles}>
            <WallTile
              icon="grid"
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
        </FadeIn>

        {/* ── Actividad ── */}
        <MenuSection
          kicker={t ? 'ACTIVIDAD' : 'ACTIVITY'}
          entries={ACTIVITY_MENU}
          language={language}
          onPress={(path) => router.push(path as never)}
          delay={380}
        />

        {/* ── Cuenta ── */}
        <MenuSection
          kicker={t ? 'CUENTA' : 'ACCOUNT'}
          entries={ACCOUNT_MENU}
          language={language}
          onPress={(path) => router.push(path as never)}
          delay={440}
        />

        {/* ── Staff (condicional) ── */}
        {STAFF_ROLES.includes(user?.role ?? '') ? (
          <MenuSection
            kicker={t ? 'STAFF' : 'STAFF'}
            entries={[ADMIN_ENTRY, STAFF_SCAN]}
            language={language}
            onPress={(path) => router.push(path as never)}
            delay={500}
          />
        ) : null}

        {/* ── Danger zone ── */}
        <FadeIn delay={560} style={styles.dangerZone}>
          <Hairline variant="subtle" />
          <View style={{ height: Spacing[6] }} />
          <Button
            label={t ? 'Cerrar sesión' : 'Log out'}
            onPress={() => setShowLogout(true)}
            variant="danger"
            size="md"
            fullWidth
            haptic="destructive"
            leftIcon={<Feather name="log-out" size={16} color={Colors.accentDanger} />}
          />
          <Pressy
            onPress={() => {
              setDeleteConfirmText('');
              setShowDelete(true);
            }}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Eliminar mi cuenta' : 'Delete my account'}
            style={styles.deleteLink}
          >
            <Body size="sm" tone="muted" weight="semiBold" align="center">
              {t ? 'Eliminar mi cuenta' : 'Delete my account'}
            </Body>
          </Pressy>
        </FadeIn>
      </ScrollView>

      <ConfirmDialog
        open={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={confirmLogout}
        title={t ? 'Cerrar sesión' : 'Log out'}
        description={
          t
            ? 'Tu sesión se cerrará en este dispositivo. Podrás volver a iniciar cuando quieras.'
            : 'Your session will end on this device. You can log back in anytime.'
        }
        confirmLabel={t ? 'Cerrar sesión' : 'Log out'}
        confirmVariant="danger"
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        title={t ? 'Eliminar cuenta permanente' : 'Delete account permanently'}
        confirmLabel={t ? 'Eliminar mi cuenta' : 'Delete my account'}
        confirmVariant="danger"
        description={
          <View style={{ gap: Spacing[4] }}>
            <Body tone="secondary">
              {t
                ? 'Perderás todos tus puntos, reservas, canjes y posts. Esta acción no se puede deshacer.'
                : 'You will lose all your points, reservations, redemptions and posts. This cannot be undone.'}
            </Body>
            <Input
              label={t ? 'CONFIRMACIÓN' : 'CONFIRMATION'}
              placeholder={t ? 'Escribe ELIMINAR' : 'Type DELETE'}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Stat cell ────────────────────────────────
function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Numeric size="sm" align="center">
        {value}
      </Numeric>
      <Kicker tone="muted" align="center" style={{ marginTop: Spacing[1] }}>
        {label}
      </Kicker>
    </View>
  );
}

// ── Wall tile ────────────────────────────────
function WallTile({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: FeatherIcon;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressy
      onPress={onPress}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      style={[styles.wallTile, primary && styles.wallTilePrimary]}
    >
      <Feather
        name={icon}
        size={18}
        color={primary ? Colors.textInverse : Colors.textPrimary}
      />
      <Caption
        tone={primary ? 'inverse' : 'primary'}
        align="center"
        style={{ marginTop: Spacing[2] }}
      >
        {label}
      </Caption>
    </Pressy>
  );
}

// ── Menu section ─────────────────────────────
function MenuSection({
  kicker,
  entries,
  language,
  onPress,
  delay,
}: {
  kicker: string;
  entries: MenuEntry[];
  language: 'es' | 'en';
  onPress: (path: string) => void;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.menuSection}>
      <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
        {kicker}
      </Kicker>
      <View style={styles.listShell}>
        {entries.map((m, idx) => (
          <View key={m.path}>
            <ListItem
              title={m.label[language]}
              leftIcon={<Feather name={m.icon} size={18} color={Colors.textSecondary} />}
              onPress={() => onPress(m.path)}
              showChevron
            />
            {idx < entries.length - 1 ? <ListItem.Separator /> : null}
          </View>
        ))}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: Spacing[10] },

  profileHeader: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[1],
    paddingBottom: Spacing[3],
  },
  cardWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },

  stats: {
    flexDirection: 'row',
    paddingVertical: Spacing[4],
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing[2],
  },

  wallBlock: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[5],
  },
  wallTiles: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  wallTile: {
    flex: 1,
    minHeight: 88,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[3],
  },
  wallTilePrimary: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },

  menuSection: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[5],
  },
  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },

  dangerZone: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[6],
    gap: Spacing[3],
  },
  deleteLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[2],
  },
});
