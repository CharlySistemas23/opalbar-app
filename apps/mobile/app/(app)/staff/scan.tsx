import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { checkinApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

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
    } finally { setResolving(false); }
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
          Alert.alert(t ? 'Ya registrado' : 'Already seated', t ? 'Este cliente ya fue marcado como presente.' : 'This customer was already marked as seated.');
        } else {
          Alert.alert(t ? 'Entrada confirmada' : 'Check-in confirmed', t ? 'Cliente registrado como presente.' : 'Customer marked as seated.');
        }
      } else {
        const r = await checkinApi.checkinRedemption(result.data.code);
        const payload = r.data?.data;
        if (payload?.alreadyUsed) {
          Alert.alert(t ? 'Ya canjeado' : 'Already used', t ? 'Esta oferta ya se canjeó antes.' : 'This offer was already redeemed.');
        } else {
          Alert.alert(t ? 'Canje validado' : 'Redemption validated', t ? 'Oferta marcada como usada.' : 'Offer marked as used.');
        }
      }
      reset();
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally { setConfirming(false); }
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t ? 'Escanear QR' : 'Scan QR'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Feather name="camera-off" size={48} color={Colors.textMuted} />
          <Text style={styles.permMsg}>
            {t ? 'Necesitamos acceso a la cámara para escanear códigos QR.' : 'We need camera access to scan QR codes.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnLbl}>{t ? 'Permitir cámara' : 'Allow camera'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(true)}>
            <Feather name="keyboard" size={16} color={Colors.accentPrimary} />
            <Text style={styles.secondaryBtnLbl}>{t ? 'Ingresar código manualmente' : 'Enter code manually'}</Text>
          </TouchableOpacity>
        </View>
        <ManualModal
          visible={manualMode}
          onClose={() => setManualMode(false)}
          code={manualCode}
          setCode={setManualCode}
          onSubmit={() => { setManualMode(false); resolveCode(manualCode.trim()); setScanned(true); lockRef.current = true; }}
          t={t}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Escanear QR' : 'Scan QR'}</Text>
        <TouchableOpacity onPress={() => setManualMode(true)} style={styles.iconBtn} hitSlop={10}>
          <Feather name="keyboard" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.scanWrap}>
        {!scanned && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarCodeScanned}
          />
        )}
        <View style={styles.overlay}>
          <View style={styles.reticle} />
          <Text style={styles.hint}>
            {scanned
              ? (resolving ? (t ? 'Buscando código…' : 'Looking up code…') : '')
              : (t ? 'Apunta la cámara al código QR' : 'Point camera at the QR code')}
          </Text>
        </View>
      </View>

      {result && (
        <ResultSheet
          result={result}
          t={t}
          confirming={confirming}
          onConfirm={confirm}
          onCancel={reset}
        />
      )}

      <ManualModal
        visible={manualMode}
        onClose={() => setManualMode(false)}
        code={manualCode}
        setCode={setManualCode}
        onSubmit={() => { setManualMode(false); resolveCode(manualCode.trim()); setScanned(true); lockRef.current = true; }}
        t={t}
      />
    </SafeAreaView>
  );
}

function ResultSheet({ result, t, confirming, onConfirm, onCancel }: any) {
  if (result.kind === 'not_found') {
    return (
      <View style={styles.sheet}>
        <View style={[styles.sheetBadge, { backgroundColor: 'rgba(228,88,88,0.15)' }]}>
          <Feather name="x-circle" size={24} color={Colors.accentDanger} />
        </View>
        <Text style={styles.sheetTitle}>{t ? 'Código no encontrado' : 'Code not found'}</Text>
        <Text style={styles.sheetSub}>{t ? 'No coincide con ninguna reserva ni canje.' : 'Does not match any reservation or redemption.'}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onCancel}>
          <Text style={styles.primaryBtnLbl}>{t ? 'Escanear otro' : 'Scan another'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (result.kind === 'error') {
    return (
      <View style={styles.sheet}>
        <View style={[styles.sheetBadge, { backgroundColor: 'rgba(228,88,88,0.15)' }]}>
          <Feather name="alert-triangle" size={24} color={Colors.accentDanger} />
        </View>
        <Text style={styles.sheetTitle}>{t ? 'Error' : 'Error'}</Text>
        <Text style={styles.sheetSub}>{result.message}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onCancel}>
          <Text style={styles.primaryBtnLbl}>{t ? 'Reintentar' : 'Try again'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isReservation = result.kind === 'reservation';
  const d = result.data || {};
  const user = d.user;
  const name = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
  const isUsed = isReservation ? !!d.seatedAt : !!d.isUsed;

  return (
    <View style={styles.sheet}>
      <View style={[styles.sheetBadge, { backgroundColor: isUsed ? 'rgba(244,163,64,0.15)' : 'rgba(56,199,147,0.15)' }]}>
        <Feather name={isUsed ? 'alert-circle' : 'check-circle'} size={24} color={isUsed ? Colors.accentPrimary : Colors.accentSuccess} />
      </View>
      <Text style={styles.sheetKind}>
        {isReservation
          ? (t ? 'RESERVA DE MESA' : 'TABLE RESERVATION')
          : (t ? 'CANJE DE OFERTA' : 'OFFER REDEMPTION')}
      </Text>
      <Text style={styles.sheetTitle}>{name}</Text>
      <View style={styles.sheetMeta}>
        {isReservation ? (
          <>
            <Row icon="calendar" label={new Date(d.date).toLocaleDateString()} />
            <Row icon="clock" label={d.timeSlot} />
            <Row icon="users" label={`${d.partySize} ${t ? 'personas' : 'people'}`} />
            {d.specialRequests ? <Row icon="file-text" label={d.specialRequests} /> : null}
          </>
        ) : (
          <>
            <Row icon="tag" label={d.offer?.title || ''} />
            <Row icon="home" label={d.offer?.venue?.name || ''} />
            {d.expiresAt ? <Row icon="clock" label={`${t ? 'Expira: ' : 'Expires: '}${new Date(d.expiresAt).toLocaleString()}`} /> : null}
          </>
        )}
      </View>
      {isUsed && (
        <View style={styles.warnRow}>
          <Feather name="alert-triangle" size={14} color={Colors.accentPrimary} />
          <Text style={styles.warnText}>
            {isReservation
              ? (t ? 'Ya fue marcado como presente' : 'Already checked in')
              : (t ? 'Ya fue canjeado' : 'Already redeemed')}
          </Text>
        </View>
      )}
      <View style={styles.sheetActions}>
        <TouchableOpacity style={styles.sheetCancel} onPress={onCancel} disabled={confirming}>
          <Text style={styles.sheetCancelLbl}>{t ? 'Cancelar' : 'Cancel'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetConfirm} onPress={onConfirm} disabled={confirming || isUsed}>
          {confirming
            ? <ActivityIndicator color={Colors.textInverse} size="small" />
            : <Text style={styles.sheetConfirmLbl}>
                {isReservation ? (t ? 'Confirmar entrada' : 'Confirm check-in') : (t ? 'Marcar canjeado' : 'Mark redeemed')}
              </Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.rowLbl}>{label}</Text>
    </View>
  );
}

function ManualModal({ visible, onClose, code, setCode, onSubmit, t }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t ? 'Código manual' : 'Manual code'}</Text>
          <TextInput
            style={styles.manualInput}
            value={code}
            onChangeText={setCode}
            placeholder={t ? 'Pega o escribe el código' : 'Paste or type the code'}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
              <Text style={styles.sheetCancelLbl}>{t ? 'Cancelar' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetConfirm, (!code.trim()) && { opacity: 0.5 }]} onPress={onSubmit} disabled={!code.trim()}>
              <Text style={styles.sheetConfirmLbl}>{t ? 'Buscar' : 'Look up'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  permMsg: { color: Colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 },

  scanWrap: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  reticle: {
    width: 260, height: 260,
    borderWidth: 3,
    borderColor: Colors.accentPrimary,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  hint: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40 },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    gap: 10,
    alignItems: 'center',
    borderTopWidth: 1, borderColor: Colors.border,
  },
  sheetBadge: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetKind: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  sheetSub: { color: Colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  sheetMeta: { width: '100%', gap: 6, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLbl: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  warnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(244,163,64,0.12)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 4,
  },
  warnText: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '700' },

  sheetActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  sheetCancel: {
    flex: 1, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  sheetCancelLbl: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  sheetConfirm: {
    flex: 1.5, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
  },
  sheetConfirmLbl: { color: Colors.textInverse, fontWeight: '800', fontSize: 14 },

  primaryBtn: {
    paddingHorizontal: 24, paddingVertical: 14,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  primaryBtnLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  secondaryBtnLbl: { color: Colors.accentPrimary, fontSize: 14, fontWeight: '600' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: 20, padding: 20, gap: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  manualInput: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 16, fontFamily: 'monospace', letterSpacing: 2,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
