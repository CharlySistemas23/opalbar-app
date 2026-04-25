// ─────────────────────────────────────────────
//  UpdateOverlay — full-screen modal shown while an OTA update is being
//  downloaded. Shows an animated progress bar (expo-updates doesn't expose
//  real download progress, so we ease toward 90% during download and snap
//  to 100% once isUpdatePending fires) and auto-reloads when ready.
//
//  Also exposes `checkForUpdateManual` for the Settings "Buscar
//  actualizaciones" button.
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Easing, Platform, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/tokens';
import { useAppStore } from '@/stores/app.store';

// Tuning: slow ramp toward 90% so the bar always has visible motion even on
// fast connections. The remaining 10% snaps when the bundle is actually ready.
const SOFT_CAP = 0.9;
const TIME_TO_SOFT_CAP_MS = 7000;

export function UpdateOverlay() {
  const { language } = useAppStore();
  const t = language === 'es';
  const { isDownloading, isUpdatePending, availableUpdate } = Updates.useUpdates();
  const [reloading, setReloading] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [pct, setPct] = useState(0);

  const visible = isDownloading || isUpdatePending || reloading;

  // Smooth fade-in + scale-in when the overlay first becomes visible.
  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, damping: 16, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, cardOpacity, cardScale]);

  // Soft ramp to 90% while the download is in flight.
  useEffect(() => {
    if (!isDownloading || isUpdatePending) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: SOFT_CAP,
      duration: TIME_TO_SOFT_CAP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [isDownloading, isUpdatePending, progress]);

  // Snap to 100% the moment the bundle is ready.
  useEffect(() => {
    if (!isUpdatePending && !reloading) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isUpdatePending, reloading, progress]);

  // Mirror progress.value into a percent string for the label.
  useEffect(() => {
    const id = progress.addListener(({ value }) => setPct(Math.round(value * 100)));
    return () => progress.removeListener(id);
  }, [progress]);

  // Soft accent pulse on the badge while downloading.
  useEffect(() => {
    if (!isDownloading || isUpdatePending) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isDownloading, isUpdatePending, pulse]);

  // Auto-reload once the bundle is committed. We listen via TWO paths:
  // (a) useUpdates().isUpdatePending and (b) the imperative Updates listener,
  // because in some setups the hook's flag doesn't flip until next render and
  // we want the reload to fire as soon as the bundle is actually ready.
  const reloadScheduledRef = useRef(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  const triggerReload = (delayMs = 900) => {
    if (reloadScheduledRef.current) return;
    reloadScheduledRef.current = true;
    setReloading(true);
    setReloadError(null);
    setTimeout(() => {
      Updates.reloadAsync().catch((err: any) => {
        reloadScheduledRef.current = false;
        setReloading(false);
        setReloadError(err?.message ?? 'reload failed');
      });
    }, delayMs);
  };

  useEffect(() => {
    if (isUpdatePending) triggerReload(900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpdatePending]);

  useEffect(() => {
    const sub = Updates.addListener((event) => {
      // Available in expo-updates: 'updateAvailable' fires once a fetched
      // bundle is ready to be loaded. Belt-and-braces with isUpdatePending.
      if (event.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
        triggerReload(900);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === 'web') return null;
  if (!visible) return null;

  const ready = isUpdatePending || reloading;
  const title = ready
    ? (t ? 'Actualización lista' : 'Update ready')
    : (t ? 'Descargando actualización' : 'Downloading update');
  const sub = ready
    ? (t ? 'Reiniciando en un momento…' : 'Restarting in a moment…')
    : (t ? 'No cierres la app — esto solo tomará unos segundos.' : 'Don\'t close the app — this only takes a few seconds.');

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <View style={styles.iconStack}>
            {!ready ? (
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                ]}
              />
            ) : null}
            <View style={[styles.iconWrap, ready && styles.iconWrapReady]}>
              <Feather
                name={ready ? 'check' : 'download-cloud'}
                size={28}
                color={ready ? Colors.accentSuccess : Colors.accentPrimary}
              />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>

          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: widthInterpolate, backgroundColor: ready ? Colors.accentSuccess : Colors.accentPrimary }]} />
          </View>
          <Text style={styles.pct}>{pct}%</Text>

          {availableUpdate?.createdAt ? (
            <Text style={styles.meta}>
              {t ? 'Versión' : 'Version'} {formatCreatedAt(availableUpdate.createdAt)}
            </Text>
          ) : null}

          {ready ? (
            <Pressable
              onPress={() => {
                reloadScheduledRef.current = false;
                triggerReload(0);
              }}
              style={({ pressed }) => [styles.reloadBtn, pressed && { opacity: 0.85 }]}
            >
              <Feather name="refresh-cw" size={14} color={Colors.textInverse} />
              <Text style={styles.reloadBtnText}>{t ? 'Reiniciar ahora' : 'Restart now'}</Text>
            </Pressable>
          ) : null}

          {reloadError ? (
            <Text style={styles.errText}>{reloadError}</Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function formatCreatedAt(d: Date | string | undefined) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

// Used by the "Buscar actualizaciones" button. Returns a short status so the
// caller can toast the result.
export type UpdateCheckResult =
  | { kind: 'none' }
  | { kind: 'downloading' } // UpdateOverlay will take over
  | { kind: 'error'; message: string };

export async function checkForUpdateManual(): Promise<UpdateCheckResult> {
  if (Platform.OS === 'web' || __DEV__) {
    return { kind: 'none' };
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { kind: 'none' };
    // fetchUpdateAsync will flip isDownloading true → UpdateOverlay renders.
    await Updates.fetchUpdateAsync();
    return { kind: 'downloading' };
  } catch (err: any) {
    return { kind: 'error', message: err?.message ?? 'Unknown error' };
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingVertical: Spacing[7],
    paddingHorizontal: Spacing[6],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    ...Shadows.lg,
  },
  iconStack: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  pulseRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.accentPrimary,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrapReady: {
    backgroundColor: Colors.accentSuccess + '14',
    borderColor: Colors.accentSuccess + '55',
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.serifSemiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: Typography.letterSpacing.tight,
    textAlign: 'center',
    marginBottom: Spacing[2],
  },
  sub: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.snug,
    marginBottom: Spacing[5],
  },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  pct: {
    marginTop: Spacing[2],
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.sm,
    letterSpacing: 0.5,
  },
  meta: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing[3],
  },
  reloadBtn: {
    marginTop: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
  },
  reloadBtnText: {
    color: Colors.textInverse,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.sm,
  },
  errText: {
    marginTop: Spacing[3],
    color: Colors.accentDanger,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
});
