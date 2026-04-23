import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, ImageBackground, Share, Linking, Platform, Modal, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;

  const api = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:3000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    eventsApi
      .get(id)
      .then((r) => {
        const data = r.data?.data;
        setEvent(data);
        setAttending(!!data?.isAttending);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

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
                setEvent((e: any) => e ? { ...e, currentCapacity: Math.max(0, (e.currentCapacity ?? 1) - 1) } : e);
              } catch (err: any) {
                Alert.alert(t ? 'Error' : 'Error', apiError(err));
              } finally { setBusy(false); }
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
      setEvent((e: any) => e ? { ...e, currentCapacity: (e.currentCapacity ?? 0) + 1 } : e);
    } catch (err: any) {
      const msg = apiError(err);
      if (/already/i.test(err?.response?.data?.message ?? '')) {
        setAttending(true);
      } else {
        Alert.alert(t ? 'Error' : 'Error', msg);
      }
    } finally { setBusy(false); }
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
    try {
      await Share.share({
        message: `${event.title} — ${event.venue?.name || 'OPALBAR'}`,
        title: event.title,
      });
    } catch {}
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }
  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t ? 'Evento no encontrado' : 'Event not found'}</Text>
      </View>
    );
  }

  const title = t ? event.title : event.titleEn || event.title;
  const description = t ? event.description : event.descriptionEn || event.description;
  const categoryName = event.category?.name;
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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.heroBox}>
          {event.imageUrl ? (
            <TouchableOpacity activeOpacity={0.95} style={styles.hero} onPress={() => setPreviewVisible(true)}>
              <ImageBackground source={{ uri: toAbsoluteImageUrl(event.imageUrl) }} style={styles.hero} imageStyle={{ borderRadius: 0 }}>
                <View style={styles.heroOverlay} />
                <HeaderButtons onBack={() => router.back()} onShare={handleShare} />
                <View style={styles.previewHint}>
                  <Feather name="maximize-2" size={12} color={Colors.textPrimary} />
                  <Text style={styles.previewHintText}>{t ? 'Toca para ampliar' : 'Tap to zoom'}</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ) : (
            <View style={[styles.hero, { backgroundColor: Colors.bgElevated }]}>
              <HeaderButtons onBack={() => router.back()} onShare={handleShare} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Tags row */}
          <View style={styles.tagsRow}>
            {categoryName && (
              <View style={[styles.tag, { backgroundColor: (event.category?.color || Colors.accentPrimary) + '20' }]}>
                <Text style={[styles.tagText, { color: event.category?.color || Colors.accentPrimary }]}>
                  {categoryName.toUpperCase()}
                </Text>
              </View>
            )}
            {isFree && (
              <View style={[styles.tag, { backgroundColor: Colors.accentSuccess + '20' }]}>
                <Text style={[styles.tagText, { color: Colors.accentSuccess }]}>
                  {t ? 'ENTRADA LIBRE' : 'FREE ENTRY'}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
            {event.venue?.name && (
              <TouchableOpacity
                style={styles.metaItem}
                onPress={() => {
                  const v = event.venue;
                  const lat = v?.lat != null ? Number(v.lat) : null;
                  const lng = v?.lng != null ? Number(v.lng) : null;
                  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
                  const url = hasCoords
                    ? (Platform.OS === 'ios'
                        ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(v.name)}`
                        : `https://maps.google.com/?q=${lat},${lng}`)
                    : v?.address
                      ? `https://maps.google.com/?q=${encodeURIComponent(v.address)}`
                      : null;
                  if (url) Linking.openURL(url).catch(() => {});
                }}
                activeOpacity={0.7}
              >
                <Feather name="map-pin" size={14} color={Colors.accentPrimary} />
                <Text style={[styles.metaText, { color: Colors.accentPrimary }]}>{event.venue.name}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Description */}
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Feather name="users" size={18} color={Colors.accentPrimary} />
              <Text style={styles.statValue}>{event.currentCapacity ?? 0}</Text>
              <Text style={styles.statLabel}>{t ? 'Asistentes' : 'Attendees'}</Text>
            </View>
            {spots !== null && (
              <View style={styles.statCard}>
                <Feather name="check-circle" size={18} color={Colors.accentSuccess} />
                <Text style={styles.statValue}>{spots}</Text>
                <Text style={styles.statLabel}>{t ? 'Disponibles' : 'Available'}</Text>
              </View>
            )}
            {event.pointsReward ? (
              <View style={styles.statCard}>
                <Feather name="star" size={18} color={Colors.accentPrimary} />
                <Text style={styles.statValue}>+{event.pointsReward}</Text>
                <Text style={styles.statLabel}>{t ? 'Puntos' : 'Points'}</Text>
              </View>
            ) : null}
          </View>

          {/* Price */}
          {!isFree && event.price ? (
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{t ? 'Precio' : 'Price'}</Text>
              <Text style={styles.priceValue}>
                {event.currency || 'MXN'} ${Number(event.price).toLocaleString(language)}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.cta}>
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaAttend, attending && styles.ctaAttending, busy && { opacity: 0.6 }]}
            onPress={toggleAttendance}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={attending ? Colors.accentSuccess : Colors.textInverse} size="small" />
              : <>
                  <Feather
                    name={attending ? 'check' : 'star'}
                    size={16}
                    color={attending ? Colors.accentSuccess : Colors.textInverse}
                  />
                  <Text style={[styles.ctaAttendLbl, attending && { color: Colors.accentSuccess }]}>
                    {attending ? (t ? 'Asistiendo' : 'Attending') : (t ? 'Asistiré' : 'Attend')}
                  </Text>
                </>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaBook}
            onPress={goBookTable}
            activeOpacity={0.9}
          >
            <Feather name="calendar" size={16} color={Colors.textInverse} />
            <Text style={styles.ctaLabel}>{t ? 'Reservar mesa' : 'Book a table'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)} hitSlop={10}>
            <Feather name="x" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Image source={{ uri: toAbsoluteImageUrl(event.imageUrl) }} style={styles.previewImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HeaderButtons({ onBack, onShare }: { onBack: () => void; onShare: () => void }) {
  return (
    <View style={styles.heroHdr}>
      <TouchableOpacity style={styles.iconBtn} onPress={onBack} hitSlop={10}>
        <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onShare} hitSlop={10}>
        <Feather name="share-2" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  notFound: { color: Colors.textSecondary },

  heroBox: { height: 280 },
  hero: { flex: 1 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  previewHint: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  previewHintText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
  heroHdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 14,
  },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', lineHeight: 32 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: Colors.textSecondary, fontSize: 13 },

  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },

  priceBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { color: Colors.textSecondary, fontSize: 14 },
  priceValue: { color: Colors.accentPrimary, fontSize: 22, fontWeight: '800' },

  cta: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaAttend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
  },
  ctaAttending: {
    backgroundColor: 'rgba(56,199,147,0.1)',
    borderColor: Colors.accentSuccess,
  },
  ctaAttendLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  ctaBook: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    flex: 1.4,
  },
  ctaLabel: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  previewClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
