import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert, Image, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { venueApi, reviewsApi, offersApi, eventsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Bar tab — hub for the primary venue (OPAL BAR PV)
//  · Loads first venue from /venues
//  · Shows hero, info, actions, reservation CTA, offers preview
// ─────────────────────────────────────────────

async function openDirections(venue: { lat?: number | string | null; lng?: number | string | null; address?: string | null; name?: string }) {
  const lat = venue.lat != null ? Number(venue.lat) : null;
  const lng = venue.lng != null ? Number(venue.lng) : null;
  const name = venue.name ?? 'OPAL BAR';
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords && !venue.address) {
    Alert.alert('Sin ubicación', 'Este lugar aún no tiene ubicación registrada.');
    return;
  }

  if (Platform.OS === 'ios') {
    const appleUrl = hasCoords
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`
      : `http://maps.apple.com/?q=${encodeURIComponent(`${name} ${venue.address ?? ''}`)}`;
    const canOpen = await Linking.canOpenURL(appleUrl).catch(() => false);
    if (canOpen) return Linking.openURL(appleUrl);
  }

  const query = hasCoords && venue.address
    ? `${name}, ${venue.address}`
    : hasCoords
      ? `${lat},${lng}(${name})`
      : `${name} ${venue.address}`;

  return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}

async function callVenue(phone?: string | null) {
  if (!phone) return;
  const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) Linking.openURL(url);
}

export default function BarTab() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [venue, setVenue] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const listRes = await venueApi.list({ limit: 1 });
      const payload = listRes.data?.data;
      const first = Array.isArray(payload?.data) ? payload.data[0] : Array.isArray(payload) ? payload[0] : null;
      if (!first) {
        setVenue(null);
        setError(t ? 'Aún no hay información del bar.' : 'No bar info yet.');
        return;
      }
      const nowIso = new Date().toISOString();
      const [vRes, rRes, oRes, eRes] = await Promise.all([
        venueApi.get(first.id),
        reviewsApi.venueSummary(first.id).catch(() => null),
        offersApi.list({ limit: 3, venueId: first.id }).catch(() => null),
        eventsApi.list({ limit: 4, venueId: first.id, startDate: nowIso }).catch(() => null),
      ]);
      setVenue(vRes.data?.data ?? first);
      setSummary(rRes?.data?.data ?? null);
      setOffers(oRes?.data?.data?.data ?? []);
      setEvents(eRes?.data?.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || (t ? 'Error al cargar' : 'Load error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error || (t ? 'Sin datos' : 'No data')}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>{t ? 'Reintentar' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const rating = Number(venue.ratingAvg ?? summary?.averageRating ?? 0);
  const reviewCount = Number(venue.ratingCount ?? summary?.totalReviews ?? 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accentPrimary}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          {venue.coverUrl || venue.imageUrl ? (
            <Image source={{ uri: venue.coverUrl || venue.imageUrl }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Feather name="image" size={32} color={Colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
            <View style={[styles.badge, venue.isActive ? styles.badgeOpen : styles.badgeClosed]}>
              <View style={[styles.badgeDot, { backgroundColor: venue.isActive ? Colors.accentSuccess : Colors.textMuted }]} />
              <Text style={[styles.badgeLabel, { color: venue.isActive ? Colors.accentSuccess : Colors.textMuted }]}>
                {venue.isActive ? (t ? 'Abierto' : 'Open') : (t ? 'Cerrado' : 'Closed')}
              </Text>
            </View>
          </View>

          {reviewCount > 0 ? (
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={Colors.accentWarning} />
              <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.ratingMeta}>({reviewCount} {t ? 'reseñas' : 'reviews'})</Text>
            </View>
          ) : null}

          {venue.description ? (
            <Text style={styles.description}>{venue.description}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <ActionTile icon="navigation" label={t ? 'Cómo llegar' : 'Directions'} onPress={() => openDirections(venue)} />
            {venue.phone ? (
              <ActionTile icon="phone" label={t ? 'Llamar' : 'Call'} onPress={() => callVenue(venue.phone)} />
            ) : null}
            {venue.website ? (
              <ActionTile icon="globe" label={t ? 'Sitio' : 'Website'} onPress={() => Linking.openURL(venue.website).catch(() => {})} />
            ) : null}
          </View>

          <View style={styles.infoCard}>
            {venue.address ? (
              <TouchableOpacity style={styles.infoRow} onPress={() => openDirections(venue)} activeOpacity={0.7}>
                <Feather name="map-pin" size={16} color={Colors.accentPrimary} />
                <Text style={styles.infoText} numberOfLines={2}>{venue.address}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            {venue.openTime && venue.closeTime ? (
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Feather name="clock" size={16} color={Colors.accentPrimary} />
                <Text style={styles.infoText}>
                  {t ? 'Horario: ' : 'Hours: '}{venue.openTime}–{venue.closeTime}
                </Text>
              </View>
            ) : null}

            {venue.phone ? (
              <TouchableOpacity style={[styles.infoRow, styles.infoRowBorder]} onPress={() => callVenue(venue.phone)} activeOpacity={0.7}>
                <Feather name="phone" size={16} color={Colors.accentPrimary} />
                <Text style={styles.infoText}>{venue.phone}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Upcoming events */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t ? 'Próximos eventos' : 'Upcoming events'}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/events' as never)} hitSlop={8}>
              <Text style={styles.sectionLink}>{t ? 'Ver todos' : 'See all'}</Text>
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <View style={styles.offersEmpty}>
              <Feather name="calendar" size={20} color={Colors.textMuted} />
              <Text style={styles.offersEmptyText}>
                {t ? 'Sin eventos próximos.' : 'No upcoming events.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            >
              {events.map((e) => {
                const dt = e.startDate ? new Date(e.startDate) : null;
                const dateLabel = dt
                  ? dt.toLocaleDateString(t ? 'es-MX' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
                  : '';
                const timeLabel = dt
                  ? dt.toLocaleTimeString(t ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.eventCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(app)/events/${e.id}` as never)}
                  >
                    {e.imageUrl ? (
                      <Image source={{ uri: e.imageUrl }} style={styles.eventImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.eventImg, styles.eventImgPlaceholder]}>
                        <Feather name="calendar" size={22} color={Colors.accentPrimary} />
                      </View>
                    )}
                    <View style={styles.eventBody}>
                      {dateLabel ? <Text style={styles.eventDate}>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}</Text> : null}
                      <Text style={styles.eventTitle} numberOfLines={2}>{e.title}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Offers preview */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t ? 'Ofertas activas' : 'Active offers'}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/offers' as never)} hitSlop={8}>
              <Text style={styles.sectionLink}>{t ? 'Ver todas' : 'See all'}</Text>
            </TouchableOpacity>
          </View>

          {offers.length === 0 ? (
            <View style={styles.offersEmpty}>
              <Feather name="tag" size={20} color={Colors.textMuted} />
              <Text style={styles.offersEmptyText}>
                {t ? 'Sin ofertas por ahora.' : 'No offers right now.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {offers.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.offerRow}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(app)/offers/${o.id}` as never)}
                >
                  <View style={styles.offerIconBox}>
                    {o.imageUrl ? (
                      <Image source={{ uri: o.imageUrl }} style={styles.offerImg} resizeMode="cover" />
                    ) : (
                      <Feather name="tag" size={18} color={Colors.accentPrimary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offerTitle} numberOfLines={1}>{o.title}</Text>
                    {o.validWhen ? (
                      <Text style={styles.offerMeta} numberOfLines={1}>{o.validWhen}</Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Actions inline — reservation primary, review secondary */}
          <View style={styles.bottomActions}>
            <Button
              label={t ? 'Hacer reservación' : 'Make reservation'}
              onPress={() => router.push({ pathname: '/(app)/reservations/new', params: { venueId: venue.id } })}
            />
            <TouchableOpacity
              onPress={() => router.push(`/(app)/venue/${venue.id}/review` as never)}
              style={styles.reviewBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.reviewBtnText}>{t ? 'Escribir reseña' : 'Write a review'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.actionBtnIconBox}>
        <Feather name={icon} size={18} color={Colors.accentPrimary} />
      </View>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary, gap: 10 },
  errorText: { color: Colors.textSecondary, fontSize: 14 },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  retryBtnText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  hero: { height: 200, backgroundColor: Colors.bgCard },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing[5], gap: Spacing[4] },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing[3] },
  venueName: { flex: 1, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeOpen: { backgroundColor: 'rgba(56,199,147,0.15)', borderColor: 'rgba(56,199,147,0.4)' },
  badgeClosed: { backgroundColor: Colors.bgElevated, borderColor: Colors.border },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { fontSize: 11, fontWeight: '700' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -Spacing[2] },
  ratingValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  ratingMeta: { color: Colors.textMuted, fontSize: Typography.fontSize.xs },

  description: { fontSize: Typography.fontSize.base, color: Colors.textSecondary, lineHeight: 22 },

  actionsRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing[3],
    borderRadius: Radius.button,
    alignItems: 'center',
    gap: 6,
  },
  actionBtnIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { color: Colors.textPrimary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semiBold },

  infoCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  infoText: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary, flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing[3],
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionLink: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '700' },

  offersEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  offersEmptyText: { color: Colors.textMuted, fontSize: 13 },

  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  offerIconBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.12)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  offerImg: { width: 44, height: 44 },
  offerTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  offerMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  eventCard: {
    width: 220,
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  eventImg: { width: '100%', height: 110 },
  eventImgPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,163,64,0.12)',
  },
  eventBody: { padding: 12, gap: 4 },
  eventDate: {
    color: Colors.accentPrimary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  eventTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 18 },

  bottomActions: {
    marginTop: Spacing[4],
    gap: Spacing[2],
  },
  reviewBtn: { alignItems: 'center', paddingVertical: Spacing[2] },
  reviewBtnText: { fontSize: Typography.fontSize.sm, color: Colors.accentPrimary, fontWeight: Typography.fontWeight.semiBold },
});
