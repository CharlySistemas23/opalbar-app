import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { offersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, Radius } from '@/constants/tokens';

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
    return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  }
  if (!offer) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t ? 'Oferta no encontrada' : 'Offer not found'}</Text>
      </View>
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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Hero image or icon */}
        {offer.imageUrl ? (
          <View style={styles.heroImgWrapper}>
            <TouchableOpacity activeOpacity={0.95} onPress={() => setPreviewVisible(true)}>
              <Image
                source={{ uri: offer.imageUrl }}
                style={styles.heroImg}
                resizeMode="cover"
              />
            </TouchableOpacity>
            {/* Back button as overlay on image */}
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtnOverlay} hitSlop={10}>
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {/* Zoom hint */}
            <TouchableOpacity style={styles.previewHint} onPress={() => setPreviewVisible(true)} activeOpacity={0.8}>
              <Feather name="maximize-2" size={12} color={Colors.textPrimary} />
              <Text style={styles.previewHintText}>{t ? 'Toca para ampliar' : 'Tap to zoom'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
                <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.heroBox}>
              <View style={styles.heroIcon}>
                <Feather name="tag" size={52} color={Colors.accentPrimary} />
              </View>
            </View>
          </>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>

          {description ? <Text style={styles.description}>{description}</Text> : null}

          {/* Info cards */}
          <View style={styles.cardsRow}>
            {usesLeft !== undefined && usesLeft !== null && (
              <View style={styles.card}>
                <Feather name="check-circle" size={18} color={Colors.accentSuccess} />
                <Text style={styles.cardValue}>{usesLeft}</Text>
                <Text style={styles.cardLabel}>{t ? 'Disponibles' : 'Available'}</Text>
              </View>
            )}
            {validUntil && (
              <View style={styles.card}>
                <Feather name="clock" size={18} color={Colors.accentPrimary} />
                <Text style={styles.cardValue} numberOfLines={1}>
                  {validUntil.toLocaleDateString(language, { day: 'numeric', month: 'short' })}
                </Text>
                <Text style={styles.cardLabel}>{t ? 'Válido hasta' : 'Valid until'}</Text>
              </View>
            )}
            {offer.pointsCost ? (
              <View style={styles.card}>
                <Feather name="star" size={18} color={Colors.accentPrimary} />
                <Text style={styles.cardValue}>{offer.pointsCost}</Text>
                <Text style={styles.cardLabel}>{t ? 'Puntos' : 'Points'}</Text>
              </View>
            ) : null}
          </View>

          {/* Venue */}
          {offer.venue?.name && (
            <View style={styles.venueRow}>
              <Feather name="map-pin" size={16} color={Colors.textSecondary} />
              <Text style={styles.venueText}>{offer.venue.name}</Text>
            </View>
          )}

          {/* Terms */}
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>
              {t ? 'Términos y condiciones' : 'Terms and conditions'}
            </Text>
            <Text style={styles.termsText}>
              {offer.terms ||
                (t
                  ? '• No acumulable con otras promociones\n• Sujeto a disponibilidad\n• Presenta esta pantalla al personal'
                  : '• Cannot be combined with other promotions\n• Subject to availability\n• Show this screen to staff')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, (redeemed || busy) && { opacity: redeemed ? 0.7 : 0.6 }]}
          onPress={handleRedeem}
          disabled={busy || redeemed}
          activeOpacity={0.9}
        >
          {busy
            ? <ActivityIndicator color={Colors.textInverse} />
            : <>
                <Feather
                  name={redeemed ? 'check' : 'gift'}
                  size={18}
                  color={Colors.textInverse}
                />
                <Text style={styles.ctaLabel}>
                  {redeemed ? (t ? 'Ver QR' : 'Show QR') : (t ? 'Canjear oferta' : 'Redeem offer')}
                </Text>
              </>
          }
        </TouchableOpacity>
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
          <Image source={{ uri: offer.imageUrl }} style={styles.previewImage} resizeMode="contain" />
        </View>
      </Modal>

      <Modal
        visible={showQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQr(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowQr(false)} hitSlop={10}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.successBadge}>
              <Feather name="check-circle" size={20} color={Colors.accentSuccess} />
              <Text style={styles.successText}>{t ? '¡Oferta canjeada!' : 'Offer redeemed!'}</Text>
            </View>

            <Text style={styles.modalTitle} numberOfLines={2}>{title}</Text>

            {redemption?.code ? (
              <>
                <View style={styles.qrBox}>
                  <QRCode value={redemption.code} size={220} backgroundColor="#FFFFFF" color="#0D0D0F" />
                </View>
                <Text style={styles.qrCode}>{redemption.code.slice(-8).toUpperCase()}</Text>
              </>
            ) : null}

            <Text style={styles.modalHint}>
              {t
                ? 'Muestra este QR al staff para canjear tu oferta.'
                : 'Show this QR to staff to redeem your offer.'}
            </Text>

            {redemption?.expiresAt && (
              <Text style={styles.expiresText}>
                {t ? 'Expira: ' : 'Expires: '}
                {new Date(redemption.expiresAt).toLocaleString(language, {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  notFound: { color: Colors.textSecondary },

  headerBar: { paddingHorizontal: 20, paddingTop: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  iconBtnOverlay: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroImgWrapper: {
    position: 'relative',
    width: '100%',
  },

  heroBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroImg: {
    width: '100%',
    height: 260,
  },
  heroIcon: {
    width: 128, height: 128, borderRadius: 28,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  content: { paddingHorizontal: 20, gap: 14 },

  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },

  cardsRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  cardValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  cardLabel: { color: Colors.textMuted, fontSize: 11 },

  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  venueText: { color: Colors.textSecondary, fontSize: 14 },

  termsBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginTop: 6,
  },
  termsTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  termsText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },

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
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  ctaLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: {
    width: '100%',
    height: '80%',
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalClose: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(56,199,147,0.12)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  successText: { color: Colors.accentSuccess, fontSize: 13, fontWeight: '700' },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  qrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  qrCode: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalHint: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  expiresText: { color: Colors.textMuted, fontSize: 12 },
});
