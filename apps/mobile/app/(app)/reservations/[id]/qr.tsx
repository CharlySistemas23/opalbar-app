// ─────────────────────────────────────────────
//  Reservation QR — Editorial Premium
//
//  Fullscreen presentation page. Kicker (short code) + Display (venue
//  name) + QR centered in a hairline card + caption with date/time.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import {
  Body,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reservationsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';

export default function ReservationQR() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [code, setCode] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ venue?: string; date?: string; partySize?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    reservationsApi
      .detail(id)
      .then((r) => {
        const res = r.data?.data ?? r.data;
        setCode(res?.confirmCode ?? res?.code ?? null);
        setMeta({
          venue: res?.venue?.name,
          date: res?.date ?? res?.startTime,
          partySize: res?.partySize,
        });
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const dateStr = meta?.date
    ? new Date(meta.date).toLocaleString(language, {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const shortCode = (code || '').slice(-8).toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <Pressy
          onPress={() => router.back()}
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Cerrar' : 'Close'}
          hitSlop={HitSlop.expand}
          style={styles.closeBtn}
        >
          <Feather name="x" size={22} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: Spacing[5] }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="70%" height={36} />
            <Skeleton width="100%" height={280} radius={Radius.lg} />
          </View>
        ) : error ? (
          <View style={styles.errorBlock}>
            <Feather name="alert-circle" size={32} color={Colors.accentDanger} />
            <Body tone="secondary" align="center" style={{ marginTop: Spacing[3] }}>
              {error}
            </Body>
          </View>
        ) : !code ? (
          <Body tone="secondary" align="center">
            {t ? 'Esta reserva no tiene código.' : 'This reservation has no code.'}
          </Body>
        ) : (
          <View style={styles.card}>
            <FadeIn>
              <Kicker align="center" tone="champagne">
                {t ? `CÓDIGO · ${shortCode}` : `CODE · ${shortCode}`}
              </Kicker>
            </FadeIn>

            <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
              <Display size="md" align="center">
                {meta?.venue ?? (t ? 'Tu reserva' : 'Your booking')}
              </Display>
            </FadeIn>

            <FadeIn delay={160} style={styles.qrWrap}>
              <View style={styles.qrCanvas}>
                <QRCode value={code} size={240} backgroundColor="#FFFFFF" color="#0B0B0F" />
              </View>
            </FadeIn>

            {dateStr || meta?.partySize ? (
              <>
                <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />
                <FadeIn delay={240} style={styles.metaBlock}>
                  {dateStr ? (
                    <Caption tone="secondary" align="center">
                      {dateStr}
                    </Caption>
                  ) : null}
                  {meta?.partySize ? (
                    <Caption tone="muted" align="center" style={{ marginTop: Spacing[1] }}>
                      {`${meta.partySize} ${t ? 'personas' : 'guests'}`}
                    </Caption>
                  ) : null}
                </FadeIn>
                <Hairline variant="subtle" style={{ marginTop: Spacing[4] }} />
              </>
            ) : null}

            <FadeIn delay={320} style={{ marginTop: Spacing[6] }}>
              <Subhead tone="muted" align="center">
                {t ? 'Muestra este código al llegar' : 'Show this code at arrival'}
              </Subhead>
              <Caption tone="muted" align="center" style={{ marginTop: Spacing[2] }}>
                {t
                  ? 'Mantén la pantalla encendida. Puedes volver a esta reserva cuando quieras.'
                  : 'Keep your screen on. You can return to this reservation anytime.'}
              </Caption>
            </FadeIn>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerRow: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing[2],
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[8],
    justifyContent: 'center',
  },

  card: {
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[5],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
  },
  qrWrap: {
    marginTop: Spacing[6],
  },
  qrCanvas: {
    padding: Spacing[5],
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
  },

  metaBlock: {
    paddingVertical: Spacing[4],
  },

  errorBlock: {
    paddingVertical: Spacing[10],
    alignItems: 'center',
  },
});
