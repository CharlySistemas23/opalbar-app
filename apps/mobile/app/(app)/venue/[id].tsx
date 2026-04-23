import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { venueApi, reviewsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

/**
 * Open native maps for the venue. iOS prefers Apple Maps (with labeled pin);
 * falls back to Google Maps (which Android handles natively).
 *
 * We pass the venue NAME as the query + coords so the pin shows "OPALBAR" rather
 * than raw coordinates.
 */
async function openDirections(venue: { lat?: number | string | null; lng?: number | string | null; address?: string | null; name?: string }) {
  const lat = venue.lat != null ? Number(venue.lat) : null;
  const lng = venue.lng != null ? Number(venue.lng) : null;
  const name = venue.name ?? 'OPALBAR';
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords && !venue.address) {
    Alert.alert('Sin ubicación', 'Este lugar aún no tiene ubicación registrada.');
    return;
  }

  // iOS → Apple Maps with labeled pin
  if (Platform.OS === 'ios') {
    const appleUrl = hasCoords
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`
      : `http://maps.apple.com/?q=${encodeURIComponent(`${name} ${venue.address ?? ''}`)}`;
    const canOpen = await Linking.canOpenURL(appleUrl).catch(() => false);
    if (canOpen) return Linking.openURL(appleUrl);
  }

  // Google Maps — search by name+address+coords so pin shows the venue name.
  // Format `query=NAME&center=LAT,LNG` or `query=LAT,LNG(NAME)` both work.
  const query = hasCoords && venue.address
    ? `${name}, ${venue.address}`
    : hasCoords
      ? `${lat},${lng}(${name})`
      : `${name} ${venue.address}`;

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return Linking.openURL(url);
}

async function callVenue(phone?: string | null) {
  if (!phone) return;
  const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
  const can = await Linking.canOpenURL(url).catch(() => false);
  if (can) Linking.openURL(url);
}

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const insets = useSafeAreaInsets();
  const [venue, setVenue] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      venueApi.get(id),
      reviewsApi.venueSummary(id),
    ]).then(([vRes, rRes]) => {
      setVenue(vRes.data.data);
      setSummary(rRes.data.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!venue) return <View style={styles.center}><Text style={styles.notFound}>{t ? 'Venue no encontrado' : 'Venue not found'}</Text></View>;

  const rating = Number(venue.ratingAvg ?? summary?.averageRating ?? 0);
  const reviewCount = Number(venue.ratingCount ?? summary?.totalReviews ?? 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
      >
        {/* Hero image / cover (or tint placeholder matching the app) */}
        <View style={styles.hero}>
          {venue.coverUrl || venue.imageUrl ? (
            <Image source={{ uri: venue.coverUrl || venue.imageUrl }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Feather name="image" size={32} color={Colors.textMuted} />
            </View>
          )}
          <TouchableOpacity style={styles.backFloat} onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title + open badge */}
          <View style={styles.titleRow}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <View style={[styles.badge, venue.isActive ? styles.badgeOpen : styles.badgeClosed]}>
              <View style={[styles.badgeDot, { backgroundColor: venue.isActive ? Colors.accentSuccess : Colors.textMuted }]} />
              <Text style={[styles.badgeLabel, { color: venue.isActive ? Colors.accentSuccess : Colors.textMuted }]}>
                {venue.isActive ? (t ? 'Abierto' : 'Open') : (t ? 'Cerrado' : 'Closed')}
              </Text>
            </View>
          </View>

          {/* Rating row */}
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

          {/* Quick action tiles — consistent with app's card style */}
          <View style={styles.actionsRow}>
            <ActionTile icon="navigation" label={t ? 'Cómo llegar' : 'Directions'} onPress={() => openDirections(venue)} />
            {venue.phone ? (
              <ActionTile icon="phone" label={t ? 'Llamar' : 'Call'} onPress={() => callVenue(venue.phone)} />
            ) : null}
            {venue.website ? (
              <ActionTile icon="globe" label={t ? 'Sitio' : 'Website'} onPress={() => Linking.openURL(venue.website).catch(() => {})} />
            ) : null}
          </View>

          {/* Info card (address, hours, phone) */}
          <View style={styles.infoCard}>
            {venue.address ? (
              <TouchableOpacity style={styles.infoRow} onPress={() => openDirections(venue)} activeOpacity={0.7}>
                <Feather name="map-pin" size={16} color={Colors.accentPrimary} />
                <Text style={[styles.infoText, styles.infoLink]} numberOfLines={2}>{venue.address}</Text>
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
                <Text style={[styles.infoText, styles.infoLink]}>{venue.phone}</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTAs — respect home indicator */}
      <View style={[styles.cta, { paddingBottom: 12 + insets.bottom }]}>
        <Button label={t ? 'Hacer reservación' : 'Make reservation'} onPress={() => router.push({ pathname: '/(app)/reservations/new', params: { venueId: id } })} />
        <TouchableOpacity onPress={() => router.push(`/(app)/venue/${id}/review`)} style={styles.reviewBtn}>
          <Text style={styles.reviewBtnText}>{t ? 'Escribir reseña' : 'Write a review'}</Text>
        </TouchableOpacity>
      </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  notFound: { color: Colors.textSecondary },

  hero: { height: 220, backgroundColor: Colors.bgCard, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backFloat: {
    position: 'absolute', top: 12, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

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
  infoLink: { color: Colors.textPrimary },

  cta: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing[2],
  },
  reviewBtn: { alignItems: 'center', paddingVertical: Spacing[2] },
  reviewBtnText: { fontSize: Typography.fontSize.base, color: Colors.accentPrimary, fontWeight: Typography.fontWeight.semiBold },
});
