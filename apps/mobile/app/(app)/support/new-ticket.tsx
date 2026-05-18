// ─────────────────────────────────────────────
//  New Ticket — Editorial Premium
//
//  Magazine layout for opening a support ticket:
//   · Header: back + Kicker "AYUDA" + Heading "Abrir ticket"
//   · Hero: Display headline + Lead subtitle
//   · Form: subject + body (Input + Input multiline) — primary submit pinned
// ─────────────────────────────────────────────
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  FadeIn,
  Hairline,
  Heading,
  Input,
  Kicker,
  Lead,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

export default function NewTicket() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useAppStore();
  const t = language === 'es';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await supportApi.createTicket({
        subject: subject.trim(),
        initialMessage: message.trim(),
      });
      const ticketId = res.data?.data?.id;
      if (ticketId) router.replace(`/(app)/support/chat/${ticketId}`);
      else router.back();
    } catch (err: any) {
      toast(
        apiError(err, t ? 'No se pudo crear el ticket.' : 'Could not create ticket.'),
        'danger',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressy
            onPress={() => router.back()}
            haptic="select"
            hitSlop={HitSlop.expand}
            accessibilityRole={Roles.button}
            accessibilityLabel="Volver"
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressy>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted">{t ? 'AYUDA' : 'HELP'}</Kicker>
            <Heading size="md" style={{ marginTop: Spacing[1] }}>
              {t ? 'Abrir ticket' : 'Open ticket'}
            </Heading>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'CUÉNTANOS' : 'TELL US'}</Kicker>
            <Heading size="lg" style={{ marginTop: Spacing[2] }}>
              {t ? '¿Qué ocurre?' : 'What happened?'}
            </Heading>
            <Lead style={{ marginTop: Spacing[3] }}>
              {t
                ? 'Te responderemos en menos de 24 horas. Sé tan específico como puedas — captura cualquier detalle relevante.'
                : 'We will reply within 24 hours. Be as specific as you can — capture any relevant detail.'}
            </Lead>
          </FadeIn>

          <FadeIn delay={120} style={{ marginTop: Spacing[8], gap: Spacing[5] }}>
            <Input
              label={t ? 'ASUNTO' : 'SUBJECT'}
              placeholder={t ? 'Breve resumen del problema' : 'Short summary of the issue'}
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              required
            />
            <Input
              label={t ? 'DESCRIPCIÓN' : 'DESCRIPTION'}
              placeholder={t ? 'Explica con detalle qué pasó' : 'Explain in detail what happened'}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              style={{ minHeight: 140, textAlignVertical: 'top' }}
              required
            />
          </FadeIn>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[3] }]}>
          <Hairline variant="subtle" />
          <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
            <Button
              label={t ? 'Enviar ticket' : 'Submit ticket'}
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
              variant="primary"
              size="md"
              fullWidth
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: Spacing[5],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },

  content: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
  },

  footer: {
    backgroundColor: Colors.bgPrimary,
  },
});
