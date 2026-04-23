// ─────────────────────────────────────────────
//  UpdateOverlay — full-screen modal shown while an OTA update is being
//  downloaded. Auto-reloads the app when the new bundle is ready so the user
//  never sees a stale UI next to a "ready" state.
//
//  Also exposes `checkForUpdateManual` for the Settings "Buscar
//  actualizaciones" button.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useAppStore } from '@/stores/app.store';

export function UpdateOverlay() {
  const { language } = useAppStore();
  const t = language === 'es';
  const { isDownloading, isUpdatePending, availableUpdate } = Updates.useUpdates();
  const [reloading, setReloading] = useState(false);

  // When a new bundle finishes downloading, expo-updates flips
  // isUpdatePending → true. Reload automatically so the user boots into the
  // fresh JS without needing to kill the app.
  useEffect(() => {
    if (!isUpdatePending || reloading) return;
    setReloading(true);
    // Short grace period so the "Listo, reiniciando…" state is visible.
    const timer = setTimeout(() => {
      Updates.reloadAsync().catch(() => setReloading(false));
    }, 800);
    return () => clearTimeout(timer);
  }, [isUpdatePending, reloading]);

  if (Platform.OS === 'web') return null;
  const visible = isDownloading || isUpdatePending || reloading;
  if (!visible) return null;

  const title = isUpdatePending || reloading
    ? (t ? 'Listo, reiniciando…' : 'Ready, reloading…')
    : (t ? 'Recibiendo actualización' : 'Receiving update');

  const sub = isUpdatePending || reloading
    ? (t ? 'La app se reiniciará en un momento.' : 'The app will restart in a moment.')
    : (t ? 'Estamos descargando la versión más reciente. No cierres la app.' : 'Downloading the latest version. Please don\'t close the app.');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isUpdatePending || reloading ? (
              <Feather name="check" size={26} color={Colors.accentSuccess} />
            ) : (
              <ActivityIndicator size="large" color={Colors.accentPrimary} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
          {availableUpdate?.createdAt ? (
            <Text style={styles.meta}>
              {t ? 'Versión' : 'Version'} {formatCreatedAt(availableUpdate.createdAt)}
            </Text>
          ) : null}
        </View>
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
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
});
