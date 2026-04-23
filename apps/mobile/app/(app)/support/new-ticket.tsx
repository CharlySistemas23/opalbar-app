import { View, Text, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing } from '@/constants/tokens';

export default function NewTicket() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useAppStore();
  const t = language === 'es';
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    try {
      // Backend DTO expects `initialMessage`, not `message` — was a silent bug.
      const res = await supportApi.createTicket({
        subject: subject.trim(),
        initialMessage: message.trim(),
      });
      const ticketId = res.data.data?.id;
      if (ticketId) router.replace(`/(app)/support/chat/${ticketId}`);
      else router.back();
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err, t ? 'No se pudo crear' : 'Could not create'));
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t ? 'Abrir ticket' : 'Open ticket'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{t ? 'Cuéntanos qué pasó' : 'Tell us what happened'}</Text>
            <Text style={styles.heroSub}>{t ? 'Te respondemos en menos de 24h.' : 'We reply in less than 24h.'}</Text>
          </View>
          <Input label={t ? 'Asunto' : 'Subject'} value={subject} onChangeText={setSubject} maxLength={120} />
          <Input
            label={t ? 'Descripción del problema' : 'Problem description'}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            style={{ height: 140, textAlignVertical: 'top' }}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <Button
            label={t ? 'Enviar ticket' : 'Submit ticket'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!subject.trim() || !message.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 30, fontWeight: Typography.fontWeight.extraBold, color: Colors.textPrimary, letterSpacing: -0.3 },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingVertical: Spacing[2], paddingBottom: Spacing[8] },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: Typography.fontWeight.extraBold,
    lineHeight: 34,
    letterSpacing: -0.35,
  },
  heroSub: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
  },
  footer: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgPrimary },
});
