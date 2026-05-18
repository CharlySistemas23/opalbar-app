// ─────────────────────────────────────────────
//  Preferences — Editorial Premium
//
//  Magazine layout: Kicker + Heading header, then grouped editorial
//  ListItem stacks split by kicker overlines: CUENTA · APP · SEGURIDAD ·
//  SOPORTE. Language picker opens an editorial Sheet via ConfirmDialog-
//  style Modal (existing <Modal>).
// ─────────────────────────────────────────────
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Modal as UIModal,
  Pressy,
} from '@/components/ui';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface MenuEntry {
  icon: FeatherIcon;
  label: { es: string; en: string };
  subtitle?: { es: string; en: string };
  path?: string;
  meta?: string;
  onPress?: () => void;
}

export default function Preferences() {
  const router = useRouter();
  const { language, setLanguage } = useAppStore();
  const t = language === 'es';
  const [langOpen, setLangOpen] = useState(false);

  const account: MenuEntry[] = [
    {
      icon: 'user',
      label: { es: 'Perfil', en: 'Profile' },
      subtitle: { es: 'Nombre, biografía, foto.', en: 'Name, bio, photo.' },
      path: '/(app)/profile/edit',
    },
    {
      icon: 'lock',
      label: { es: 'Cambiar contraseña', en: 'Change password' },
      subtitle: { es: 'Actualiza tus credenciales.', en: 'Update your credentials.' },
      path: '/(app)/profile/change-password',
    },
    {
      icon: 'monitor',
      label: { es: 'Sesiones activas', en: 'Active sessions' },
      subtitle: { es: 'Dispositivos conectados.', en: 'Connected devices.' },
      path: '/(app)/profile/sessions',
    },
  ];

  const app: MenuEntry[] = [
    {
      icon: 'globe',
      label: { es: 'Idioma', en: 'Language' },
      meta: t ? 'Español' : 'English',
      onPress: () => setLangOpen(true),
    },
    {
      icon: 'bell',
      label: { es: 'Notificaciones', en: 'Notifications' },
      subtitle: { es: 'Qué alertas quieres recibir.', en: 'Which alerts to receive.' },
      path: '/(app)/profile/notification-settings',
    },
  ];

  const security: MenuEntry[] = [
    {
      icon: 'shield',
      label: { es: 'Privacidad', en: 'Privacy' },
      subtitle: { es: 'Bloqueos y visibilidad.', en: 'Blocks and visibility.' },
      path: '/(app)/profile/privacy',
    },
    {
      icon: 'download',
      label: { es: 'Mis datos (GDPR)', en: 'My data (GDPR)' },
      subtitle: { es: 'Exportar o eliminar tu cuenta.', en: 'Export or delete your account.' },
      path: '/(app)/profile/gdpr',
    },
  ];

  const support: MenuEntry[] = [
    {
      icon: 'help-circle',
      label: { es: 'Centro de ayuda', en: 'Help center' },
      path: '/(app)/support',
    },
    {
      icon: 'info',
      label: { es: 'Acerca de OPALBAR', en: 'About OPALBAR' },
      subtitle: { es: 'Versión y términos.', en: 'Version and terms.' },
      path: '/(app)/profile/about',
    },
  ];

  function go(entry: MenuEntry) {
    if (entry.onPress) return entry.onPress();
    if (entry.path) router.push(entry.path as never);
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
        <FadeIn>
          <Kicker tone="muted">{t ? 'AJUSTES' : 'SETTINGS'}</Kicker>
          <Heading size="md" style={{ marginTop: Spacing[2] }}>
            {t ? 'Preferencias' : 'Preferences'}
          </Heading>
        </FadeIn>

        <Section
          kicker={t ? 'CUENTA' : 'ACCOUNT'}
          entries={account}
          language={language}
          onPress={go}
          delay={80}
        />
        <Section
          kicker={t ? 'APLICACIÓN' : 'APPLICATION'}
          entries={app}
          language={language}
          onPress={go}
          delay={140}
        />
        <Section
          kicker={t ? 'SEGURIDAD Y DATOS' : 'SECURITY & DATA'}
          entries={security}
          language={language}
          onPress={go}
          delay={200}
        />
        <Section
          kicker={t ? 'SOPORTE' : 'SUPPORT'}
          entries={support}
          language={language}
          onPress={go}
          delay={260}
        />
      </ScrollView>

      <UIModal
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title={t ? 'Idioma' : 'Language'}
      >
        <View style={{ gap: Spacing[2] }}>
          {(['es', 'en'] as const).map((lng) => {
            const active = language === lng;
            return (
              <Pressy
                key={lng}
                onPress={() => {
                  setLanguage(lng);
                  setLangOpen(false);
                }}
                haptic="select"
                accessibilityRole={Roles.button}
                accessibilityLabel={lng === 'es' ? 'Español' : 'English'}
                accessibilityState={{ selected: active }}
                style={[styles.langOption, active && styles.langOptionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Body weight="semiBold">{lng === 'es' ? 'Español' : 'English'}</Body>
                  <Body size="sm" tone="muted">
                    {lng === 'es' ? 'Idioma principal' : 'Secondary'}
                  </Body>
                </View>
                {active ? (
                  <Feather name="check" size={18} color={Colors.accentPrimary} />
                ) : null}
              </Pressy>
            );
          })}
        </View>
      </UIModal>
    </SafeAreaView>
  );
}

function Section({
  kicker,
  entries,
  language,
  onPress,
  delay,
}: {
  kicker: string;
  entries: MenuEntry[];
  language: 'es' | 'en';
  onPress: (e: MenuEntry) => void;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.section}>
      <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
        {kicker}
      </Kicker>
      <View style={styles.listShell}>
        {entries.map((entry, idx) => (
          <View key={entry.label.es}>
            <ListItem
              title={entry.label[language]}
              subtitle={entry.subtitle ? entry.subtitle[language] : undefined}
              meta={entry.meta}
              leftIcon={<Feather name={entry.icon} size={18} color={Colors.textSecondary} />}
              onPress={() => onPress(entry)}
              showChevron={!entry.meta}
            />
            {idx < entries.length - 1 ? <ListItem.Separator /> : null}
          </View>
        ))}
      </View>
    </FadeIn>
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
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[12],
  },
  section: {
    marginTop: Spacing[8],
  },
  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  langOptionActive: {
    borderColor: Colors.accentPrimary,
  },
});
