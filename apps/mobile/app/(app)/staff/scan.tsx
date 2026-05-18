// ─────────────────────────────────────────────
//  Staff Scan — Editorial Premium
//
//  Camera logic preserved verbatim. UI overlay redone:
//   · Hairline frame (no thick amber rectangle)
//   · Kicker overline + Display headline above the frame
//   · Result panel uses <Sheet> with editorial typography
//   · Manual code modal swapped to <Modal> primitive
//   · Alerts replaced by toast() for non-critical confirmations
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { checkinApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Heading,
  Input,
  Kicker,
  Modal as PremiumModal,
  Pressy,
  Sheet,
} from '@/components/ui';
import { toast } from '@/components/Toast';

type ScanResult =
  | { kind: 'reservation'; data: any }
  | { kind: 'redemption'; data: any }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export default function StaffScan() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  async function resolveCode(code: string) {
    setResolving(true);
    try {
      try {
        const r = await checkinApi.lookupReservation(code);
        setResult({ kind: 'reservation', data: r.data?.data });
        return;
      } catch {}
      try {
        const r = await checkinApi.lookupRedemption(code);
        setResult({ kind: 'redemption', data: r.data?.data });
        return;
      } catch {}
      setResult({ kind: 'not_found' });
    } catch (err: any) {
      setResult({ kind: 'error', message: apiError(err) });
    } finally {
      setResolving(false);
    }
  }

  function onBarCodeScanned({ data }: { data: string }) {
    if (lockRef.current || scanned) return;
    lockRef.current = true;
    setScanned(true);
    resolveCode(data);
  }

  function reset() {
    lockRef.current = false;
    setScanned(false);
    setResult(null);
    setManualCode('');
  }

  async function confirm() {
    if (!result || (result.kind !== 'reservation' && result.kind !== 'redemption')) return;
    setConfirming(true);
    try {
      if (result.kind === 'reservation') {
        const r = await checkinApi.checkinReservation(result.data.confirmCode);
        const payload = r.data?.data;
        if (payload?.alreadySeated) {
          toast(
            t ? 'Cliente ya registrado como presente.' : 'Customer already seated.',
            'info',
          );
        } else {
          toast(
            t ? 'Entrada confirmada.' : 'Check-in confirmed.',
            'success',
          );
        }
      } else {
        const r = await checkinApi.checkinRedemption(result.data.code);
        const payload = r.data?.data;
        if (payload?.alreadyUsed) {
          toast(
            t ? 'Esta oferta ya se canjeó antes.' : 'Already redeemed.',
            'info',
          );
        } else {
          toast(
            t ? 'Canje validado.' : 'Redemption validated.',
            'success',
          );
        }
      }
      reset();
    } catch (err: any) {
      toast(apiError(err, t ? 'Error al confirmar.' : 'Confirmation failed.'), 'danger');
    } finally {
      setConfirming(false);
    }
  }

  // ── Permission gate ───────────────────────
  if (!permission) {
    return (
      <View style={styles.permRoot}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Header
          onBack={() => router.back()}
          onManual={() => setManualMode(true)}
          t={t}
        />
        <View style={styles.permBody}>
          <FadeIn>
            <View style={styles.permIconWrap}>
              <View style={styles.permIconFrame} />
              <Feather name="camera-off" size={28} color={Colors.textMuted} />
            </View>
          </FadeIn>
          <FadeIn delay={80}>
            <Heading size="sm" align="center" style={{ marginTop: Spacing[3] }}>
              {t ? 'Cámara desactivada' : 'Camera disabled'}
            </Heading>
          </FadeIn>
          <FadeIn delay={140}>
            <Body align="center" tone="secondary" style={styles.permMsg}>
              {t
                ? 'Necesitamos acceso a la cámara para escanear códigos QR.'
                : 'We need camera access to scan QR codes.'}
            </Body>
          </FadeIn>
          <FadeIn delay={210} style={styles.permActions}>
            <Button
              label={t ? 'Permitir cámara' : 'Allow camera'}
              onPress={requestPermission}
              variant="primary"
              fullWidth
            />
            <Button
              label={t ? 'Ingresar código manualmente' : 'Enter code manually'}
              onPress={() => setManualMode(true)}
              variant="ghost"
              fullWidth
              leftIcon={<Feather name="edit-3" size={14} color={Colors.accentPrimary} />}
            />
          </FadeIn>
        </View>
        <ManualEntry
          visible={manualMode}
          onClose={() => setManualMode(false)}
          code={manualCode}
          setCode={setManualCode}
          onSubmit={() => {
            setManualMode(false);
            resolveCode(manualCode.trim());
            setScanned(true);
            lockRef.current = true;
          }}
          t={t}
        />
      </SafeAreaView>
    );
  }

  // ── Active camera view ─────────────────────
  return (
    <View style={styles.cameraRoot}>
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarCodeScanned}
        />
      )}

      <View style={styles.cameraVignetteTop} />
      <View style={styles.cameraVignetteBottom} />

      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'bottom']}>
        <Header
          onBack={() => router.back()}
          onManual={() => setManualMode(true)}
          t={t}
          transparent
        />

        <View style={styles.cameraStage}>
          <Kicker tone="champagne" align="center">
            {t ? 'STAFF · ESCÁNER' : 'STAFF · SCANNER'}
          </Kicker>
          <Display align="center" style={{ marginTop: Spacing[3] }}>
            {scanned
              ? resolving
                ? t
                  ? 'Buscando…'
                  : 'Looking up…'
                : t
                  ? 'Listo'
                  : 'Ready'
              : t
                ? 'Apunta el QR'
                : 'Aim the QR'}
          </Display>

          <View style={styles.reticleWrap}>
            <View style={styles.reticle}>
              <CornerTL />
              <CornerTR />
              <CornerBL />
              <CornerBR />
            </View>
          </View>

          {resolving ? (
            <View style={styles.resolvingRow}>
              <ActivityIndicator color={Colors.accentChampagne} />
              <Caption tone="inverse" style={{ color: '#fff' }}>
                {t ? 'Validando código…' : 'Validating code…'}
              </Caption>
            </View>
          ) : (
            <Caption align="center" style={styles.hint}>
              {t
                ? 'Encuadra el código en el rectángulo.'
                : 'Frame the code inside the rectangle.'}
            </Caption>
          )}
        </View>
      </SafeAreaView>

      <ResultSheet
        visible={!!result}
        result={result}
        t={t}
        confirming={confirming}
        onConfirm={confirm}
        onCancel={reset}
      />

      <ManualEntry
        visible={manualMode}
        onClose={() => setManualMode(false)}
        code={manualCode}
        setCode={setManualCode}
        onSubmit={() => {
          setManualMode(false);
          resolveCode(manualCode.trim());
          setScanned(true);
          lockRef.current = true;
        }}
        t={t}
      />
    </View>
  );
}

// ── Header ───────────────────────────────────
function Header({
  onBack,
  onManual,
  t,
  transparent,
}: {
  onBack: () => void;
  onManual: () => void;
  t: boolean;
  transparent?: boolean;
}) {
  return (
    <View
      style={[
        styles.header,
        transparent ? styles.headerTransparent : null,
      ]}
    >
      <Pressy
        onPress={onBack}
        haptic="select"
        hitSlop={HitSlop.expand}
        accessibilityRole={Roles.button}
        accessibilityLabel="Volver"
        style={styles.headerBtn}
      >
        <Feather name="arrow-left" size={22} color={transparent ? '#fff' : Colors.textPrimary} />
      </Pressy>
      <View style={{ flex: 1 }}>
        <Kicker tone={transparent ? 'inverse' : 'muted'} style={transparent ? { color: '#fff' } : undefined}>
          {t ? 'STAFF' : 'STAFF'}
        </Kicker>
      </View>
      <Pressy
        onPress={onManual}
        haptic="select"
        hitSlop={HitSlop.expand}
        accessibilityRole={Roles.button}
        accessibilityLabel={t ? 'Código manual' : 'Manual code'}
        style={styles.headerBtn}
      >
        <Feather name="edit-3" size={20} color={transparent ? '#fff' : Colors.textPrimary} />
      </Pressy>
    </View>
  );
}

// ── Result sheet (Sheet primitive) ───────────
function ResultSheet({
  visible,
  result,
  t,
  confirming,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  result: ScanResult | null;
  t: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!result) return null;

  if (result.kind === 'not_found') {
    return (
      <Sheet open={visible} onClose={onCancel} title={t ? 'Sin coincidencias' : 'No match'}>
        <View style={styles.sheetBody}>
          <Body tone="secondary" align="center">
            {t
              ? 'No coincide con ninguna reserva ni canje.'
              : 'Does not match any reservation or redemption.'}
          </Body>
          <View style={{ marginTop: Spacing[5] }}>
            <Button
              label={t ? 'Escanear otro' : 'Scan another'}
              onPress={onCancel}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </Sheet>
    );
  }

  if (result.kind === 'error') {
    return (
      <Sheet open={visible} onClose={onCancel} title={t ? 'Error' : 'Error'}>
        <View style={styles.sheetBody}>
          <Body tone="secondary" align="center">
            {result.message}
          </Body>
          <View style={{ marginTop: Spacing[5] }}>
            <Button
              label={t ? 'Reintentar' : 'Try again'}
              onPress={onCancel}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </Sheet>
    );
  }

  const isReservation = result.kind === 'reservation';
  const d = result.data || {};
  const user = d.user;
  const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
  const isUsed = isReservation ? !!d.seatedAt : !!d.isUsed;

  return (
    <Sheet open={visible} onClose={onCancel}>
      <View style={styles.sheetBody}>
        <Kicker tone="champagne" align="center">
          {isReservation
            ? t
              ? 'RESERVA DE MESA'
              : 'TABLE RESERVATION'
            : t
              ? 'CANJE DE OFERTA'
              : 'OFFER REDEMPTION'}
        </Kicker>
        <Heading size="md" align="center" style={{ marginTop: Spacing[2] }}>
          {name}
        </Heading>

        <Hairline variant="subtle" style={{ marginVertical: Spacing[5] }} />

        <View style={{ gap: Spacing[3] }}>
          {isReservation ? (
            <>
              {d.date ? <MetaRow icon="calendar" label={new Date(d.date).toLocaleDateString()} /> : null}
              {d.timeSlot ? <MetaRow icon="clock" label={d.timeSlot} /> : null}
              {d.partySize ? (
                <MetaRow
                  icon="users"
                  label={`${d.partySize} ${t ? 'personas' : 'people'}`}
                />
              ) : null}
              {d.specialRequests ? (
                <MetaRow icon="file-text" label={d.specialRequests} />
              ) : null}
            </>
          ) : (
            <>
              {d.offer?.title ? <MetaRow icon="tag" label={d.offer.title} /> : null}
              {d.offer?.venue?.name ? (
                <MetaRow icon="home" label={d.offer.venue.name} />
              ) : null}
              {d.expiresAt ? (
                <MetaRow
                  icon="clock"
                  label={`${t ? 'Expira' : 'Expires'} · ${new Date(d.expiresAt).toLocaleString()}`}
                />
              ) : null}
            </>
          )}
        </View>

        {isUsed ? (
          <View style={styles.warnBlock}>
            <Feather name="alert-triangle" size={14} color={Colors.accentWarning} />
            <Caption tone="warning">
              {isReservation
                ? t
                  ? 'Ya fue marcado como presente'
                  : 'Already checked in'
                : t
                  ? 'Ya fue canjeado'
                  : 'Already redeemed'}
            </Caption>
          </View>
        ) : null}

        <View style={styles.sheetActions}>
          <View style={{ flex: 1 }}>
            <Button
              label={t ? 'Cancelar' : 'Cancel'}
              onPress={onCancel}
              variant="secondary"
              disabled={confirming}
              fullWidth
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button
              label={
                isReservation
                  ? t
                    ? 'Confirmar entrada'
                    : 'Confirm check-in'
                  : t
                    ? 'Marcar canjeado'
                    : 'Mark redeemed'
              }
              onPress={onConfirm}
              variant="primary"
              loading={confirming}
              disabled={isUsed}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

function MetaRow({ icon, label }: { icon: React.ComponentProps<typeof Feather>['name']; label: string }) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={14} color={Colors.textMuted} />
      <Body tone="primary" style={{ flex: 1 }}>
        {label}
      </Body>
    </View>
  );
}

// ── Manual code entry (Modal) ────────────────
function ManualEntry({
  visible,
  onClose,
  code,
  setCode,
  onSubmit,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  code: string;
  setCode: (s: string) => void;
  onSubmit: () => void;
  t: boolean;
}) {
  return (
    <PremiumModal open={visible} onClose={onClose} title={t ? 'Código manual' : 'Manual code'}>
      <View style={{ gap: Spacing[5] }}>
        <Body tone="secondary">
          {t
            ? 'Si el QR no se lee, escribe el código tal cual aparece.'
            : 'If the QR does not scan, type the code as it appears.'}
        </Body>
        <Input
          label={t ? 'CÓDIGO' : 'CODE'}
          placeholder={t ? 'Pega o escribe el código' : 'Paste or type the code'}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
        />
        <View style={{ flexDirection: 'row', gap: Spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t ? 'Cancelar' : 'Cancel'}
              onPress={onClose}
              variant="secondary"
              fullWidth
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button
              label={t ? 'Buscar' : 'Look up'}
              onPress={onSubmit}
              disabled={!code.trim()}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </View>
    </PremiumModal>
  );
}

// ── Reticle corners ──────────────────────────
function CornerTL() {
  return <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />;
}
function CornerTR() {
  return <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />;
}
function CornerBL() {
  return <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />;
}
function CornerBR() {
  return <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  permRoot: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  headerTransparent: {
    paddingTop: Spacing[2],
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },

  // Camera overlay
  cameraStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[5],
  },
  cameraVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cameraVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  reticleWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing[6],
  },
  reticle: {
    width: 260,
    height: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: Radius.sm,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: Colors.accentChampagne,
  },

  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    maxWidth: 280,
  },

  // Permission denied
  permBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    gap: Spacing[3],
  },
  permIconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  permIconFrame: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  permMsg: {
    maxWidth: 280,
    marginTop: Spacing[1],
  },
  permActions: {
    marginTop: Spacing[6],
    width: '100%',
    gap: Spacing[3],
  },

  // Sheet body
  sheetBody: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[5],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  warnBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    marginTop: Spacing[4],
    backgroundColor: 'rgba(217,163,93,0.10)',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,163,93,0.35)',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[6],
  },
});
