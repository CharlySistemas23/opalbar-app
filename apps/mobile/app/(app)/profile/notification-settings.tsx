// ─────────────────────────────────────────────
//  Notification Settings — Editorial Premium
//
//  Magazine-style settings:
//   · Kicker + Heading header
//   · Two grouped lists: PREFERENCIAS · FEEDBACK & SONIDO
//   · ListItem rows with title + subtitle + native Switch in rightSlot
//   · Optimistic toggle (auto-save). Failures revert + toast error.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

export default function NotificationSettings() {
  const router = useRouter();
  const {
    language,
    hapticsEnabled, setHapticsEnabled,
    soundsEnabled, setSoundsEnabled,
  } = useAppStore();
  const t = language === 'es';

  const [settings, setSettings] = useState({
    events: true,
    offers: true,
    community: false,
    reservations: true,
    marketing: false,
  });

  async function toggle(key: keyof typeof settings) {
    const previous = settings[key];
    const next = !previous;
    setSettings((prev) => ({ ...prev, [key]: next }));
    try {
      await usersApi.updateNotifications({ ...settings, [key]: next });
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, [key]: previous }));
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    }
  }

  const items: {
    key: keyof typeof settings;
    label: string;
    desc: string;
  }[] = [
    { key: 'events', label: t ? 'Eventos' : 'Events', desc: t ? 'Nuevos eventos y recordatorios.' : 'New events and reminders.' },
    { key: 'offers', label: t ? 'Ofertas' : 'Offers', desc: t ? 'Descuentos y promociones.' : 'Discounts and promotions.' },
    { key: 'community', label: t ? 'Comunidad' : 'Community', desc: t ? 'Comentarios y reacciones.' : 'Comments and reactions.' },
    { key: 'reservations', label: t ? 'Reservaciones' : 'Reservations', desc: t ? 'Estado de tus reservaciones.' : 'Your reservation status.' },
    { key: 'marketing', label: t ? 'Marketing' : 'Marketing', desc: t ? 'Novedades y noticias.' : 'News and updates.' },
  ];

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
            {t ? 'Notificaciones' : 'Notifications'}
          </Heading>
        </FadeIn>

        {/* ── Preferencias ── */}
        <FadeIn delay={80} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'PREFERENCIAS' : 'PREFERENCES'}
          </Kicker>
          <View style={styles.listShell}>
            {items.map((it, idx) => (
              <View key={it.key}>
                <ListItem
                  title={it.label}
                  subtitle={it.desc}
                  rightSlot={
                    <Switch
                      value={settings[it.key]}
                      onValueChange={() => toggle(it.key)}
                      trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                      thumbColor={Colors.textInverse}
                      accessibilityLabel={it.label}
                    />
                  }
                />
                {idx < items.length - 1 ? <ListItem.Separator /> : null}
              </View>
            ))}
          </View>
        </FadeIn>

        {/* ── Feedback ── */}
        <FadeIn delay={140} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'FEEDBACK Y SONIDO' : 'HAPTICS & SOUND'}
          </Kicker>
          <View style={styles.listShell}>
            <ListItem
              title={t ? 'Vibración' : 'Haptics'}
              subtitle={t ? 'Vibración al tocar, enviar, confirmar.' : 'Vibration on tap, send, confirm.'}
              rightSlot={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={setHapticsEnabled}
                  trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                  thumbColor={Colors.textInverse}
                  accessibilityLabel={t ? 'Vibración' : 'Haptics'}
                />
              }
            />
            <ListItem.Separator />
            <ListItem
              title={t ? 'Sonidos' : 'Sounds'}
              subtitle={t ? 'Sonidos de like, mensaje, canje.' : 'Sounds on like, message, redemption.'}
              rightSlot={
                <Switch
                  value={soundsEnabled}
                  onValueChange={setSoundsEnabled}
                  trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                  thumbColor={Colors.textInverse}
                  accessibilityLabel={t ? 'Sonidos' : 'Sounds'}
                />
              }
            />
          </View>
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
});
