// ─────────────────────────────────────────────
//  Event Detail — Editorial Premium
//
//  Full-bleed 16:10 hero. Kicker (category) + Display title. Meta line
//  (date · venue) in serif body. Editorial stat strip for attendance/
//  spots/points/price. Two CTAs at the foot: attend (secondary) + book
//  table (primary).
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Numeric,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, usersApi, toAbsoluteImageUrl } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { shareEvent } from '@/utils/share';
import { ErrorState } from '@/components/ErrorState';

const HERO_RATIO = 16 / 10;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attending, setAttending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setNotFound(false);
    try {
      const [eventRes, savedRes] = await Promise.allSettled([
        eventsApi.get(id),
        isAuthenticated ? usersApi.savedItems('EVENT') : Promise.reject(null),
      ]);

      if (eventRes.status === 'fulfilled') {
        const data = eventRes.value.data?.data;
        setEvent(data);
        setAttending(!!data?.isAttending);
      } else {
        setEvent(null);
        if (eventRes.reason?.response?.status === 404) setNotFound(true);
        else setLoadError(apiError(eventRes.reason));
      }

      if (savedRes.status === 'fulfilled') {
        const rows: any[] = savedRes.value.data?.data ?? [];
        setSaved(rows.some((r) => r.targetId === id));
      }
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  async function toggleBookmark() {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    setSavingBookmark(true);
    const prev = saved;
    setSaved(!prev); // optimistic
    try {
      const r = await usersApi.toggleSave('EVENT', id);
      setSaved(!!r.data?.data?.saved);
    } catch (err: any) {
      setSaved(prev); // revert
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setSavingBookmark(false);
    }
  }

  async function toggleAttendance() {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    if (attending) {
      Alert.alert(
        t ? 'Cancelar asistencia' : 'Cancel attendance',
        t ? '¿Dejar de asistir a este evento?' : 'Stop attending this event?',
        [
          { text: t ? 'No' : 'No', style: 'cancel' },
          {
            text: t ? 'Sí, cancelar' : 'Yes, cancel',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await eventsApi.cancelAttendance(id);
                setAttending(false);
                setEvent((e: any) =>
                  e ? { ...e, currentCapacity: Math.max(0, (e.currentCapacity ?? 1) - 1) } : e,
                );
              } catch (err: any) {
                Alert.alert(t ? 'Error' : 'Error', apiError(err));
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      await eventsApi.attend(id);
      setAttending(true);
      setEvent((e: any) => (e ? { ...e, currentCapacity: (e.currentCapacity ?? 0) + 1 } : e));
    } catch (err: any) {
      // 409 = already registered server-side (e.g. a stale local state after
      // a previous attend that the client never saw the response for).
      if (err?.response?.status === 409) {
        setAttending(true);
      } else {
        Alert.alert(t ? 'Error' : 'Error', apiError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function goBookTable() {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    if (!event?.venue?.id) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'Local no disponible.' : 'Venue not available.');
      return;
    }
    router.push(`/(app)/reservations/new?eventId=${id}&venueId=${event.venue.id}` as never);
  }

  async function handleShare() {
    if (!event) return;
    await shareEvent({
      id: event.id,
      title: event.title,
      description: t ? event.description : event.descriptionEn || event.description,
      imageUrl: event.imageUrl,
      startDate: event.startDate,
      venueName: event.venue?.name,
      t,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.headerBar}>
          <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
        </View>
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, marginTop: Spacing[6], gap: Spacing[5] }}>
          <Skeleton width="100%" height={220} radius={Radius.lg} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={36} />
          <Skeleton width="60%" height={16} />
        </View>
      </SafeAreaView>
    );
  }
  if (!event) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.headerBar}>
          <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
        </View>
        <ErrorState
          title={notFound ? (t ? 'Evento no encontrado' : 'Event not found') : (t ? 'Algo no salió bien' : 'Something went wrong')}
          message={
            notFound
              ? (t ? 'Es posible que ya no esté disponible.' : 'It may no longer be available.')
              : loadError || (t ? 'No pudimos cargar el evento.' : "We couldn't load the event.")
          }
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      </SafeAreaView>
    );
  }

  const title = t ? event.title : event.titleEn || event.title;
  const description = t ? event.description : event.descriptionEn || event.description;
  const categoryName: string | undefined = event.category?.name;
  const isFree = event.isFree;
  const startDate = event.startDate ? new Date(event.startDate) : null;
  const dateStr = startDate
    ? startDate.toLocaleString(language, {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const spots = event.maxCapacity
    ? Math.max(0, event.maxCapacity - (event.currentCapacity ?? 0))
    : null;
  const venue = event.venue;
  const lat = venue?.lat != null ? Number(venue.lat) : null;
  const lng = venue?.lng != null ? Number(venue.lng) : null;
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const heroUri = toAbsoluteImageUrl(event.imageUrl);
  const canAttend = event.status === 'PUBLISHED' && !!startDate && startDate.getTime() > Date.now();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Hero ─────────────────────────────── */}
        <View style={styles.heroWrap}>
          {heroUri ? (
            <Pressable
              onPress={() => setPreviewVisible(true)}
              accessibilityRole={Roles.imagebutton}
              accessibilityLabel={t ? 'Ampliar imagen' : 'Zoom image'}
            >
              <Image
                source={{ uri: heroUri }}
                style={styles.heroImg}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          ) : (
            <View style={[styles.heroImg, styles.heroFallback]}>
              <Feather name="image" size={48} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.heroHeader}>
            <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} overlay />
            <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
              <Pressy
                onPress={toggleBookmark}
                disabled={savingBookmark}
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? (saved ? 'Quitar de guardados' : 'Guardar evento') : (saved ? 'Remove from saved' : 'Save event')}
                accessibilityState={{ selected: saved }}
                hitSlop={HitSlop.expand}
                haptic="select"
                style={styles.iconOverlay}
              >
                <Feather
                  name="bookmark"
                  size={18}
                  color={saved ? Colors.accentPrimary : Colors.textPrimary}
                  style={saved ? { opacity: 1 } : undefined}
                />
              </Pressy>
              <Pressy
                onPress={handleShare}
                accessibilityLabel={t ? 'Compartir' : 'Share'}
                hitSlop={HitSlop.expand}
                style={styles.iconOverlay}
              >
                <Feather name="share-2" size={18} color={Colors.textPrimary} />
              </Pressy>
            </View>
          </View>
        </View>

        {/* Body ─────────────────────────────── */}
        <View style={styles.body}>
          <FadeIn>
            <View style={styles.tagsRow}>
              {categoryName ? (
                <Badge label={categoryName.toUpperCase()} variant="accent" size="sm" />
              ) : null}
              {isFree ? (
                <Badge label={t ? 'ENTRADA LIBRE' : 'FREE ENTRY'} variant="success" size="sm" />
              ) : null}
            </View>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[4] }}>
            <Display size="md">{title}</Display>
          </FadeIn>

          {/* Meta line */}
          <FadeIn delay={160} style={{ marginTop: Spacing[4] }}>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={14} color={Colors.textMuted} />
                <Caption tone="secondary">{dateStr}</Caption>
              </View>
              {venue?.name ? (
                <Pressy
                  onPress={() => {
                    const url = hasCoords
                      ? Platform.OS === 'ios'
                        ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(venue.name)}`
                        : `https://maps.google.com/?q=${lat},${lng}`
                      : venue?.address
                        ? `https://maps.google.com/?q=${encodeURIComponent(venue.address)}`
                        : null;
                    if (url) Linking.openURL(url).catch(() => {});
                  }}
                  accessibilityLabel={t ? 'Abrir ubicación' : 'Open location'}
                  hitSlop={HitSlop.expand}
                  haptic="select"
                  style={styles.metaItem}
                >
                  <Feather name="map-pin" size={14} color={Colors.accentPrimary} />
                  <Caption tone="accent">{venue.name}</Caption>
                </Pressy>
              ) : null}
            </View>
          </FadeIn>

          {description ? (
            <FadeIn delay={240} style={{ marginTop: Spacing[5] }}>
              <Body size="lg" tone="secondary">
                {description}
              </Body>
            </FadeIn>
          ) : null}

          {/* Stat strip */}
          <FadeIn delay={320} style={styles.statStrip}>
            <StatBlock
              kicker={t ? 'ASISTEN' : 'ATTENDING'}
              value={String(event.currentCapacity ?? 0)}
            />
            {spots !== null ? (
              <StatBlock
                kicker={t ? 'DISPONIBLES' : 'AVAILABLE'}
                value={String(spots)}
              />
            ) : null}
            {event.pointsReward ? (
              <StatBlock
                kicker={t ? 'PUNTOS' : 'POINTS'}
                value={`+${event.pointsReward}`}
              />
            ) : null}
          </FadeIn>

          {/* Price block */}
          {!isFree && event.price ? (
            <FadeIn delay={400} style={{ marginTop: Spacing[8] }}>
              <Hairline variant="normal" />
              <View style={styles.priceRow}>
                <Kicker tone="muted">{t ? 'PRECIO' : 'PRICE'}</Kicker>
                <Numeric size="sm" tone="accent">
                  {event.currency || 'MXN'} ${Number(event.price).toLocaleString(language)}
                </Numeric>
              </View>
              <Hairline variant="normal" />
            </FadeIn>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA ─────────────────────────── */}
      <View style={styles.ctaWrap}>
        <Hairline variant="subtle" />
        <View style={styles.ctaInner}>
          <View style={styles.ctaRow}>
            <View style={{ flex: 1 }}>
              <Button
                label={attending ? (t ? 'Asistiendo' : 'Attending') : t ? 'Asistir' : 'Attend'}
                onPress={toggleAttendance}
                loading={busy}
                disabled={busy || (!attending && !canAttend)}
                variant={attending ? 'secondary' : 'secondary'}
                size="lg"
                haptic={attending ? 'warning' : 'success'}
                leftIcon={
                  <Feather
                    name={attending ? 'check' : 'star'}
                    size={16}
                    color={attending ? Colors.accentSuccess : Colors.accentPrimary}
                  />
                }
              />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button
                label={t ? 'Reservar mesa' : 'Book a table'}
                onPress={goBookTable}
                variant="primary"
                size="lg"
              />
            </View>
          </View>
        </View>
      </View>

      <RNModal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewBackdrop}>
          <Pressy
            onPress={() => setPreviewVisible(false)}
            accessibilityLabel={t ? 'Cerrar' : 'Close'}
            style={styles.previewClose}
            haptic="select"
          >
            <Feather name="x" size={20} color={Colors.textPrimary} />
          </Pressy>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

function StatBlock({ kicker, value }: { kicker: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Kicker tone="muted">{kicker}</Kicker>
      <View style={{ marginTop: Spacing[2] }}>
        <Numeric size="sm">{value}</Numeric>
      </View>
    </View>
  );
}

function BackBtn({
  onPress,
  label,
  overlay,
}: {
  onPress: () => void;
  label: string;
  overlay?: boolean;
}) {
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole={Roles.button}
      accessibilityLabel={label}
      hitSlop={HitSlop.expand}
      style={[styles.backBtn, overlay && styles.backBtnOverlay]}
    >
      <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
    </Pressy>
  );
}

const screenWidth = Dimensions.get('window').width;
const heroHeight = Math.round(screenWidth / HERO_RATIO);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },

  heroWrap: { width: '100%' },
  heroImg: { width: '100%', height: heroHeight },
  heroFallback: { backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  heroHeader: {
    position: 'absolute',
    top: Spacing[2],
    left: EditorialSpacing.pageGutter,
    right: EditorialSpacing.pageGutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },
  backBtnOverlay: {
    backgroundColor: 'rgba(8,7,6,0.45)',
    borderRadius: Radius.full,
    width: 40,
    height: 40,
    marginLeft: 0,
  },
  iconOverlay: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(8,7,6,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[5],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },

  statStrip: {
    marginTop: Spacing[8],
    flexDirection: 'row',
    gap: Spacing[4],
  },
  statBlock: { flex: 1 },

  priceRow: {
    paddingVertical: Spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgPrimary,
  },
  ctaInner: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[6],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: EditorialSpacing.pageGutter,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(246,241,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '80%' },
});
