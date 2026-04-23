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
import { Colors } from '@/constants/tokens';
import { useAdminCounts } from '@/hooks/useAdminCounts';

// ─────────────────────────────────────────────
//  Manage Hub — grouped by area, pending badges inline
//  · Quick actions at top (create shortcuts)
//  · Section groups for clarity
//  · Pending counts shown per card
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Section {
  id: string;
  icon: FeatherIcon;
  label: string;
  sub: string;
  path: string;
  tint: string;
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
        tint: Colors.accentPrimary,
      },
      {
        id: 'offers',
        icon: 'tag',
        label: 'Ofertas',
        sub: 'Promociones y canjes',
        path: '/(admin)/manage/offers',
        tint: '#A855F7',
      },
      {
        id: 'reservations',
        icon: 'bookmark',
        label: 'Reservaciones',
        sub: 'Mesas y check-ins',
        path: '/(admin)/manage/reservations',
        tint: '#EC4899',
        pendingKey: 'reservations',
      },
    ],
  },
  {
    title: 'Moderación',
    items: [
      {
        id: 'community',
        icon: 'message-square',
        label: 'Comunidad',
        sub: 'Posts pendientes de revisión',
        path: '/(admin)/manage/community',
        tint: Colors.accentSuccess,
        pendingKey: 'posts',
      },
      {
        id: 'reviews',
        icon: 'star',
        label: 'Reseñas',
        sub: 'Opiniones de usuarios',
        path: '/(admin)/manage/reviews',
        tint: Colors.accentWarning,
        pendingKey: 'reviews',
      },
      {
        id: 'venue-stories',
        icon: 'image',
        label: 'Historias del bar',
        sub: 'Publica como OPAL BAR PV',
        path: '/(admin)/community/stories',
        tint: '#EC4899',
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
        sub: 'Envía campañas desde el teléfono',
        path: '/(admin)/marketing',
        tint: '#38C793',
      },
      {
        id: 'push',
        icon: 'send',
        label: 'Notificaciones push',
        sub: 'Mensaje masivo a la app',
        path: '/(admin)/notifications',
        tint: Colors.accentInfo,
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
        tint: '#60A5FA',
        pendingKey: 'tickets',
      },
      {
        id: 'messages',
        icon: 'message-circle',
        label: 'Chats privados',
        sub: 'Supervisión de DMs',
        path: '/(admin)/manage/messages',
        tint: '#F59E0B',
      },
    ],
  },
  {
    title: 'Configuración',
    items: [
      {
        id: 'venue',
        icon: 'map-pin',
        label: 'Datos del bar',
        sub: 'Foto, ubicación y contacto',
        path: '/(admin)/manage/venue',
        tint: Colors.accentPrimary,
      },
      {
        id: 'reservations-config',
        icon: 'clock',
        label: 'Horarios y capacidad',
        sub: 'Config. de reservaciones',
        path: '/(admin)/manage/reservations/config',
        tint: '#EC4899',
      },
    ],
  },
];

const QUICK_ACTIONS: { icon: FeatherIcon; label: string; path: string; tint: string }[] = [
  { icon: 'plus', label: 'Evento', path: '/(admin)/manage/events/new', tint: Colors.accentPrimary },
  { icon: 'plus', label: 'Oferta', path: '/(admin)/manage/offers/new', tint: '#A855F7' },
  { icon: 'mail', label: 'Email', path: '/(admin)/marketing/new', tint: '#38C793' },
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
        {/* ── Header ──────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titleHint}>Panel de administración</Text>
            <Text style={styles.title}>Gestión</Text>
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

        {/* ── Quick actions ───────────────────── */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((q) => (
            <Pressable
              key={q.label}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
              onPress={() => router.push(q.path as never)}
            >
              <View style={[styles.quickIcon, { backgroundColor: q.tint + '22' }]}>
                <Feather name={q.icon} size={18} color={q.tint} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Groups ──────────────────────────── */}
        {GROUPS.map((group, gi) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.cardStack}>
              {group.items.map((s, idx) => {
                const pending = s.pendingKey ? counts[s.pendingKey] : 0;
                return (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [
                      styles.card,
                      idx === 0 && styles.cardFirst,
                      idx === group.items.length - 1 && styles.cardLast,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => router.push(s.path as never)}
                  >
                    <View style={[styles.cardIconBox, { backgroundColor: s.tint + '1F' }]}>
                      <Feather name={s.icon} size={18} color={s.tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardLabel}>{s.label}</Text>
                      <Text style={styles.cardSub}>{s.sub}</Text>
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

        {/* ── Footer note ─────────────────────── */}
        <Text style={styles.footerNote}>
          Toca en Gestión otra vez para regresar a este panel
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleHint: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(228,88,88,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(228,88,88,0.3)',
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentDanger,
  },
  pendingText: {
    color: Colors.accentDanger,
    fontSize: 11,
    fontWeight: '700',
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 26,
  },
  quickBtn: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Groups
  group: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  groupTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cardStack: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cardFirst: {},
  cardLast: {
    borderBottomWidth: 0,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: '800',
  },

  footerNote: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 8,
    lineHeight: 16,
  },
});
