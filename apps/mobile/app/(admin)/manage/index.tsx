import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { Caption, Heading, Kicker, Subhead } from '@/components/ui';
import { useAdminCounts } from '@/hooks/useAdminCounts';

// ─────────────────────────────────────────────
//  Manage Hub — Editorial Premium
//  · Quick actions arriba (gold)
//  · Groups con kicker + tarjetas tokenized
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Section {
  id: string;
  icon: FeatherIcon;
  label: string;
  sub: string;
  path: string;
  pendingKey?: 'posts' | 'reviews' | 'tickets' | 'reservations' | 'flags' | 'reports';
}

interface Group {
  title: string;
  items: Section[];
}

const GROUPS: Group[] = [
  {
    title: 'Operaciones',
    items: [
      {
        id: 'events',
        icon: 'calendar',
        label: 'Eventos',
        sub: 'Crear, editar y cancelar',
        path: '/(admin)/manage/events',
      },
      {
        id: 'offers',
        icon: 'tag',
        label: 'Ofertas',
        sub: 'Promociones y canjes',
        path: '/(admin)/manage/offers',
      },
      {
        id: 'reservations',
        icon: 'bookmark',
        label: 'Reservaciones',
        sub: 'Mesas y check-ins',
        path: '/(admin)/manage/reservations',
        pendingKey: 'reservations',
      },
    ],
  },
  {
    title: 'Moderacion',
    items: [
      {
        id: 'community',
        icon: 'message-square',
        label: 'Comunidad',
        sub: 'Posts pendientes de revision',
        path: '/(admin)/manage/community',
        pendingKey: 'posts',
      },
      {
        id: 'reviews',
        icon: 'star',
        label: 'Resenas',
        sub: 'Opiniones de usuarios',
        path: '/(admin)/manage/reviews',
        pendingKey: 'reviews',
      },
      {
        id: 'venue-stories',
        icon: 'image',
        label: 'Historias del bar',
        sub: 'Publica como OPAL BAR PV',
        path: '/(admin)/community/stories',
      },
    ],
  },
  {
    title: 'Marketing',
    items: [
      {
        id: 'marketing',
        icon: 'mail',
        label: 'Email marketing',
        sub: 'Envia campanas desde el telefono',
        path: '/(admin)/marketing',
      },
      {
        id: 'push',
        icon: 'send',
        label: 'Notificaciones push',
        sub: 'Mensaje masivo a la app',
        path: '/(admin)/notifications',
      },
    ],
  },
  {
    title: 'Soporte',
    items: [
      {
        id: 'support',
        icon: 'inbox',
        label: 'Tickets',
        sub: 'Mensajes de usuarios',
        path: '/(admin)/manage/support',
        pendingKey: 'tickets',
      },
      {
        id: 'messages',
        icon: 'message-circle',
        label: 'Chats privados',
        sub: 'Supervision de DMs',
        path: '/(admin)/manage/messages',
      },
    ],
  },
  {
    title: 'Configuracion',
    items: [
      {
        id: 'venue',
        icon: 'map-pin',
        label: 'Datos del bar',
        sub: 'Foto, ubicacion y contacto',
        path: '/(admin)/manage/venue',
      },
      {
        id: 'reservations-config',
        icon: 'clock',
        label: 'Horarios y capacidad',
        sub: 'Config. de reservaciones',
        path: '/(admin)/manage/reservations/config',
      },
    ],
  },
];

const QUICK_ACTIONS: { icon: FeatherIcon; label: string; path: string }[] = [
  { icon: 'plus', label: 'Evento', path: '/(admin)/manage/events/new' },
  { icon: 'plus', label: 'Oferta', path: '/(admin)/manage/offers/new' },
  { icon: 'mail', label: 'Email', path: '/(admin)/marketing/new' },
];

export default function ManageHub() {
  const router = useRouter();
  const { counts } = useAdminCounts();

  const totalPending =
    counts.posts + counts.reviews + counts.tickets + counts.reservations;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Kicker tone="muted">Panel de administracion</Kicker>
            <Heading size="lg" style={{ marginTop: 4 }}>Gestion</Heading>
          </View>
          {totalPending > 0 && (
            <View style={styles.pendingPill}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>
                {totalPending} {totalPending === 1 ? 'pendiente' : 'pendientes'}
              </Text>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((q) => (
            <Pressable
              key={q.label}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
              onPress={() => router.push(q.path as never)}
              accessibilityRole="button"
              accessibilityLabel={`Crear ${q.label.toLowerCase()}`}
            >
              <View style={styles.quickIcon}>
                <Feather name={q.icon} size={16} color={Colors.accentPrimary} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Groups */}
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Kicker tone="muted" style={styles.groupTitle}>{group.title}</Kicker>
            <View style={styles.cardStack}>
              {group.items.map((s, idx) => {
                const pending = s.pendingKey ? counts[s.pendingKey] : 0;
                return (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [
                      styles.card,
                      idx === group.items.length - 1 && styles.cardLast,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => router.push(s.path as never)}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                    accessibilityHint={s.sub}
                  >
                    <View style={styles.cardIconBox}>
                      <Feather name={s.icon} size={16} color={Colors.accentPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Subhead>{s.label}</Subhead>
                      <Caption tone="muted" style={{ marginTop: 2 }}>{s.sub}</Caption>
                    </View>
                    {pending > 0 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{pending > 99 ? '99+' : pending}</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Caption tone="muted" align="center" style={styles.footerNote}>
          Toca en Gestion otra vez para regresar a este panel
        </Caption>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  header: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[5],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[2],
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(196,104,104,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,104,104,0.30)',
  },
  pendingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accentDanger,
  },
  pendingText: {
    ...TypePresets.label,
    color: Colors.accentDanger,
    fontSize: 11,
  },

  quickRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    paddingHorizontal: Spacing[5],
    marginBottom: Spacing[6],
  },
  quickBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...TypePresets.subhead,
    color: Colors.textPrimary,
    fontSize: 13,
  },

  group: {
    paddingHorizontal: Spacing[5],
    marginBottom: Spacing[5],
  },
  groupTitle: {
    marginBottom: Spacing[2],
    paddingHorizontal: 4,
  },
  cardStack: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cardLast: {
    borderBottomWidth: 0,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(201,169,97,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },

  footerNote: {
    paddingHorizontal: 40,
    marginTop: Spacing[2],
  },
});
