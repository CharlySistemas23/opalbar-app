// ─────────────────────────────────────────────
//  MemberCard — Soho House networking row
//
//  Brief usuario: comunidad NO es IG-clone. Es networking entre miembros
//  del club. Cada perfil muestra:
//    avatar | name + tier badge dot | profession | location | Connect | Message | Invite
//
//  Tier badge dot tinted con color del tier (resolveTier).
// ─────────────────────────────────────────────
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';
import { Body, Caption, Pressy, Subhead } from '@/components/ui';
import { resolveTier } from '@/constants/tiers';

interface MemberLite {
  id: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  loyaltyLevel?: { name?: string } | null;
  profession?: string | null;
  city?: string | null;
  country?: string | null;
}

interface Props {
  member: MemberLite;
  /** State of connection: 'none' | 'pending' | 'connected' */
  connectionState?: 'none' | 'pending' | 'connected';
  onPress: () => void;
  onConnect?: () => void;
  onMessage?: () => void;
  onInvite?: () => void;
  t: boolean;
}

export function MemberCard({
  member,
  connectionState = 'none',
  onPress,
  onConnect,
  onMessage,
  onInvite,
  t,
}: Props) {
  const fullName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'Miembro';
  const tier = resolveTier(member.loyaltyLevel?.name);
  const initials = (
    (member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')
  ).toUpperCase() || 'M';

  const subline = [member.profession, [member.city, member.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.shell}>
      <Pressy
        onPress={onPress}
        haptic="select"
        accessibilityRole={Roles.button}
        accessibilityLabel={`${fullName}, ${tier.labelEs} member`}
        style={styles.row}
      >
        {/* Avatar with tier-tinted ring */}
        <View style={[styles.avatarRing, { borderColor: tier.base }]}>
          {member.avatarUrl ? (
            <Image
              source={{ uri: member.avatarUrl }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tier.cardMid }]}>
              <Caption style={{ color: tier.base, fontWeight: '700' }}>{initials}</Caption>
            </View>
          )}
        </View>

        {/* Identity */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Subhead numberOfLines={1} style={{ flexShrink: 1 }}>
              {fullName}
            </Subhead>
            <View style={[styles.tierDot, { backgroundColor: tier.base }]} />
          </View>
          {subline ? (
            <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {subline}
            </Caption>
          ) : null}
        </View>
      </Pressy>

      {/* Actions row */}
      <View style={styles.actionsRow}>
        {connectionState === 'connected' ? (
          <ActionBtn
            label={t ? 'Mensaje' : 'Message'}
            icon="message-circle"
            primary
            onPress={onMessage ?? (() => {})}
          />
        ) : connectionState === 'pending' ? (
          <ActionBtn
            label={t ? 'Pendiente' : 'Pending'}
            icon="clock"
            disabled
            onPress={() => {}}
          />
        ) : (
          <ActionBtn
            label={t ? 'Conectar' : 'Connect'}
            icon="user-plus"
            primary
            onPress={onConnect ?? (() => {})}
          />
        )}
        {onInvite ? (
          <ActionBtn
            label={t ? 'Invitar' : 'Invite'}
            icon="mail"
            onPress={onInvite}
          />
        ) : null}
      </View>
    </View>
  );
}

function ActionBtn({
  label,
  icon,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = disabled
    ? Colors.textDisabled
    : primary
      ? Colors.accentPrimary
      : Colors.textSecondary;
  return (
    <Pressy
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      style={[styles.actionBtn, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Feather name={icon} size={14} color={color} />
      <Body size="sm" style={{ color, marginLeft: Spacing[1] }}>
        {label}
      </Body>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    minHeight: 44,
  },
});
