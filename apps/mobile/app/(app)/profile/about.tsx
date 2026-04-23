import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';
import { checkForUpdateManual } from '@/components/UpdateOverlay';
import { toast } from '@/components/Toast';

const LEGAL_URLS = {
  terms: 'https://opalbar.app/terms',
  privacy: 'https://opalbar.app/privacy',
};

export default function About() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [checking, setChecking] = useState(false);

  async function onCheckUpdates() {
    if (checking) return;
    setChecking(true);
    const res = await checkForUpdateManual();
    setChecking(false);
    if (res.kind === 'none') {
      toast(t ? 'Ya tienes la versión más reciente.' : 'You are on the latest version.', 'success');
    } else if (res.kind === 'error') {
      toast(t ? 'No se pudo comprobar. Intenta de nuevo.' : 'Check failed. Try again.', 'danger');
    }
    // 'downloading' → UpdateOverlay takes over and auto-reloads.
  }

  const openLegal = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error('cannot open');
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t ? 'No se pudo abrir' : 'Could not open',
        t ? 'Intenta más tarde.' : 'Please try again later.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Acerca de' : 'About'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>O</Text>
          </View>
          <Text style={styles.appName}>OPALBAR</Text>
          <Text style={styles.version}>{t ? 'Versión' : 'Version'} 1.0.0 · Build 2026-04</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t ? 'Desarrollado por' : 'Developed by'}</Text>
            <Text style={styles.rowValue}>OpalBar Team</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>{t ? 'Contacto' : 'Contact'}</Text>
            <Text style={styles.rowValue}>hello@opalbar.app</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>{t ? 'Sitio web' : 'Website'}</Text>
            <Text style={[styles.rowValue, { color: Colors.accentPrimary }]}>opalbar.app</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={onCheckUpdates} activeOpacity={0.85} disabled={checking}>
            <View style={styles.updateRow}>
              <Feather name="download-cloud" size={18} color={Colors.accentPrimary} />
              <Text style={styles.linkLabel}>{t ? 'Buscar actualizaciones' : 'Check for updates'}</Text>
            </View>
            {checking ? (
              <ActivityIndicator size="small" color={Colors.accentPrimary} />
            ) : (
              <Text style={styles.arrow}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={() => openLegal(LEGAL_URLS.terms)} activeOpacity={0.85}>
            <Text style={styles.linkLabel}>{t ? 'Términos de servicio' : 'Terms of service'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.rowBorder]} onPress={() => openLegal(LEGAL_URLS.privacy)} activeOpacity={0.85}>
            <Text style={styles.linkLabel}>{t ? 'Política de privacidad' : 'Privacy policy'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.copy}>© 2025 OpalBar. {t ? 'Todos los derechos reservados.' : 'All rights reserved.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingBottom: Spacing[8], alignItems: 'center' },
  logoWrap: { alignItems: 'center', paddingVertical: Spacing[6], gap: Spacing[2] },
  logo: { fontSize: 64 },
  logoBox: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: Colors.textInverse, fontSize: 44, fontWeight: '800' },
  appName: { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary, letterSpacing: 3 },
  version: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  card: { width: '100%', backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowLabel: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  rowValue: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  linkLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  arrow: { fontSize: 20, color: Colors.textDisabled },
  copy: { fontSize: Typography.fontSize.xs, color: Colors.textDisabled, textAlign: 'center' },
  updateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
});
