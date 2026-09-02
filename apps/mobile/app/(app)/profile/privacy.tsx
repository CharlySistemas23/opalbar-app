// ─────────────────────────────────────────────
//  Privacy — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · CUENTA (cuenta privada, switch real → PATCH /users/me/privacy)
//   · Policy pickers: MENSAJES · ETIQUETAS · AMISTAD (radio rows)
//   · BLOQUEADOS → pantalla de usuarios bloqueados
//   · Skeleton / ErrorState con reintento · optimistic + rollback + toast
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  usersApi,
  friendshipsApi,
  mentionsApi,
  type FriendPolicy,
  type MentionPolicy,
} from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useBiometricLock } from '@/lib/biometric';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Pressy,
  Skeleton,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

type DmPolicy = 'EVERYONE' | 'FOLLOWING' | 'FRIENDS_OF_FRIENDS' | 'FRIENDS_ONLY' | 'NONE';

interface PrivacyState {
  isPrivate: boolean;
  dmPolicy: DmPolicy;
  friendPolicy: FriendPolicy;
  mentionPolicy: MentionPolicy;
}

const DM_VALUES: DmPolicy[] = ['EVERYONE', 'FOLLOWING', 'FRIENDS_OF_FRIENDS', 'FRIENDS_ONLY', 'NONE'];
const FRIEND_VALUES: FriendPolicy[] = ['EVERYONE', 'FRIENDS_OF_FRIENDS', 'NONE'];
const MENTION_VALUES: MentionPolicy[] = ['EVERYONE', 'FRIENDS_OF_FRIENDS', 'FRIENDS_ONLY', 'NONE'];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

export default function Privacy() {
  const router = useRouter();
  const { language } = useAppStore();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const fb = useFeedback();
  const t = language === 'es';

  const [state, setState] = useState<PrivacyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const bio = useBiometricLock();
  const [savingBio, setSavingBio] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.me();
      const me = res?.data?.data ?? {};
      setState({
        isPrivate: !!me.isPrivate,
        dmPolicy: pick<DmPolicy>(me.dmPolicy, DM_VALUES, 'FRIENDS_ONLY'),
        friendPolicy: pick<FriendPolicy>(me.friendPolicy, FRIEND_VALUES, 'EVERYONE'),
        mentionPolicy: pick<MentionPolicy>(me.mentionPolicy, MENTION_VALUES, 'EVERYONE'),
      });
    } catch (err) {
      setError(apiError(err, t ? 'No se pudo cargar tu privacidad.' : 'Could not load your privacy settings.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveFailed = t ? 'No se pudo guardar.' : 'Save failed.';

  async function toggleBiometric(next: boolean) {
    if (savingBio) return;
    setSavingBio(true);
    try {
      const ok = await bio.setEnabled(next);
      if (!ok) {
        // Refused / cancelled / no enrollment — the preference stays as-is.
        toast(
          t ? 'No se activó el bloqueo. Inténtalo de nuevo.' : 'The lock was not enabled. Try again.',
          'warning',
        );
        return;
      }
      fb.toggle(next);
      toast(
        next
          ? t ? 'Bloqueo activado.' : 'Lock enabled.'
          : t ? 'Bloqueo desactivado.' : 'Lock disabled.',
        'success',
      );
    } finally {
      setSavingBio(false);
    }
  }

  async function togglePrivate() {
    if (!state || savingPrivate) return;
    const prev = state.isPrivate;
    const next = !prev;
    fb.toggle(next);
    setState((s) => (s ? { ...s, isPrivate: next } : s));
    setSavingPrivate(true);
    try {
      await usersApi.updatePrivacy({ isPrivate: next });
      toast(
        next
          ? t ? 'Tu cuenta ahora es privada.' : 'Your account is now private.'
          : t ? 'Tu cuenta ahora es pública.' : 'Your account is now public.',
        'success',
      );
      refreshUser().catch(() => undefined);
    } catch (err) {
      setState((s) => (s ? { ...s, isPrivate: prev } : s));
      toast(apiError(err, saveFailed), 'danger');
    } finally {
      setSavingPrivate(false);
    }
  }

  async function selectDmPolicy(next: DmPolicy) {
    if (!state || next === state.dmPolicy) return;
    const prev = state.dmPolicy;
    fb.toggle(true);
    setState((s) => (s ? { ...s, dmPolicy: next } : s));
    try {
      await usersApi.updateDmPolicy(next);
    } catch (err) {
      setState((s) => (s ? { ...s, dmPolicy: prev } : s));
      toast(apiError(err, saveFailed), 'danger');
    }
  }

  async function selectFriendPolicy(next: FriendPolicy) {
    if (!state || next === state.friendPolicy) return;
    const prev = state.friendPolicy;
    fb.toggle(true);
    setState((s) => (s ? { ...s, friendPolicy: next } : s));
    try {
      await friendshipsApi.updatePolicy(next);
    } catch (err) {
      setState((s) => (s ? { ...s, friendPolicy: prev } : s));
      toast(apiError(err, saveFailed), 'danger');
    }
  }

  async function selectMentionPolicy(next: MentionPolicy) {
    if (!state || next === state.mentionPolicy) return;
    const prev = state.mentionPolicy;
    fb.toggle(true);
    setState((s) => (s ? { ...s, mentionPolicy: next } : s));
    try {
      await mentionsApi.updatePolicy(next);
    } catch (err) {
      setState((s) => (s ? { ...s, mentionPolicy: prev } : s));
      toast(apiError(err, saveFailed), 'danger');
    }
  }

  const dmOptions: { value: DmPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede escribirte (irán a Solicitudes si no lo sigues).' : "Anyone can message you (filtered to Requests if you don't follow).",
    },
    {
      value: 'FOLLOWING',
      label: t ? 'Solo a quienes sigo' : 'People I follow',
      desc: t ? 'Solo gente que sigues puede iniciar conversación.' : 'Only people you follow can start a conversation.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo gente con amigos en común puede escribirte.' : 'Only people with mutual friends can message you.',
    },
    {
      value: 'FRIENDS_ONLY',
      label: t ? 'Solo amigos' : 'Friends only',
      desc: t ? 'Solo tus amigos confirmados pueden escribirte.' : 'Only confirmed friends can message you.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie nuevo puede enviarte mensajes.' : 'No one new can message you.',
    },
  ];

  const mentionOptions: { value: MentionPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede etiquetarte y aparece de inmediato.' : 'Anyone can tag you and it appears instantly.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Amigos al instante; amigos de amigos requieren aprobación.' : 'Friends tag instantly; friends-of-friends need approval.',
    },
    {
      value: 'FRIENDS_ONLY',
      label: t ? 'Solo amigos' : 'Friends only',
      desc: t ? 'Solo amigos al instante; otros requieren aprobación.' : 'Only friends tag instantly; others require approval.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie puede etiquetarte.' : 'No one can tag you.',
    },
  ];

  const friendOptions: { value: FriendPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede enviarte solicitudes.' : 'Anyone can send you friend requests.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo personas con amigos en común.' : 'Only people with mutual friends.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie puede enviarte solicitudes.' : 'No one can send you friend requests.',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.hero}>
          <Kicker tone="muted">{t ? 'AJUSTES' : 'SETTINGS'}</Kicker>
          <Heading size="md">{t ? 'Privacidad' : 'Privacy'}</Heading>
        </FadeIn>

        {loading ? (
          <View style={styles.section}>
            <Skeleton height={18} width="30%" />
            <View style={{ height: Spacing[3] }} />
            <Skeleton height={72} radius={14} />
            <View style={{ height: Spacing[8] }} />
            <Skeleton height={18} width="45%" />
            <View style={{ height: Spacing[3] }} />
            <Skeleton height={300} radius={14} />
          </View>
        ) : error || !state ? (
          <ErrorState
            title={t ? 'No pudimos cargar tu privacidad' : 'Could not load your privacy'}
            message={error ?? (t ? 'Inténtalo de nuevo.' : 'Try again.')}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={load}
            icon="shield-off"
          />
        ) : (
          <>
            {/* ── Cuenta ── */}
            <FadeIn delay={80} style={styles.section}>
              <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
                {t ? 'CUENTA' : 'ACCOUNT'}
              </Kicker>
              <View style={styles.listShell}>
                <ListItem
                  title={t ? 'Cuenta privada' : 'Private account'}
                  subtitle={
                    t
                      ? 'Solo tus amigos y seguidores aceptados ven tu bio, publicaciones y listas.'
                      : 'Only friends and accepted followers can see your bio, posts and lists.'
                  }
                  leftIcon={<Feather name="lock" size={18} color={Colors.accentPrimary} />}
                  rightSlot={
                    <Switch
                      value={state.isPrivate}
                      onValueChange={togglePrivate}
                      disabled={savingPrivate}
                      trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                      thumbColor={Colors.textInverse}
                      accessibilityLabel={t ? 'Cuenta privada' : 'Private account'}
                    />
                  }
                />
              </View>
            </FadeIn>

            <PolicyGroup
              kicker={t ? 'QUIÉN PUEDE ESCRIBIRME' : 'WHO CAN MESSAGE ME'}
              options={dmOptions}
              value={state.dmPolicy}
              onSelect={selectDmPolicy}
              delay={140}
            />
            <PolicyGroup
              kicker={t ? 'QUIÉN PUEDE ETIQUETARME' : 'WHO CAN TAG ME'}
              options={mentionOptions}
              value={state.mentionPolicy}
              onSelect={selectMentionPolicy}
              delay={200}
            />
            <PolicyGroup
              kicker={t ? 'SOLICITUDES DE AMISTAD' : 'FRIEND REQUESTS'}
              options={friendOptions}
              value={state.friendPolicy}
              onSelect={selectFriendPolicy}
              delay={260}
            />

            {/* ── Seguridad ── */}
            {bio.ready && bio.available ? (
              <FadeIn delay={300} style={styles.section}>
                <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
                  {t ? 'SEGURIDAD' : 'SECURITY'}
                </Kicker>
                <View style={styles.listShell}>
                  <ListItem
                    title={
                      bio.kind === 'face'
                        ? (t ? 'Bloqueo con Face ID' : 'Face ID lock')
                        : bio.kind === 'fingerprint'
                          ? (t ? 'Bloqueo con huella' : 'Fingerprint lock')
                          : (t ? 'Bloqueo biométrico' : 'Biometric lock')
                    }
                    subtitle={
                      bio.enrolled
                        ? (t
                          ? 'Pide tu biometría al abrir la app y al volver de segundo plano.'
                          : 'Asks for biometrics on open and when returning from the background.')
                        : (t
                          ? 'Configura Face ID o tu huella en los ajustes del teléfono para usarlo.'
                          : 'Set up Face ID or your fingerprint in phone settings to use this.')
                    }
                    leftIcon={
                      <Feather
                        name={bio.kind === 'face' ? 'smile' : 'unlock'}
                        size={18}
                        color={bio.enrolled ? Colors.accentPrimary : Colors.textMuted}
                      />
                    }
                    rightSlot={
                      <Switch
                        value={bio.enabled}
                        disabled={!bio.enrolled || savingBio}
                        onValueChange={toggleBiometric}
                        trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                        thumbColor={Colors.textInverse}
                        accessibilityLabel={t ? 'Bloqueo biométrico' : 'Biometric lock'}
                      />
                    }
                  />
                </View>
              </FadeIn>
            ) : null}

            {/* ── Bloqueados ── */}
            <FadeIn delay={320} style={styles.section}>
              <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
                {t ? 'BLOQUEOS' : 'BLOCKING'}
              </Kicker>
              <View style={styles.listShell}>
                <ListItem
                  title={t ? 'Usuarios bloqueados' : 'Blocked users'}
                  subtitle={
                    t
                      ? 'Las personas bloqueadas no pueden verte, escribirte ni etiquetarte.'
                      : "Blocked people can't see you, message you or tag you."
                  }
                  leftIcon={<Feather name="slash" size={18} color={Colors.accentDanger} />}
                  showChevron
                  onPress={() => router.push('/(app)/profile/blocked' as never)}
                />
              </View>
            </FadeIn>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyGroup<T extends string>({
  kicker,
  options,
  value,
  onSelect,
  disabled,
  delay,
}: {
  kicker: string;
  options: { value: T; label: string; desc: string }[];
  value: T;
  onSelect: (v: T) => void;
  disabled?: boolean;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.section}>
      <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
        {kicker}
      </Kicker>
      <View style={styles.listShell}>
        {options.map((opt, idx) => {
          const selected = value === opt.value;
          return (
            <View key={opt.value}>
              <ListItem
                title={opt.label}
                subtitle={opt.desc}
                selected={selected}
                onPress={() => onSelect(opt.value)}
                disabled={disabled}
                rightSlot={<Radio selected={selected} />}
              />
              {idx < options.length - 1 ? <ListItem.Separator /> : null}
            </View>
          );
        })}
      </View>
    </FadeIn>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={[styles.radio, selected && styles.radioOn]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[12],
  },
  hero: {
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  section: {
    marginTop: Spacing[8],
  },
  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.accentPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentPrimary,
  },
});
