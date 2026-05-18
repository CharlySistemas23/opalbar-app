// ─────────────────────────────────────────────
//  GDPR / My Data — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header + Lead intro about your rights
//   · Two action cards: EXPORT (info) and DELETE (danger)
//   · Deletion is confirmed via <ConfirmDialog> with a typed "DELETE"
//     input and optional reason. No legacy collapsible panel.
//   · Final caption footer with the legal fine print.
// ─────────────────────────────────────────────
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Caption,
  ConfirmDialog,
  FadeIn,
  Heading,
  Input,
  Kicker,
  Lead,
  Pressy,
  Subhead,
} from '@/components/ui';
import { toast } from '@/components/Toast';

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

  const CONFIRM_WORD = t ? 'ELIMINAR' : 'DELETE';

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await usersApi.exportData();
      fb.success();
      toast(
        t
          ? `Te enviaremos un email a ${user?.email ?? 'tu cuenta'} en 72 h.`
          : `We'll email a ZIP to ${user?.email ?? 'your account'} within 72 h.`,
        'success',
      );
    } catch (err: any) {
      fb.error();
      toast(apiError(err, t ? 'No se pudo solicitar.' : 'Request failed.'), 'danger');
    } finally {
      setExporting(false);
    }
  }

  async function performDelete() {
    if (deleteConfirm.trim().toUpperCase() !== CONFIRM_WORD) {
      toast(
        t ? `Escribe ${CONFIRM_WORD} para confirmar.` : `Type ${CONFIRM_WORD} to confirm.`,
        'warning',
      );
      throw new Error('confirm-word-missing');
    }
    try {
      await usersApi.deleteAccount(deleteReason.trim() || undefined);
      fb.destructive();
      toast(
        t
          ? 'Cuenta marcada. 30 días para reactivar iniciando sesión.'
          : 'Account scheduled. 30-day grace — log back in to cancel.',
        'success',
      );
      setDeleteOpen(false);
      await logout();
      router.replace('/(auth)/welcome' as never);
    } catch (err: any) {
      fb.error();
      toast(apiError(err, t ? 'No se pudo eliminar.' : "Couldn't delete."), 'danger');
      throw err;
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
        <FadeIn>
          <Kicker tone="muted">{t ? 'GDPR · TUS DATOS' : 'GDPR · YOUR DATA'}</Kicker>
          <Heading size="md" style={{ marginTop: Spacing[2] }}>
            {t ? 'Mis datos' : 'My data'}
          </Heading>
          <Lead tone="secondary" style={{ marginTop: Spacing[4] }}>
            {t
              ? 'Tienes derecho a acceder, rectificar, exportar y eliminar tus datos en cualquier momento.'
              : 'You have the right to access, rectify, export and delete your personal data at any time.'}
          </Lead>
        </FadeIn>

        {/* ── Export card ── */}
        <FadeIn delay={120} style={styles.actionCard}>
          <View style={styles.iconBox}>
            <Feather name="download" size={20} color={Colors.accentInfo} />
          </View>
          <View style={{ flex: 1, gap: Spacing[2] }}>
            <Subhead>{t ? 'Exportar mis datos' : 'Export my data'}</Subhead>
            <Body size="sm" tone="muted">
              {t
                ? 'Recibirás un ZIP por email con todo lo que guardamos sobre ti.'
                : 'Get a ZIP by email with everything we store about you.'}
            </Body>
            <Pressy
              onPress={handleExport}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Exportar mis datos' : 'Export my data'}
              disabled={exporting}
              style={[styles.linkCta, exporting && { opacity: 0.5 }]}
            >
              <Body size="sm" tone="accent" weight="semiBold">
                {exporting ? (t ? 'Solicitando…' : 'Requesting…') : (t ? 'Solicitar exportación →' : 'Request export →')}
              </Body>
            </Pressy>
          </View>
        </FadeIn>

        {/* ── Delete card ── */}
        <FadeIn delay={180} style={[styles.actionCard, styles.dangerCard]}>
          <View style={[styles.iconBox, styles.iconBoxDanger]}>
            <Feather name="trash-2" size={20} color={Colors.accentDanger} />
          </View>
          <View style={{ flex: 1, gap: Spacing[2] }}>
            <Subhead tone="danger">{t ? 'Eliminar cuenta' : 'Delete account'}</Subhead>
            <Body size="sm" tone="muted">
              {t
                ? 'Se marca para borrado definitivo. 30 días de gracia para reactivar iniciando sesión.'
                : 'Scheduled for permanent deletion. 30-day grace period — log back in to cancel.'}
            </Body>
            <Pressy
              onPress={() => {
                setDeleteConfirm('');
                setDeleteReason('');
                setDeleteOpen(true);
              }}
              haptic="warning"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Eliminar mi cuenta' : 'Delete my account'}
              style={styles.linkCta}
            >
              <Body size="sm" tone="danger" weight="semiBold">
                {t ? 'Eliminar mi cuenta →' : 'Delete my account →'}
              </Body>
            </Pressy>
          </View>
        </FadeIn>

        <Caption tone="muted" style={styles.fineprint}>
          {t
            ? 'Exportación y eliminación se procesan conforme al RGPD y leyes locales. Algunos registros (facturación, auditoría legal) pueden conservarse por obligación legal.'
            : 'Export and deletion are processed according to GDPR and local laws. Some records (billing, legal audit) may be retained as required.'}
        </Caption>
      </ScrollView>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={performDelete}
        title={t ? 'Eliminar cuenta permanente' : 'Delete account permanently'}
        confirmLabel={t ? 'Eliminar mi cuenta' : 'Delete my account'}
        confirmVariant="danger"
        description={
          <View style={{ gap: Spacing[4] }}>
            <Body tone="secondary">
              {t
                ? 'Perderás todos tus puntos, reservas, canjes y posts. Esta acción no se puede deshacer.'
                : 'You will lose all your points, reservations, redemptions and posts. This cannot be undone.'}
            </Body>
            <Input
              label={t ? 'MOTIVO (OPCIONAL)' : 'REASON (OPTIONAL)'}
              placeholder={t ? 'Un comentario nos ayuda a mejorar.' : 'A comment helps us improve.'}
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              numberOfLines={3}
            />
            <Input
              label={t ? 'CONFIRMACIÓN' : 'CONFIRMATION'}
              placeholder={CONFIRM_WORD}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              required
              helper={
                t
                  ? `Escribe ${CONFIRM_WORD} para activar el botón.`
                  : `Type ${CONFIRM_WORD} to enable the button.`
              }
            />
          </View>
        }
      />
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
    paddingBottom: Spacing[3],
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
  actionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[4],
    padding: Spacing[5],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    marginTop: Spacing[6],
  },
  dangerCard: {
    borderColor: 'rgba(217,106,106,0.30)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(133,173,206,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDanger: {
    backgroundColor: 'rgba(217,106,106,0.10)',
  },
  linkCta: {
    minHeight: 36,
    justifyContent: 'center',
    marginTop: Spacing[1],
  },
  fineprint: {
    marginTop: Spacing[8],
  },
});
