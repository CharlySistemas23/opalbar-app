import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

export default function Gdpr() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const CONFIRM_WORD = t ? 'ELIMINAR' : 'DELETE';

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await usersApi.exportData();
      fb.success();
      Alert.alert(
        t ? 'Solicitud recibida' : 'Request received',
        t
          ? `Te enviaremos un email a ${user?.email ?? 'tu cuenta'} con tus datos en un archivo ZIP dentro de 72 h.`
          : `We'll email a ZIP with your data to ${user?.email ?? 'your account'} within 72 h.`,
      );
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setExporting(false);
    }
  }

  async function doDelete() {
    if (deleteConfirm !== CONFIRM_WORD) return;
    setDeleting(true);
    try {
      await usersApi.deleteAccount(deleteReason.trim() || undefined);
      fb.destructive();
      setDeleteOpen(false);
      Alert.alert(
        t ? 'Cuenta eliminada' : 'Account deleted',
        t
          ? 'Tu cuenta fue marcada para eliminación. Tienes 30 días para reactivarla iniciando sesión. Después se borrará definitivamente.'
          : 'Your account has been scheduled for deletion. You have 30 days to reactivate it by logging back in. After that it will be deleted permanently.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/welcome' as never);
            },
          },
        ],
      );
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Mis datos' : 'My data'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t ? 'Tus derechos' : 'Your rights'}</Text>
        <Text style={styles.body}>
          {t
            ? 'Tienes derecho a acceder, rectificar, exportar y eliminar tus datos personales en cualquier momento.'
            : 'You have the right to access, rectify, export and delete your personal data at any time.'}
        </Text>

        {/* Export */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={handleExport} disabled={exporting} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
              <Feather name="download" size={18} color="#60A5FA" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>{t ? 'Exportar mis datos' : 'Export my data'}</Text>
              <Text style={styles.actionDesc}>
                {t ? 'Recibes un ZIP por email con todo lo que guardamos sobre ti.' : 'Get a ZIP by email with everything we store about you.'}
              </Text>
            </View>
            {exporting
              ? <ActivityIndicator color={Colors.accentPrimary} />
              : <Feather name="chevron-right" size={16} color={Colors.textMuted} />}
          </TouchableOpacity>
        </View>

        {/* Delete */}
        <View style={[styles.card, { marginTop: Spacing[4] }]}>
          <TouchableOpacity style={styles.actionRow} onPress={() => setDeleteOpen((v) => !v)} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(228,88,88,0.15)' }]}>
              <Feather name="trash-2" size={18} color={Colors.accentDanger} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionLabel, { color: Colors.accentDanger }]}>
                {t ? 'Eliminar cuenta' : 'Delete account'}
              </Text>
              <Text style={styles.actionDesc}>
                {t
                  ? 'Se marca para borrado definitivo. 30 días de gracia para reactivar iniciando sesión.'
                  : 'Scheduled for permanent deletion. 30-day grace period — log back in to cancel.'}
              </Text>
            </View>
            <Feather name={deleteOpen ? 'chevron-down' : 'chevron-right'} size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {deleteOpen ? (
            <View style={styles.deletePanel}>
              <Text style={styles.deleteLabel}>
                {t ? '¿Por qué te vas? (opcional)' : 'Why are you leaving? (optional)'}
              </Text>
              <TextInput
                style={styles.input}
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder={t ? 'Un comentario nos ayuda a mejorar' : 'A comment helps us improve'}
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              <Text style={[styles.deleteLabel, { marginTop: Spacing[4] }]}>
                {t
                  ? `Para confirmar, escribe ${CONFIRM_WORD}`
                  : `To confirm, type ${CONFIRM_WORD}`}
              </Text>
              <TextInput
                style={styles.input}
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder={CONFIRM_WORD}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  (deleteConfirm !== CONFIRM_WORD || deleting) && { opacity: 0.4 },
                ]}
                disabled={deleteConfirm !== CONFIRM_WORD || deleting}
                onPress={doDelete}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.textInverse} />
                  : <Text style={styles.deleteBtnLbl}>
                      {t ? 'Eliminar mi cuenta' : 'Delete my account'}
                    </Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <Text style={[styles.body, { marginTop: Spacing[6], fontSize: Typography.fontSize.xs, color: Colors.textMuted }]}>
          {t
            ? 'Exportación y eliminación se procesan conforme al RGPD y leyes locales de protección de datos. Algunos registros (facturación, auditoría legal) pueden conservarse por obligación legal aunque elimines tu cuenta.'
            : 'Export and deletion are processed according to GDPR and local data protection laws. Some records (billing, legal audit) may be retained as required by law even if you delete your account.'}
        </Text>
      </ScrollView>
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
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingBottom: Spacing[8] },
  sectionTitle: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  body: { fontSize: Typography.fontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], gap: Spacing[3] },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionInfo: { flex: 1 },
  actionLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary, fontWeight: Typography.fontWeight.semiBold },
  actionDesc: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  deletePanel: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteLabel: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, fontWeight: Typography.fontWeight.semiBold, marginTop: Spacing[3], marginBottom: Spacing[2] },
  input: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    minHeight: 44,
  },
  deleteBtn: {
    marginTop: Spacing[4],
    backgroundColor: Colors.accentDanger,
    paddingVertical: Spacing[3],
    borderRadius: Radius.button,
    alignItems: 'center',
  },
  deleteBtnLbl: { color: Colors.textInverse, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
});
