// ─────────────────────────────────────────────
//  Guest Home — Editorial Premium
//
//  Pantalla para usuarios sin login. Mismo lenguaje que el home autenticado:
//   1. Header con Kicker OPALBAR + acción "Iniciar sesión"
//   2. Hero: Kicker "MODO INVITADO" + Heading
//   3. Banner registro (card hairline + CTA secondary)
//   4. Section "ESTA SEMANA" (events 16:10 thumbs + caption)
//   5. Section "PRIVILEGIOS DE MIEMBROS" (offers locked row)
//
//  Lógica intacta — eventsApi.list / offersApi.list / navegación.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';

interface EventItem {
  id: string;
  name?: string;
  title?: string;
  startDate?: string;
  imageUrl?: string;
  category?: { name?: string };
  status?: string;
}

interface OfferItem {
  id: string;
  title: string;
  description?: string;
  validWhen?: string;
}

function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;
  const api = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function fmtDate(d: string | undefined, lang: string, t: boolean) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(lang, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return t ? 'Fecha por confirmar' : 'TBA';
  }
}

export default function GuestHome() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [eRes, oRes] = await Promise.all([
        eventsApi.list({ limit: 5 }).catch(() => null),
        offersApi.list({ limit: 3 }).catch(() => null),
      ]);
      const evs =
        eRes?.data?.data?.items ??
        eRes?.data?.data?.data ??
        eRes?.data?.data ??
        [];
      const ofs =
        oRes?.data?.data?.items ??
        oRes?.data?.data?.data ??
        oRes?.data?.data ??
        [];
      setEvents(Array.isArray(evs) ? evs : []);
      setOffers(Array.isArray(ofs) ? ofs : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Colors.textMuted}
          />
        }
      >
        {/* ── 1. Header ───────────────────────── */}
        <View style={styles.header}>
          <View>
            <Kicker tone="muted">OPALBAR</Kicker>
            <Caption tone="secondary" style={{ marginTop: 2 }}>
              {t ? 'Buenas noches' : 'Welcome back'}
            </Caption>
          </View>
          <Pressy
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Iniciar sesión' : 'Sign in'}
            hitSlop={HitSlop.expand}
            haptic="select"
            style={styles.signInBtn}
          >
            <Caption tone="accent" size="sm" style={styles.signInLabel}>
              {t ? 'INICIAR SESIÓN' : 'SIGN IN'}
            </Caption>
          </Pressy>
        </View>

        {/* ── 2. Hero ─────────────────────────── */}
        <View style={styles.hero}>
          <FadeIn>
            <Kicker tone="champagne">{t ? 'MODO INVITADO' : 'GUEST MODE'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[2] }}>
            <Heading size="lg">
              {t ? 'Conoce el club.' : 'Discover the club.'}
            </Heading>
          </FadeIn>
          <FadeIn delay={140} style={{ marginTop: Spacing[3] }}>
            <Body tone="secondary">
              {t
                ? 'Explora eventos y privilegios. Para reservar o asistir, regístrate.'
                : 'Browse upcoming nights and privileges. Sign up to book or attend.'}
            </Body>
          </FadeIn>
        </View>

        {/* ── 3. Register banner ─────────────── */}
        <FadeIn delay={200} style={styles.bannerWrap}>
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Feather name="user-plus" size={16} color={Colors.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Subhead>
                {t ? 'Hazte miembro' : 'Become a member'}
              </Subhead>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {t
                  ? 'Acceso a reservas, eventos privados y privilegios.'
                  : 'Reservations, private events, and privileges.'}
              </Caption>
            </View>
          </View>
          <View style={{ marginTop: Spacing[3] }}>
            <Button
              label={t ? 'Crear cuenta' : 'Create account'}
              onPress={() => router.push('/(auth)/register')}
              variant="primary"
              size="md"
              fullWidth
              haptic="select"
            />
          </View>
        </FadeIn>

        {/* ── 4. Events section ──────────────── */}
        <View style={[styles.section, { paddingTop: Spacing[8] }]}>
          <FadeIn delay={260}>
            <Kicker tone="muted">
              {t ? 'ESTA SEMANA' : 'THIS WEEK'}
            </Kicker>
            <Hairline variant="normal" style={{ marginTop: Spacing[3] }} />
          </FadeIn>

          {loading ? (
            <View style={{ gap: Spacing[4], marginTop: Spacing[4] }}>
              <Skeleton height={180} radius={Radius.md} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
          ) : events.length === 0 ? (
            <Body
              tone="muted"
              style={{ paddingVertical: Spacing[5] }}
            >
              {t ? 'Sin eventos disponibles.' : 'No events available.'}
            </Body>
          ) : (
            events.map((ev, idx) => (
              <FadeIn key={ev.id} delay={60 * idx}>
                <Pressy
                  onPress={() => router.push(`/(app)/events/${ev.id}` as never)}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={ev.title || ev.name || (t ? 'Evento' : 'Event')}
                  style={styles.eventCard}
                  haptic="select"
                >
                  <View style={styles.eventImage}>
                    {ev.imageUrl ? (
                      <Image
                        source={{ uri: toAbsoluteImageUrl(ev.imageUrl) }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Feather name="image" size={20} color={Colors.textMuted} />
                    )}
                  </View>
                  <View style={styles.eventText}>
                    <Kicker tone="accent">
                      {[fmtDate(ev.startDate, language, t), ev.category?.name]
                        .filter(Boolean)
                        .join(' · ')
                        .toUpperCase()}
                    </Kicker>
                    <Subhead numberOfLines={2} style={{ marginTop: Spacing[1] }}>
                      {ev.title || ev.name || (t ? 'Sin título' : 'Untitled')}
                    </Subhead>
                  </View>
                </Pressy>
              </FadeIn>
            ))
          )}
        </View>

        {/* ── 5. Offers section ──────────────── */}
        <View style={[styles.section, { paddingTop: Spacing[8] }]}>
          <FadeIn delay={320}>
            <Kicker tone="muted">
              {t ? 'PRIVILEGIOS DE MIEMBROS' : 'MEMBER PRIVILEGES'}
            </Kicker>
            <Hairline variant="normal" style={{ marginTop: Spacing[3] }} />
          </FadeIn>

          {loading ? (
            <View style={{ gap: Spacing[3], marginTop: Spacing[4] }}>
              <Skeleton height={64} radius={Radius.md} />
              <Skeleton height={64} radius={Radius.md} />
            </View>
          ) : offers.length === 0 ? (
            <Body
              tone="muted"
              style={{ paddingVertical: Spacing[5] }}
            >
              {t ? 'Sin privilegios disponibles.' : 'No privileges available.'}
            </Body>
          ) : (
            offers.map((off, idx) => (
              <FadeIn key={off.id} delay={60 * idx}>
                <View style={styles.offerRow}>
                  <Feather
                    name="lock"
                    size={14}
                    color={Colors.textMuted}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Subhead numberOfLines={1}>{off.title}</Subhead>
                    {off.validWhen || off.description ? (
                      <Caption tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                        {off.validWhen || off.description}
                      </Caption>
                    ) : null}
                  </View>
                </View>
              </FadeIn>
            ))
          )}

          <View style={{ marginTop: Spacing[5] }}>
            <Button
              label={t ? 'Únete para desbloquear' : 'Join to unlock'}
              onPress={() => router.push('/(auth)/register')}
              variant="secondary"
              size="md"
              fullWidth
              haptic="select"
            />
          </View>
        </View>

        <View style={{ height: Spacing[12] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },
  signInBtn: {
    minHeight: 40,
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInLabel: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.6,
  },

  hero: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[6],
  },

  bannerWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(201,169,97,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[3],
  },

  eventCard: {
    marginTop: Spacing[2],
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  eventImage: {
    height: 180,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eventText: {
    paddingTop: Spacing[3],
    gap: 4,
  },

  offerRow: {
    marginTop: Spacing[2],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
