// ─────────────────────────────────────────────
//  GDPR / My Data — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header + Lead intro about your rights
//   · EXPORT card: request → POST /users/me/export (dedupes server-side)
//   · "MIS SOLICITUDES": status of exports (download when COMPLETED) and
//     deletions — GET /users/me/data-requests. Skeleton / ErrorState / Empty.
//   · DELETE card → dedicated /profile/delete-account screen
//   · Final caption footer with the legal fine print.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
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
  Badge,
  Body,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  Lead,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

type RequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface ExportRow {
  id: string;
  status: RequestStatus;
  createdAt: string;
  processedAt?: string | null;
  downloadUrl?: string | null;
  expiresAt?: string | null;
  expired?: boolean;
}

interface DeletionRow {
  id: string;
  status: RequestStatus;
  createdAt: string;
  scheduledFor: string;
  processedAt?: string | null;
}

interface DataRequests {
  exports: ExportRow[];
  deletions: DeletionRow[];
}

function statusVariant(s: RequestStatus): 'warning' | 'info' | 'success' | 'danger' {
  if (s === 'COMPLETED') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'PROCESSING') return 'info';
  return 'warning';
}

export default function Gdpr() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [exporting, setExporting] = useState(false);
  const [requests, setRequests] = useState<DataRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = (s: RequestStatus) =>
    s === 'COMPLETED'
      ? t ? 'Lista' : 'Ready'
      : s === 'FAILED'
        ? t ? 'Falló' : 'Failed'
        : s === 'PROCESSING'
          ? t ? 'En proceso' : 'Processing'
          : t ? 'Pendiente' : 'Pending';

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(t ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.dataRequests();
      const data = res?.data?.data ?? {};
      setRequests({
        exports: Array.isArray(data.exports) ? data.exports : [],
        deletions: Array.isArray(data.deletions) ? data.deletions : [],
      });
    } catch (err) {
      setError(apiError(err, t ? 'No se pudieron cargar tus solicitudes.' : 'Could not load your requests.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const hasOpenExport = !!requests?.exports.some((e) => e.status === 'PENDING' || e.status === 'PROCESSING');

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await usersApi.exportData();
      const already = !!res?.data?.data?.alreadyRequested;
      fb.success();
      toast(
        already
          ? t
            ? 'Ya tienes una exportación en curso. Te avisaremos por email.'
            : 'An export is already in progress. We will email you.'
          : t
            ? `Listo. Te enviaremos un email a ${user?.email ?? 'tu cuenta'} en máximo 72 h.`
            : `Done. We'll email ${user?.email ?? 'your account'} within 72 h.`,
        'success',
      );
      load();
    } catch (err) {
      fb.error();
      toast(apiError(err, t ? 'No se pudo solicitar.' : 'Request failed.'), 'danger');
    } finally {
      setExporting(false);
    }
  }

  async function openDownload(row: ExportRow) {
    if (!row.downloadUrl) return;
    try {
      const ok = await Linking.canOpenURL(row.downloadUrl);
      if (!ok) throw new Error('cannot-open');
      await Linking.openURL(row.downloadUrl);
    } catch {
      toast(t ? 'No se pudo abrir la descarga.' : 'Could not open the download.', 'danger');
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
        <FadeIn style={styles.hero}>
          <Kicker tone="muted">{t ? 'GDPR · TUS DATOS' : 'GDPR · YOUR DATA'}</Kicker>
          <Heading size="md">{t ? 'Mis datos' : 'My data'}</Heading>
          <Lead tone="secondary" style={{ marginTop: Spacing[3] }}>
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
                ? 'Preparamos un archivo con todo lo que guardamos sobre ti y te avisamos por email cuando esté listo (máximo 72 h).'
                : 'We prepare a file with everything we store about you and email you when it is ready (within 72 h).'}
            </Body>
            <Pressy
              onPress={handleExport}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Exportar mis datos' : 'Export my data'}
              disabled={exporting || hasOpenExport}
              style={[styles.linkCta, (exporting || hasOpenExport) && { opacity: 0.5 }]}
            >
              <Body size="sm" tone="accent" weight="semiBold">
                {exporting
                  ? t ? 'Solicitando…' : 'Requesting…'
                  : hasOpenExport
                    ? t ? 'Exportación en curso' : 'Export in progress'
                    : t ? 'Solicitar exportación →' : 'Request export →'}
              </Body>
            </Pressy>
          </View>
        </FadeIn>

        {/* ── Requests status ── */}
        <FadeIn delay={160} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'MIS SOLICITUDES' : 'MY REQUESTS'}
          </Kicker>
          {loading ? (
            <View style={{ gap: Spacing[3] }}>
              <Skeleton height={64} radius={Radius.card} />
              <Skeleton height={64} radius={Radius.card} />
            </View>
          ) : error ? (
            <ErrorState
              message={error}
              retryLabel={t ? 'Reintentar' : 'Retry'}
              onRetry={load}
              icon="file-text"
            />
          ) : !requests || (requests.exports.length === 0 && requests.deletions.length === 0) ? (
            <View style={styles.emptyShell}>
              <Feather name="inbox" size={18} color={Colors.textMuted} />
              <Body size="sm" tone="muted" style={{ flex: 1 }}>
                {t
                  ? 'Aún no has solicitado exportaciones ni eliminaciones.'
                  : "You haven't requested any exports or deletions yet."}
              </Body>
            </View>
          ) : (
            <View style={{ gap: Spacing[3] }}>
              {requests.exports.map((row) => {
                const ready = row.status === 'COMPLETED' && !!row.downloadUrl && !row.expired;
                return (
                  <View key={`exp-${row.id}`} style={styles.requestRow}>
                    <View style={styles.requestIcon}>
                      <Feather name="download" size={16} color={Colors.accentInfo} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.requestTitleRow}>
                        <Body size="sm" weight="semiBold" style={{ flex: 1 }}>
                          {t ? 'Exportación de datos' : 'Data export'}
                        </Body>
                        <Badge
                          label={row.expired ? (t ? 'Expiró' : 'Expired') : statusLabel(row.status)}
                          variant={row.expired ? 'default' : statusVariant(row.status)}
                          size="sm"
                        />
                      </View>
                      <Caption tone="muted">
                        {t ? 'Solicitada el ' : 'Requested on '}
                        {formatDate(row.createdAt)}
                        {row.status === 'COMPLETED' && row.expiresAt && !row.expired
                          ? ` · ${t ? 'disponible hasta el' : 'available until'} ${formatDate(row.expiresAt)}`
                          : ''}
                      </Caption>
                      {ready ? (
                        <Pressy
                          onPress={() => openDownload(row)}
                          haptic="select"
                          accessibilityRole={Roles.button}
                          accessibilityLabel={t ? 'Descargar archivo' : 'Download file'}
                          style={styles.linkCta}
                        >
                          <Body size="sm" tone="accent" weight="semiBold">
                            {t ? 'Descargar archivo →' : 'Download file →'}
                          </Body>
                        </Pressy>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              {requests.deletions.map((row) => (
                <View key={`del-${row.id}`} style={[styles.requestRow, styles.requestRowDanger]}>
                  <View style={[styles.requestIcon, styles.requestIconDanger]}>
                    <Feather name="trash-2" size={16} color={Colors.accentDanger} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.requestTitleRow}>
                      <Body size="sm" weight="semiBold" style={{ flex: 1 }}>
                        {t ? 'Eliminación de cuenta' : 'Account deletion'}
                      </Body>
                      <Badge label={statusLabel(row.status)} variant={statusVariant(row.status)} size="sm" />
                    </View>
                    <Caption tone="muted">
                      {row.status === 'COMPLETED'
                        ? `${t ? 'Procesada el' : 'Processed on'} ${formatDate(row.processedAt ?? row.scheduledFor)}`
                        : `${t ? 'Borrado definitivo programado para el' : 'Permanent deletion scheduled for'} ${formatDate(row.scheduledFor)}`}
                    </Caption>
                  </View>
                </View>
              ))}
            </View>
          )}
        </FadeIn>

        {/* ── Delete card ── */}
        <FadeIn delay={200} style={[styles.actionCard, styles.dangerCard]}>
          <View style={[styles.iconBox, styles.iconBoxDanger]}>
            <Feather name="trash-2" size={20} color={Colors.accentDanger} />
          </View>
          <View style={{ flex: 1, gap: Spacing[2] }}>
            <Subhead tone="danger">{t ? 'Eliminar cuenta' : 'Delete account'}</Subhead>
            <Body size="sm" tone="muted">
              {t
                ? 'Tu cuenta se desactiva de inmediato y se borra de forma definitiva a los 30 días. Durante ese periodo puedes pedir a soporte que la restaure.'
                : 'Your account is deactivated immediately and permanently deleted after 30 days. During that window you can ask support to restore it.'}
            </Body>
            <Pressy
              onPress={() => router.push('/(app)/profile/delete-account' as never)}
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
  hero: {
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  section: {
    marginTop: Spacing[8],
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
  emptyShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  requestRowDanger: {
    borderColor: 'rgba(217,106,106,0.30)',
  },
  requestIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(133,173,206,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestIconDanger: {
    backgroundColor: 'rgba(217,106,106,0.10)',
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  fineprint: {
    marginTop: Spacing[8],
  },
});
