import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

export default function PushBroadcast() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'ADMINS'>('ALL');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Faltan datos', 'Título y mensaje son obligatorios.');
      return;
    }
    Alert.alert(
      'Enviar push',
      `¿Enviar este mensaje a ${audience === 'ALL' ? 'todos los usuarios' : 'admins y moderadores'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setSending(true);
            try {
              const r = await adminApi.sendBroadcast({ title: title.trim(), body: body.trim(), audience });
              const data = r.data?.data ?? r.data;
              Alert.alert(
                'Enviado',
                `${data?.sent ?? 0} notificaciones enviadas a ${data?.totalUsers ?? 0} usuarios.`,
              );
              setTitle('');
              setBody('');
            } catch (err) {
              Alert.alert('Error', apiError(err));
            } finally { setSending(false); }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Push Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AUDIENCIA</Text>
          <View style={styles.audRow}>
            <TouchableOpacity
              style={[styles.audBtn, audience === 'ALL' && styles.audBtnActive]}
              onPress={() => setAudience('ALL')}
              activeOpacity={0.85}
            >
              <Feather name="users" size={16} color={audience === 'ALL' ? Colors.textInverse : Colors.textSecondary} />
              <Text style={[styles.audLbl, audience === 'ALL' && styles.audLblActive]}>Todos los usuarios</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.audBtn, audience === 'ADMINS' && styles.audBtnActive]}
              onPress={() => setAudience('ADMINS')}
              activeOpacity={0.85}
            >
              <Feather name="shield" size={16} color={audience === 'ADMINS' ? Colors.textInverse : Colors.textSecondary} />
              <Text style={[styles.audLbl, audience === 'ADMINS' && styles.audLblActive]}>Solo staff</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Nuevo evento este viernes"
            placeholderTextColor={Colors.textMuted}
            maxLength={60}
          />
          <Text style={styles.charCount}>{title.length}/60</Text>

          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Mensaje *</Text>
          <TextInput
            style={[styles.input, { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            placeholder="Descripción corta del mensaje que verán los usuarios..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={160}
          />
          <Text style={styles.charCount}>{body.length}/160</Text>
        </View>

        {/* Preview */}
        <View style={styles.preview}>
          <Text style={styles.sectionLabel}>VISTA PREVIA</Text>
          <View style={styles.notif}>
            <View style={styles.notifIcon}>
              <Text style={styles.notifIconLetter}>O</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifApp}>OPALBAR</Text>
              <Text style={styles.notifTitle}>{title || 'Título del push'}</Text>
              <Text style={styles.notifBody}>{body || 'Mensaje que verán los usuarios...'}</Text>
            </View>
            <Text style={styles.notifTime}>ahora</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, sending && { opacity: 0.5 }]}
          onPress={send}
          disabled={sending || !title.trim() || !body.trim()}
          activeOpacity={0.85}
        >
          {sending
            ? <ActivityIndicator color={Colors.textInverse} />
            : <>
                <Feather name="send" size={16} color={Colors.textInverse} />
                <Text style={styles.sendLbl}>Enviar notificación</Text>
              </>}
        </TouchableOpacity>

        <View style={styles.warn}>
          <Feather name="alert-triangle" size={14} color={Colors.accentPrimary} />
          <Text style={styles.warnText}>
            Las notificaciones se envían vía Expo Push. Solo llegan a dispositivos con el app instalada y la sesión iniciada.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },

  audRow: { flexDirection: 'row', gap: 8 },
  audBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  audBtnActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  audLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  audLblActive: { color: Colors.textInverse },

  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  charCount: { color: Colors.textMuted, fontSize: 10, alignSelf: 'flex-end' },

  preview: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  notif: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
  },
  notifIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  notifIconLetter: { color: Colors.textInverse, fontWeight: '800', fontSize: 18 },
  notifApp: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  notifTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  notifBody: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  notifTime: { color: Colors.textMuted, fontSize: 10 },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
  },
  sendLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },

  warn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(244,163,64,0.1)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(244,163,64,0.3)',
  },
  warnText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 },
});
