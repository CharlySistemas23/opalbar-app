// ─────────────────────────────────────────────
//  Offer Detail — Editorial Premium
//
//  Full-bleed hero image (16:10), kicker + Display title, lead paragraph,
//  numeric stat blocks separated by hairlines, an editorial terms card,
//  and a single primary CTA. QR rendered inside the editorial Modal.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Modal,
  Numeric,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { offersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';

const HERO_RATIO = 16 / 10;

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [redemption, setRedemption] = useState<any>(null);
  const [showQr, setShowQr] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    offersApi
      .get(id)
      .then((r) => setOffer(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRedeem() {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    if (redeemed && redemption) { setShowQr(true); return; }
    setBusy(true);
    try {
      const res = await offersApi.redeem(id);
      const data = res.data?.data;
      setRedemption(data);
      setRedeemed(true);
      setShowQr(true);
      fb.coin();
      await refreshUser();
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.headerBar}>
          <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} />
        </View>
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, gap: Spacing[5], marginTop: Spacing[6] }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={36} />
          <Skeleton width="100%" height={220} radius={Radius.lg} />
          <Skeleton width="100%" height={80} radius={Radius.lg} />
        </View>
      </SafeAreaView>
    );
  }
  if (!offer) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <Body tone="secondary">{t ? 'Oferta no encontrada' : 'Offer not found'}</Body>
      </SafeAreaView>
    );
  }

  const title = t ? offer.title : offer.titleEn || offer.title;
  const description = t ? offer.description : offer.descriptionEn || offer.description;
  const validUntil = offer.validUntil ? new Date(offer.validUntil) : null;
  const usesLeft = offer.maxRedemptions
    ? Math.max(0, offer.maxRedemptions - (offer.currentRedemptions ?? 0))
    : offer.usesLeft;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Hero ─────────────────────────────── */}
        <View style={styles.heroWrap}>
          {offer.imageUrl ? (
            <Pressable
              onPress={() => setPreviewVisible(true)}
              accessibilityRole={Roles.imagebutton}
              accessibilityLabel={t ? 'Ampliar imagen' : 'Zoom image'}
            >
              <Image
                source={{ uri: offer.imageUrl }}
                style={styles.heroImg}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          ) : (
            <View style={[styles.heroImg, styles.heroFallback]}>
              <Feather name="tag" size={56} color={Colors.accentChampagne} />
            </View>
          )}
          <View style={styles.heroHeader}>
            <BackBtn onPress={() => router.back()} label={t ? 'Volver' : 'Back'} overlay />
          </View>
        </View>

        {/* Body ─────────────────────────────── */}
        <View style={styles.body}>
          <FadeIn>
            <Kicker tone="champagne">{t ? 'OFERTA' : 'OFFER'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{title}</Display>
          </FadeIn>

          {description ? (
            <FadeIn delay={160} style={{ marginTop: Spacing[4] }}>
              <Body size="lg" tone="secondary">
                {description}
              </Body>
            </FadeIn>
          ) : null}

          {/* Stat strip ─────────────────────── */}
          <FadeIn delay={240} style={styles.statStrip}>
            {usesLeft !== undefined && usesLeft !== null ? (
              <StatBlock
                kicker={t ? 'DISPONIBLES' : 'AVAILABLE'}
                value={String(usesLeft)}
              />
            ) : null}
            {validUntil ? (
              <StatBlock
                kicker={t ? 'VÁLIDO HASTA' : 'VALID UNTIL'}
                value={validUntil.toLocaleDateString(language, { day: 'numeric', month: 'short' })}
              />
            ) : null}
            {offer.pointsCost ? (
              <StatBlock kicker={t ? 'PUNTOS' : 'POINTS'} value={String(offer.pointsCost)} />
            ) : null}
          </FadeIn>

          {/* Venue line ─────────────────────── */}
          {offer.venue?.name ? (
            <FadeIn delay={320} style={styles.venueRow}>
              <Feather name="map-pin" size={14} color={Colors.textMuted} />
              <Caption tone="secondary">{offer.venue.name}</Caption>
            </FadeIn>
          ) : null}

          {/* Terms ──────────────────────────── */}
          <FadeIn delay={380} style={{ marginTop: Spacing[8] }}>
            <Hairline variant="normal" />
            <View style={{ marginTop: Spacing[5] }}>
              <Kicker tone="muted">
                {t ? 'TÉRMINOS Y CONDICIONES' : 'TERMS AND CONDITIONS'}
              </Kicker>
              <Body tone="secondary" style={{ marginTop: Spacing[3] }}>
                {offer.terms ||
                  (t
                    ? '· No acumulable con otras promociones\n· Sujeto a disponibilidad\n· Presenta esta pantalla al staff'
                    : '· Cannot be combined with other promotions\n· Subject to availability\n· Show this screen to staff')}
              </Body>
            </View>
          </FadeIn>
        </View>
      </ScrollView>

      {/* Sticky CTA ─────────────────────────── */}
      <View style={styles.ctaWrap}>
        <Hairline variant="subtle" />
        <View style={styles.ctaInner}>
          <Button
            label={
              redeemed
                ? t ? 'Ver QR' : 'Show QR'
                : t ? 'Canjear oferta' : 'Redeem offer'
            }
            onPress={handleRedeem}
            loading={busy}
            disabled={busy}
            variant="primary"
            size="lg"
            fullWidth
            haptic={redeemed ? 'tap' : 'success'}
          />
        </View>
      </View>

      {/* Image preview ─────────────────────── */}
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
            haptic="select"
            style={styles.previewClose}
          >
            <Feather name="x" size={20} color={Colors.textPrimary} />
          </Pressy>
          <Image source={{ uri: offer.imageUrl }} style={styles.previewImage} resizeMode="contain" />
        </View>
      </RNModal>

      {/* QR Modal ─────────────────────────── */}
      <Modal
        open={showQr}
        onClose={() => setShowQr(false)}
        title={t ? 'Oferta canjeada' : 'Offer redeemed'}
        size="md"
      >
        <View style={{ alignItems: 'center', gap: Spacing[4] }}>
          <Kicker tone="champagne">{t ? 'PRESENTA AL STAFF' : 'SHOW TO STAFF'}</Kicker>
          <Subhead align="center">{title}</Subhead>
          {redemption?.code ? (
            <>
              <View style={styles.qrBox}>
                <QRCode value={redemption.code} size={200} backgroundColor="#FFFFFF" color="#100E0C" />
              </View>
              <Body weight="semiBold" style={styles.qrCode}>
                {redemption.code.slice(-8).toUpperCase()}
              </Body>
            </>
          ) : null}
          {redemption?.expiresAt ? (
            <Caption tone="muted" align="center">
              {t ? 'Expira: ' : 'Expires: '}
              {new Date(redemption.expiresAt).toLocaleString(language, {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Caption>
          ) : null}
        </View>
      </Modal>
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
  heroFallback: {
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeader: {
    position: 'absolute',
    top: Spacing[2],
    left: EditorialSpacing.pageGutter,
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

  body: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[8],
  },

  statStrip: {
    marginTop: Spacing[8],
    flexDirection: 'row',
    gap: Spacing[4],
  },
  statBlock: {
    flex: 1,
  },

  venueRow: {
    marginTop: Spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
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

  qrBox: {
    padding: Spacing[4],
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
  },
  qrCode: {
    letterSpacing: 4,
  },
});

void Heading;
