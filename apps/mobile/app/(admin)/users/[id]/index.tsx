import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
  TextInput,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, messagesApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { Colors } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Admin User Detail — rich profile for ops
//  · Interests (from signup) as tags
//  · Stats grid + activity samples
//  · Consent matrix (GDPR / marketing)
//  · Actions: message, points, ban, role
// ─────────────────────────────────────────────

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function calcAge(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const md = now.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function formatBirthday(birth: string): string {
  const b = new Date(birth);
  return b.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

function formatMembership(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 1) return 'Hoy';
  if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'semana' : 'semanas'}`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  return `Hace ${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? 'año' : 'años'}`;
}

const ROLE_COLOR: Record<string, string> = {
  USER: Colors.textMuted,
  MODERATOR: '#60A5FA',
  ADMIN: Colors.accentPrimary,
  SUPER_ADMIN: '#A855F7',
};

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'rgba(56,199,147,0.15)', color: Colors.accentSuccess, label: 'ACTIVO' },
  BANNED: { bg: 'rgba(228,88,88,0.15)', color: Colors.accentDanger, label: 'BANEADO' },
  PENDING_VERIFICATION: { bg: 'rgba(244,163,64,0.15)', color: Colors.accentPrimary, label: 'SIN VERIFICAR' },
  DELETED: { bg: 'rgba(107,107,120,0.15)', color: Colors.textMuted, label: 'ELIMINADO' },
};

const ACTION_META: Record<string, { icon: FeatherIcon; color: string; label: string }> = {
  POINTS_ADJUST:     { icon: 'award',        color: Colors.accentPrimary, label: 'Ajuste de puntos' },
  STATUS_CHANGE:     { icon: 'refresh-cw',   color: '#60A5FA',            label: 'Cambio de estado' },
  ROLE_CHANGE:       { icon: 'shield',       color: '#A855F7',            label: 'Cambio de rol' },
  NOTE_ADDED:        { icon: 'edit-3',       color: Colors.accentWarning, label: 'Nota añadida' },
  NOTE_UPDATED:      { icon: 'edit-2',       color: Colors.accentWarning, label: 'Nota actualizada' },
  DELETE:            { icon: 'trash-2',      color: Colors.accentDanger,  label: 'Eliminación' },
  BAN:               { icon: 'slash',        color: Colors.accentDanger,  label: 'Ban' },
  UNBAN:             { icon: 'user-check',   color: Colors.accentSuccess, label: 'Unban' },
  VERIFY:            { icon: 'check-circle', color: Colors.accentSuccess, label: 'Verificación' },
  MESSAGE_SENT:      { icon: 'send',         color: '#60A5FA',            label: 'Mensaje enviado' },
  INTEREST_ADDED:    { icon: 'plus-circle',  color: Colors.accentSuccess, label: 'Interés añadido' },
  INTEREST_REMOVED:  { icon: 'minus-circle', color: Colors.textMuted,     label: 'Interés removido' },
  PROFILE_UPDATED:   { icon: 'user',         color: '#60A5FA',            label: 'Perfil actualizado' },
};

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.user(id);
      const u = r.data?.data ?? r.data;
      setUser(u);
      setNote(u?.profile?.internalNote ?? '');
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function saveNote() {
    setSavingNote(true);
    try {
      await adminApi.updateUserNote(id, note.trim());
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSavingNote(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function doBan() {
    Alert.alert(
      'Banear usuario',
      `¿Confirmar ban de ${name}? Esta acción puede revertirse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Banear',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await adminApi.banUser(id, 'Infracción de política');
              await load();
            } catch (err) {
              Alert.alert('Error', apiError(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function doUnban() {
    setBusy(true);
    try {
      await adminApi.unbanUser(id);
      await load();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    try {
      const r = await messagesApi.createThread(id);
      const threadId = r.data?.data?.id;
      if (threadId) router.push(`/(app)/messages/${threadId}` as never);
    } catch (err) {
      Alert.alert('Error', apiError(err));
    }
  }

  async function doDelete() {
    Alert.alert(
      'Eliminar cuenta',
      `¿Eliminar ${name} permanentemente? Se borrarán sus datos personales (email, teléfono, perfil). Sus publicaciones quedan pero firmadas como "Usuario eliminado". El email se libera y podrá registrarse de nuevo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await adminApi.deleteUser(id);
              Alert.alert('Cuenta eliminada', `Se liberó el email de ${name}.`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert('Error', apiError(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function adjustPoints(delta: number) {
    Alert.prompt?.(
      `${delta > 0 ? 'Agregar' : 'Descontar'} puntos`,
      `Razón del ajuste ${delta > 0 ? `+${delta}` : delta}:`,
      async (reason) => {
        if (!reason?.trim()) return;
        setBusy(true);
        try {
          await adminApi.adjustUserPoints(id, delta, reason.trim());
          await load();
        } catch (err) {
          Alert.alert('Error', apiError(err));
        } finally {
          setBusy(false);
        }
      },
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textMuted }}>Usuario no encontrado</Text>
      </View>
    );
  }

  const firstName = user.profile?.firstName ?? '';
  const lastName = user.profile?.lastName ?? '';
  const name = `${firstName} ${lastName}`.trim() || user.email || 'Usuario';
  const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() ||
    (user.email?.[0]?.toUpperCase() ?? '?');
  const banned = user.status === 'BANNED';
  const statusMeta = STATUS_META[user.status] ?? STATUS_META.ACTIVE;

  const interests: any[] = user.interests ?? [];
  const recentPosts: any[] = user.recentPosts ?? [];
  const recentReservations: any[] = user.recentReservations ?? [];
  const reportsAgainst: any[] = user.reportsAgainst ?? [];
  const auditLog: any[] = user.auditLog ?? [];
  const noteDirty = note.trim() !== (user.profile?.internalNote ?? '').trim();
  const noteOverflow = note.length > 2000;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{(user.email || '').split('@')[0]}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
          onPress={() => id && router.push(`/(app)/users/${id}` as never)}
          hitSlop={10}
        >
          <Feather name="eye" size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ────────────────────────────── */}
        <View style={styles.hero}>
          {user.profile?.avatarUrl ? (
            <Image source={{ uri: user.profile.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user.email ?? user.phone ?? '—'}</Text>

          <View style={styles.heroBadges}>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
            {user.role !== 'USER' && (
              <View
                style={[
                  styles.rolePill,
                  { backgroundColor: (ROLE_COLOR[user.role] ?? '#888') + '22' },
                ]}
              >
                <Feather name="shield" size={11} color={ROLE_COLOR[user.role] ?? '#888'} />
                <Text style={[styles.rolePillText, { color: ROLE_COLOR[user.role] ?? '#888' }]}>
                  {user.role}
                </Text>
              </View>
            )}
            {user.profile?.loyaltyLevel && (
              <View style={styles.levelPill}>
                <Feather
                  name={(user.profile.loyaltyLevel.icon as any) || 'star'}
                  size={11}
                  color={Colors.accentPrimary}
                />
                <Text style={styles.levelPillText}>{user.profile.loyaltyLevel.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick action buttons ─────────────── */}
        <View style={styles.quickRow}>
          <QuickAction icon="send" label="Mensaje" onPress={openChat} />
          <QuickAction icon="plus-circle" label="+ Puntos" onPress={() => adjustPoints(50)} />
          <QuickAction icon="minus-circle" label="− Puntos" onPress={() => adjustPoints(-50)} />
        </View>

        {/* ── Dossier card (at-a-glance summary) ───── */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeader}>
            <Feather name="bookmark" size={13} color={Colors.accentPrimary} />
            <Text style={styles.dossierTitle}>Dossier del cliente</Text>
          </View>

          <View style={styles.dossierRows}>
            {user.profile?.birthDate && (
              <DossierLine
                icon="gift"
                label="Edad"
                value={`${calcAge(user.profile.birthDate)} años · cumple ${formatBirthday(user.profile.birthDate)}`}
              />
            )}
            {user.profile?.city && (
              <DossierLine icon="map-pin" label="Ubicación" value={user.profile.city} />
            )}
            <DossierLine
              icon="clock"
              label="Cliente desde"
              value={
                user.createdAt
                  ? formatMembership(user.createdAt)
                  : '—'
              }
            />
            {user.profile?.language && (
              <DossierLine
                icon="globe"
                label="Idioma"
                value={user.profile.language === 'en' ? 'Inglés' : 'Español'}
              />
            )}
            <DossierLine
              icon="activity"
              label="Engagement"
              value={`${(user._count?.posts ?? 0) + (user._count?.comments ?? 0) + (user._count?.reactions ?? 0)} interacciones`}
            />
          </View>

          {/* Top interests inline */}
          {interests.length > 0 && (
            <View style={styles.dossierInterests}>
              <Text style={styles.dossierInterestsLabel}>Le interesa</Text>
              <View style={styles.dossierChipRow}>
                {interests.slice(0, 4).map((i: any) => {
                  const tint = i.category?.color || Colors.accentPrimary;
                  return (
                    <View
                      key={i.id}
                      style={[styles.dossierChip, { borderColor: tint + '66', backgroundColor: tint + '15' }]}
                    >
                      <Text style={[styles.dossierChipText, { color: tint }]}>
                        {i.category?.name || '—'}
                      </Text>
                    </View>
                  );
                })}
                {interests.length > 4 && (
                  <View style={styles.dossierChipMore}>
                    <Text style={styles.dossierChipMoreText}>+{interests.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Bio quote */}
          {user.profile?.bio && (
            <View style={styles.dossierQuoteBox}>
              <Feather name="message-circle" size={11} color={Colors.textMuted} />
              <Text style={styles.dossierQuote} numberOfLines={3}>
                {user.profile.bio}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats grid ───────────────────────── */}
        <View style={styles.statsGrid}>
          <Stat icon="award" label="Puntos" value={user.points ?? 0} tint={Colors.accentPrimary} />
          <Stat icon="file-text" label="Posts" value={user._count?.posts ?? 0} tint={Colors.accentSuccess} />
          <Stat icon="message-circle" label="Comentarios" value={user._count?.comments ?? 0} tint="#60A5FA" />
          <Stat icon="bookmark" label="Reservas" value={user._count?.reservations ?? 0} tint="#EC4899" />
          <Stat icon="calendar" label="Eventos" value={user._count?.events ?? 0} tint="#A855F7" />
          <Stat icon="star" label="Reseñas" value={user._count?.reviews ?? 0} tint={Colors.accentWarning} />
          <Stat icon="user-plus" label="Seguidores" value={user._count?.followers ?? 0} tint="#38C793" />
          <Stat icon="user-check" label="Sigue a" value={user._count?.following ?? 0} tint="#6B6B78" />
        </View>

        {/* ── Moderation signal ────────────────── */}
        {(user._count?.reportedItems > 0 || user._count?.reports > 0 || reportsAgainst.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Señales de moderación</Text>
            <View style={styles.signalBox}>
              {user._count?.reportedItems > 0 && (
                <SignalRow
                  icon="alert-triangle"
                  color={Colors.accentDanger}
                  label="Reportado por otros"
                  value={`${user._count.reportedItems} ${user._count.reportedItems === 1 ? 'vez' : 'veces'}`}
                />
              )}
              {user._count?.reports > 0 && (
                <SignalRow
                  icon="flag"
                  color={Colors.accentWarning}
                  label="Reportes hechos"
                  value={`${user._count.reports}`}
                />
              )}
              {user.bannedAt && (
                <SignalRow
                  icon="x-octagon"
                  color={Colors.accentDanger}
                  label={`Baneado ${new Date(user.bannedAt).toLocaleDateString('es')}`}
                  value={user.banReason || ''}
                />
              )}
            </View>
          </View>
        )}

        {/* ── Interests (from signup) ──────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Intereses</Text>
            <Text style={styles.sectionCount}>{interests.length}</Text>
          </View>
          {interests.length === 0 ? (
            <Text style={styles.emptyText}>
              No seleccionó intereses al registrarse
            </Text>
          ) : (
            <View style={styles.tagRow}>
              {interests.map((i: any) => (
                <View
                  key={i.id}
                  style={[
                    styles.tag,
                    { borderColor: (i.category?.color || Colors.accentPrimary) + '55' },
                  ]}
                >
                  {i.category?.icon && (
                    <Feather
                      name={i.category.icon as any}
                      size={11}
                      color={i.category?.color || Colors.accentPrimary}
                    />
                  )}
                  <Text
                    style={[
                      styles.tagText,
                      { color: i.category?.color || Colors.accentPrimary },
                    ]}
                  >
                    {i.category?.name || '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Personal info ─────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="mail" label="Email" value={user.email ?? '—'} verified={user.isVerified} />
            <InfoRow icon="phone" label="Teléfono" value={user.phone ?? 'No registrado'} />
            {user.profile?.birthDate && (
              <InfoRow
                icon="gift"
                label="Cumpleaños"
                value={new Date(user.profile.birthDate).toLocaleDateString('es', {
                  day: 'numeric',
                  month: 'long',
                })}
              />
            )}
            {user.profile?.city && (
              <InfoRow icon="map-pin" label="Ciudad" value={user.profile.city} />
            )}
            <InfoRow
              icon="globe"
              label="Idioma"
              value={user.profile?.language === 'en' ? 'Inglés' : 'Español'}
            />
            <InfoRow
              icon="calendar"
              label="Miembro desde"
              value={
                user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('es', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
          </View>
        </View>

        {/* ── Consent (GDPR) ─────────────────────── */}
        {user.consent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Consentimiento</Text>
            <View style={styles.infoCard}>
              <ConsentRow label="Términos" accepted={user.consent.termsAccepted} />
              <ConsentRow label="Privacidad" accepted={user.consent.privacyAccepted} />
              <ConsentRow label="Marketing por email" accepted={user.consent.marketingConsent} />
              <ConsentRow label="Analíticas" accepted={user.consent.analyticsConsent} />
              <ConsentRow label="Notificaciones push" accepted={user.consent.pushConsent} />
            </View>
          </View>
        )}

        {/* ── Internal note (admins only) ──────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Nota interna</Text>
            <View style={styles.noteVisibilityPill}>
              <Feather name="lock" size={10} color={Colors.textMuted} />
              <Text style={styles.noteVisibilityText}>Solo admins</Text>
            </View>
          </View>
          <View style={styles.noteCard}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Observaciones: preferencias, alergias, incidentes, tipo de cliente, etc."
              placeholderTextColor={Colors.textMuted}
              maxLength={2200}
              textAlignVertical="top"
            />
            <View style={styles.noteFooter}>
              <Text
                style={[
                  styles.noteCount,
                  noteOverflow && { color: Colors.accentDanger },
                ]}
              >
                {note.length} / 2000
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.noteSaveBtn,
                  (!noteDirty || savingNote || noteOverflow) && { opacity: 0.5 },
                  pressed && styles.pressed,
                ]}
                onPress={saveNote}
                disabled={!noteDirty || savingNote || noteOverflow}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <>
                    <Feather name="save" size={13} color={Colors.textInverse} />
                    <Text style={styles.noteSaveLbl}>Guardar nota</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Recent activity ─────────────────────── */}
        {recentPosts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Últimas publicaciones</Text>
            <View style={styles.infoCard}>
              {recentPosts.map((p, idx) => (
                <View
                  key={p.id}
                  style={[styles.activityRow, idx === recentPosts.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.activityIcon}>
                    <Feather name="message-square" size={13} color={Colors.accentSuccess} />
                  </View>
                  <Text style={styles.activityText} numberOfLines={1}>
                    {p.content || '(imagen)'}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(p.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {recentReservations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Últimas reservas</Text>
            <View style={styles.infoCard}>
              {recentReservations.map((r, idx) => (
                <View
                  key={r.id}
                  style={[styles.activityRow, idx === recentReservations.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.activityIcon, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
                    <Feather name="bookmark" size={13} color="#EC4899" />
                  </View>
                  <Text style={styles.activityText}>
                    {new Date(r.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {r.partySize} pax
                  </Text>
                  <Text style={styles.activityTime}>{r.status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Audit log (admin actions on this user) ─── */}
        {auditLog.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Historial administrativo</Text>
              <Text style={styles.sectionCount}>{auditLog.length}</Text>
            </View>
            <View style={styles.auditCard}>
              {auditLog.map((entry: any, idx: number) => {
                const meta = ACTION_META[entry.action] ?? {
                  icon: 'activity' as FeatherIcon,
                  color: Colors.textMuted,
                  label: entry.action,
                };
                const adminProfile = entry.adminUser?.profile;
                const adminName = adminProfile
                  ? `${adminProfile.firstName ?? ''} ${adminProfile.lastName ?? ''}`.trim()
                  : '';
                const adminLabel = adminName || entry.adminUser?.email || 'Admin';
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.auditRow,
                      idx === auditLog.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.auditIcon, { backgroundColor: meta.color + '1F' }]}>
                      <Feather name={meta.icon} size={13} color={meta.color} />
                    </View>
                    <View style={styles.auditBody}>
                      <View style={styles.auditTopRow}>
                        <Text style={[styles.auditAction, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                        <Text style={styles.auditTime}>{formatAuditTime(entry.createdAt)}</Text>
                      </View>
                      {!!entry.summary && (
                        <Text style={styles.auditSummary} numberOfLines={3}>
                          {entry.summary}
                        </Text>
                      )}
                      <Text style={styles.auditAdmin}>por {adminLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Danger zone ─────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          {banned ? (
            <Pressable
              style={({ pressed }) => [styles.unbanBtn, (busy || pressed) && { opacity: 0.85 }]}
              onPress={doUnban}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <Feather name="user-check" size={16} color={Colors.textInverse} />
                  <Text style={styles.unbanLbl}>Desbanear usuario</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.banBtn,
                (busy || user.role !== 'USER' || pressed) && { opacity: 0.7 },
              ]}
              onPress={doBan}
              disabled={busy || user.role !== 'USER'}
            >
              {busy ? (
                <ActivityIndicator color={Colors.accentDanger} size="small" />
              ) : (
                <>
                  <Feather name="slash" size={16} color={Colors.accentDanger} />
                  <Text style={styles.banLbl}>
                    {user.role !== 'USER' ? 'No puedes banear a otro admin' : 'Banear usuario'}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Delete (SuperAdmin only, not for other admins) */}
          {isSuperAdmin && user.role !== 'SUPER_ADMIN' && user.status !== 'DELETED' && (
            <Pressable
              style={({ pressed }) => [
                styles.deleteBtn,
                (busy || pressed) && { opacity: 0.7 },
              ]}
              onPress={doDelete}
              disabled={busy}
            >
              <Feather name="trash-2" size={16} color={Colors.accentDanger} />
              <Text style={styles.deleteBtnLbl}>Eliminar cuenta</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: FeatherIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Feather name={icon} size={16} color={Colors.textPrimary} />
      <Text style={styles.quickBtnLabel}>{label}</Text>
    </Pressable>
  );
}

function DossierLine({
  icon,
  label,
  value,
}: {
  icon: FeatherIcon;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.dossierRow}>
      <Feather name={icon} size={13} color={Colors.textMuted} />
      <Text style={styles.dossierRowLabel}>{label}</Text>
      <Text style={styles.dossierRowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: FeatherIcon;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIconBox, { backgroundColor: tint + '1F' }]}>
        <Feather name={icon} size={13} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  verified,
}: {
  icon: FeatherIcon;
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={13} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueBox}>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
        {verified === true && (
          <Feather name="check-circle" size={12} color={Colors.accentSuccess} />
        )}
        {verified === false && (
          <Feather name="alert-circle" size={12} color={Colors.accentWarning} />
        )}
      </View>
    </View>
  );
}

function ConsentRow({ label, accepted }: { label: string; accepted: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Feather
        name={accepted ? 'check' : 'x'}
        size={13}
        color={accepted ? Colors.accentSuccess : Colors.textMuted}
      />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          { color: accepted ? Colors.accentSuccess : Colors.textMuted, textAlign: 'right' },
        ]}
      >
        {accepted ? 'Aceptado' : 'Rechazado'}
      </Text>
    </View>
  );
}

function SignalRow({
  icon,
  color,
  label,
  value,
}: {
  icon: FeatherIcon;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.signalRow}>
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.signalLabel, { color }]}>{label}</Text>
      <Text style={styles.signalValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },

  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  avatarBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 34 },
  name: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  email: { color: Colors.textMuted, fontSize: 13 },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rolePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
  },
  levelPillText: { color: Colors.accentPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  quickBtnLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },

  // Dossier
  dossierCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.35)',
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  dossierTitle: {
    color: Colors.accentPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dossierRows: { gap: 1 },
  dossierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dossierRowLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    width: 86,
  },
  dossierRowValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  dossierInterests: {
    marginTop: 12,
  },
  dossierInterestsLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dossierChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dossierChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dossierChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dossierChipMore: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  dossierChipMoreText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  dossierQuoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  dossierQuote: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  stat: {
    width: '23.5%',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 2,
  },
  statIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 10, textAlign: 'center' },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tagText: { fontSize: 11, fontWeight: '700' },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Info card
  infoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  infoLabel: { color: Colors.textMuted, fontSize: 12, width: 90 },
  infoValueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },

  // Activity rows
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  activityIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(56,199,147,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1, color: Colors.textPrimary, fontSize: 12 },
  activityTime: { color: Colors.textMuted, fontSize: 10 },

  // Moderation signals
  signalBox: {
    backgroundColor: 'rgba(228,88,88,0.06)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(228,88,88,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
  },
  signalLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  signalValue: { color: Colors.textMuted, fontSize: 11, flexShrink: 1 },

  // Internal note
  noteVisibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  noteVisibilityText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  noteCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.35)',
    padding: 12,
    gap: 10,
  },
  noteInput: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 100,
    padding: 0,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  noteCount: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  noteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.accentPrimary,
  },
  noteSaveLbl: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '800',
  },

  // Audit log
  auditCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  auditRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  auditIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  auditBody: {
    flex: 1,
    gap: 3,
  },
  auditTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  auditAction: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  auditTime: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  auditSummary: {
    color: Colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  auditAdmin: {
    color: Colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },

  // Action buttons
  banBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(228,88,88,0.3)',
  },
  banLbl: { color: Colors.accentDanger, fontSize: 14, fontWeight: '700' },
  unbanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accentSuccess,
  },
  unbanLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(228,88,88,0.5)',
    backgroundColor: 'transparent',
  },
  deleteBtnLbl: { color: Colors.accentDanger, fontSize: 13, fontWeight: '700' },
});
