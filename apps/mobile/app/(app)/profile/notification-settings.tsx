// ─────────────────────────────────────────────
//  Notification Settings — Editorial Premium
//
//  Magazine-style settings:
//   · Kicker + Heading header
//   · Grouped lists: CANALES · PREFERENCIAS · FEEDBACK & SONIDO
//   · State is loaded from `/users/me` → `notificationSettings` (the real
//     Prisma columns). Toggling sends ONLY the changed key so we never
//     overwrite the server with stale local defaults.
//   · Optimistic toggle (auto-save). Failures revert + toast error.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Pressy,
  Skeleton,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

/** Real `NotificationSettings` columns (prisma/schema.prisma). */
interface NotifSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  newEvents: boolean;
  eventReminders: boolean;
  newOffers: boolean;
  communityReplies: boolean;
  communityReactions: boolean;
  pointsUpdates: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
}

type NotifKey = keyof NotifSettings;

const DEFAULTS: NotifSettings = {
  pushEnabled: true,
  emailEnabled: true,
  newEvents: true,
  eventReminders: true,
  newOffers: true,
  communityReplies: true,
  communityReactions: false,
  pointsUpdates: true,
  marketingEmails: false,
  weeklyDigest: true,
};

export default function NotificationSettings() {
  const router = useRouter();
  const {
    language,
    hapticsEnabled, setHapticsEnabled,
    soundsEnabled, setSoundsEnabled,
  } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<NotifKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await usersApi.me();
      const raw = (res?.data?.notificationSettings ?? {}) as Partial<NotifSettings>;
      // Missing row (never toggled anything) → Prisma defaults.
      setSettings({ ...DEFAULTS, ...raw });
    } catch (err: any) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (key: NotifKey) => {
    if (!settings) return;
    const previous = settings[key];
    const next = !previous;
    fb.toggle(next);
    setSettings((prev) => (prev ? { ...prev, [key]: next } : prev));
    setSaving(key);
    try {
      // Single key only — the backend upserts just what it receives.
      await usersApi.updateNotifications({ [key]: next });
    } catch (err: any) {
      setSettings((prev) => (prev ? { ...prev, [key]: previous } : prev));
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    } finally {
      setSaving(null);
    }
  }, [settings, fb, t]);

  const CHANNELS: { key: NotifKey; label: string; desc: string }[] = [
    {
      key: 'pushEnabled',
      label: t ? 'Notificaciones push' : 'Push notifications',
      desc: t ? 'Avisos en tu teléfono.' : 'Alerts on your phone.',
    },
    {
      key: 'emailEnabled',
      label: t ? 'Correo electrónico' : 'Email',
      desc: t ? 'Resúmenes y confirmaciones por correo.' : 'Summaries and confirmations by email.',
    },
  ];

  const TOPICS: { key: NotifKey; label: string; desc: string }[] = [
    {
      key: 'newEvents',
      label: t ? 'Nuevos eventos' : 'New events',
      desc: t ? 'Cuando OPAL BAR publica un evento.' : 'When OPAL BAR publishes an event.',
    },
    {
      key: 'eventReminders',
      label: t ? 'Recordatorios' : 'Reminders',
      desc: t ? 'Tus reservaciones y eventos próximos.' : 'Your upcoming reservations and events.',
    },
    {
      key: 'newOffers',
      label: t ? 'Ofertas' : 'Offers',
      desc: t ? 'Descuentos y promociones nuevas.' : 'New discounts and promotions.',
    },
    {
      key: 'communityReplies',
      label: t ? 'Comentarios y menciones' : 'Comments and mentions',
      desc: t ? 'Respuestas a tus publicaciones.' : 'Replies to your posts.',
    },
    {
      key: 'communityReactions',
      label: t ? 'Reacciones' : 'Reactions',
      desc: t ? 'Cuando alguien reacciona a lo tuyo.' : 'When someone reacts to your content.',
    },
    {
      key: 'pointsUpdates',
      label: t ? 'Puntos y nivel' : 'Points and level',
      desc: t ? 'Puntos ganados y cambios de nivel.' : 'Points earned and level changes.',
    },
    {
      key: 'weeklyDigest',
      label: t ? 'Resumen semanal' : 'Weekly digest',
      desc: t ? 'Lo mejor de la semana en un correo.' : 'The week’s highlights in one email.',
    },
    {
      key: 'marketingEmails',
      label: t ? 'Novedades y marketing' : 'News and marketing',
      desc: t ? 'Campañas y noticias del bar.' : 'Campaigns and bar news.',
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
          <Heading size="md">{t ? 'Notificaciones' : 'Notifications'}</Heading>
        </FadeIn>

        {loading ? (
          <View style={{ gap: Spacing[3], marginTop: Spacing[6] }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={64} radius={14} />
            ))}
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            title={t ? 'Algo no salió bien' : 'Something went wrong'}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={load}
          />
        ) : (
          <>
            {/* ── Canales ── */}
            <FadeIn delay={60} style={styles.section}>
              <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
                {t ? 'CANALES' : 'CHANNELS'}
              </Kicker>
              <View style={styles.listShell}>
                {CHANNELS.map((it, idx) => (
                  <View key={it.key}>
                    <ListItem
                      title={it.label}
                      subtitle={it.desc}
                      rightSlot={
                        <Switch
                          value={settings?.[it.key] ?? false}
                          disabled={saving === it.key}
                          onValueChange={() => toggle(it.key)}
                          trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                          thumbColor={Colors.textInverse}
                          accessibilityLabel={it.label}
                        />
                      }
                    />
                    {idx < CHANNELS.length - 1 ? <ListItem.Separator /> : null}
                  </View>
                ))}
              </View>
              {settings && !settings.pushEnabled ? (
                <Body size="sm" tone="muted" style={{ marginTop: Spacing[2] }}>
                  {t
                    ? 'Con las push desactivadas solo verás los avisos dentro de la app.'
                    : 'With push off you will only see alerts inside the app.'}
                </Body>
              ) : null}
            </FadeIn>

            {/* ── Preferencias ── */}
            <FadeIn delay={110} style={styles.section}>
              <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
                {t ? 'PREFERENCIAS' : 'PREFERENCES'}
              </Kicker>
              <View style={styles.listShell}>
                {TOPICS.map((it, idx) => (
                  <View key={it.key}>
                    <ListItem
                      title={it.label}
                      subtitle={it.desc}
                      rightSlot={
                        <Switch
                          value={settings?.[it.key] ?? false}
                          disabled={saving === it.key}
                          onValueChange={() => toggle(it.key)}
                          trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                          thumbColor={Colors.textInverse}
                          accessibilityLabel={it.label}
                        />
                      }
                    />
                    {idx < TOPICS.length - 1 ? <ListItem.Separator /> : null}
                  </View>
                ))}
              </View>
            </FadeIn>
          </>
        )}

        {/* ── Feedback ── */}
        <FadeIn delay={160} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'FEEDBACK Y SONIDO' : 'HAPTICS & SOUND'}
          </Kicker>
          <View style={styles.listShell}>
            <ListItem
              title={t ? 'Vibración' : 'Haptics'}
              subtitle={t ? 'Vibración al tocar, enviar, confirmar.' : 'Vibration on tap, send, confirm.'}
              rightSlot={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={(v) => { fb.toggle(v); setHapticsEnabled(v); }}
                  trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                  thumbColor={Colors.textInverse}
                  accessibilityLabel={t ? 'Vibración' : 'Haptics'}
                />
              }
            />
            <ListItem.Separator />
            <ListItem
              title={t ? 'Sonidos' : 'Sounds'}
              subtitle={t ? 'Sonidos de like, mensaje, canje.' : 'Sounds on like, message, redemption.'}
              rightSlot={
                <Switch
                  value={soundsEnabled}
                  onValueChange={setSoundsEnabled}
                  trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                  thumbColor={Colors.textInverse}
                  accessibilityLabel={t ? 'Sonidos' : 'Sounds'}
                />
              }
            />
          </View>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
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
});
