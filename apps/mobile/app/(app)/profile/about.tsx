// ─────────────────────────────────────────────
//  About — Editorial Premium
//
//  Magazine layout:
//   · Wordmark "OPALBAR" + version meta as kicker
//   · Identity block (info ListItems): developed by, contact, website
//   · Actions list: check for updates (with spinner), terms, privacy
//   · Copyright caption at the foot
// ─────────────────────────────────────────────
import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  ListItem,
  Pressy,
} from '@/components/ui';
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

  async function openLegal(url: string) {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error('cannot open');
      await Linking.openURL(url);
    } catch {
      toast(t ? 'No se pudo abrir. Intenta más tarde.' : 'Could not open. Try again later.', 'danger');
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Wordmark ── */}
        <FadeIn style={styles.identity}>
          <Kicker tone="muted" align="center">
            {t ? 'ACERCA DE' : 'ABOUT'}
          </Kicker>
          <Display size="lg" align="center" style={{ marginTop: Spacing[3] }}>
            OPALBAR
          </Display>
          <Caption tone="muted" align="center" style={{ marginTop: Spacing[3] }}>
            {t ? 'VERSIÓN' : 'VERSION'} 1.0.0 · BUILD 2026-04
          </Caption>
        </FadeIn>

        {/* ── Identity rows ── */}
        <FadeIn delay={80} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'IDENTIDAD' : 'IDENTITY'}
          </Kicker>
          <View style={styles.listShell}>
            <ListItem title={t ? 'Desarrollado por' : 'Developed by'} meta="OpalBar Team" />
            <ListItem.Separator />
            <ListItem title={t ? 'Contacto' : 'Contact'} meta="hello@opalbar.app" />
            <ListItem.Separator />
            <ListItem title={t ? 'Sitio web' : 'Website'} meta="opalbar.app" />
          </View>
        </FadeIn>

        {/* ── Updates ── */}
        <FadeIn delay={140} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'APLICACIÓN' : 'APPLICATION'}
          </Kicker>
          <View style={styles.listShell}>
            <ListItem
              title={t ? 'Buscar actualizaciones' : 'Check for updates'}
              subtitle={t ? 'Comprueba si hay una versión nueva.' : 'Check for a newer version.'}
              leftIcon={
                <Feather name="download-cloud" size={18} color={Colors.accentPrimary} />
              }
              rightSlot={
                checking ? (
                  <ActivityIndicator size="small" color={Colors.accentPrimary} />
                ) : undefined
              }
              showChevron={!checking}
              onPress={onCheckUpdates}
              disabled={checking}
            />
          </View>
        </FadeIn>

        {/* ── Legal ── */}
        <FadeIn delay={200} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'LEGAL' : 'LEGAL'}
          </Kicker>
          <View style={styles.listShell}>
            <ListItem
              title={t ? 'Términos de servicio' : 'Terms of service'}
              leftIcon={<Feather name="file-text" size={18} color={Colors.textSecondary} />}
              onPress={() => openLegal(LEGAL_URLS.terms)}
              showChevron
            />
            <ListItem.Separator />
            <ListItem
              title={t ? 'Política de privacidad' : 'Privacy policy'}
              leftIcon={<Feather name="shield" size={18} color={Colors.textSecondary} />}
              onPress={() => openLegal(LEGAL_URLS.privacy)}
              showChevron
            />
          </View>
        </FadeIn>

        <FadeIn delay={260} style={styles.colophon}>
          <Hairline variant="subtle" />
          <Heading size="sm" align="center" style={{ marginTop: Spacing[6] }}>
            {t ? 'Hecho con cuidado.' : 'Made with care.'}
          </Heading>
          <Caption tone="muted" align="center" style={{ marginTop: Spacing[3] }}>
            © 2025 OpalBar. {t ? 'Todos los derechos reservados.' : 'All rights reserved.'}
          </Caption>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: Spacing[12],
  },
  identity: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[8],
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[6],
  },
  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  colophon: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    marginTop: Spacing[12],
  },
});
