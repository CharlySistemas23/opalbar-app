import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { adminApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors, Radius } from '@/constants/tokens';
import { uploadImage, UploadError } from '@/utils/uploadImage';


type TemplateId = 'OFFER' | 'EVENT' | 'BIRTHDAY' | 'WELCOME' | 'NEWS' | 'GENERIC';
type AudienceType = 'ALL' | 'NEW_7D' | 'VIP' | 'BIRTHDAY_MONTH' | 'INACTIVE_30D' | 'CUSTOM';

type TemplateMeta = {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

type AudienceSample = { id: string; email: string; firstName: string };

const AUDIENCE_OPTIONS: Array<{ id: AudienceType; name: string; hint: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { id: 'ALL',             name: 'Todos los suscritos',  hint: 'Usuarios con consentimiento de marketing', icon: 'users' },
  { id: 'NEW_7D',          name: 'Nuevos (últimos 7 días)', hint: 'Se registraron recientemente',          icon: 'user-plus' },
  { id: 'VIP',             name: 'VIP',                  hint: 'Clientes con nivel de fidelidad',          icon: 'award' },
  { id: 'BIRTHDAY_MONTH',  name: 'Cumpleañeros del mes', hint: 'Cumplen años este mes',                    icon: 'gift' },
  { id: 'INACTIVE_30D',    name: 'Inactivos',            hint: 'No abren la app hace 30+ días',            icon: 'moon' },
];

export default function NewCampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Template catalog
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);

  // Content
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  // CTA as a single composable card
  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  // Hero image — picked from device and uploaded to the API, which returns a public URL
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [heroUploading, setHeroUploading] = useState(false);

  // Audience
  const [audienceType, setAudienceType] = useState<AudienceType>('ALL');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceSample, setAudienceSample] = useState<AudienceSample[]>([]);
  const [countingAudience, setCountingAudience] = useState(false);

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.marketing.templates();
        const list: TemplateMeta[] = res.data?.data ?? res.data ?? [];
        setTemplates(list);
      } catch {
        // ignore — fallback shown on screen
      }
    })();
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    setCountingAudience(true);
    adminApi.marketing.audienceCount({ audienceType })
      .then((res) => {
        const payload = res.data?.data ?? res.data ?? {};
        setAudienceCount(payload.total ?? 0);
        setAudienceSample(payload.sample ?? []);
      })
      .catch(() => { setAudienceCount(0); setAudienceSample([]); })
      .finally(() => setCountingAudience(false));
  }, [step, audienceType]);

  const resolvedCtaUrl = ctaEnabled ? ctaUrl.trim() : '';
  const resolvedCtaLabel = ctaEnabled ? ctaLabel.trim() : '';

  const step1Valid = !!selectedTemplate;
  const step2Valid =
    subject.trim().length >= 3 &&
    headline.trim().length >= 3 &&
    body.trim().length >= 10 &&
    (!ctaEnabled || (resolvedCtaLabel.length > 0 && /^https?:\/\//i.test(resolvedCtaUrl)));
  const step3Valid = !!audienceType;
  const canGoNext = step === 0 ? step1Valid
    : step === 1 ? step2Valid
    : step === 2 ? step3Valid
    : true;

  async function openPreview() {
    if (!selectedTemplate) return;
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await adminApi.marketing.preview({
        template: selectedTemplate,
        subject: subject || '(Sin asunto)',
        preheader: preheader || undefined,
        headline: headline || '(Sin título)',
        body: body || '(Sin contenido)',
        ctaLabel: resolvedCtaLabel || undefined,
        ctaUrl: resolvedCtaUrl || undefined,
        heroImageUrl: heroImageUrl || undefined,
      });
      const payload = res.data?.data ?? res.data ?? {};
      setPreviewText(payload.text ?? '');
    } catch (err: any) {
      setPreviewText(apiError(err, 'No pudimos generar la vista previa.'));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submit(action: 'send' | 'schedule' | 'draft') {
    if (!selectedTemplate) return;
    setError('');
    setSubmitting(true);
    try {
      const payload: any = {
        template: selectedTemplate,
        subject: subject.trim(),
        preheader: preheader.trim() || undefined,
        headline: headline.trim(),
        body: body.trim(),
        ctaLabel: resolvedCtaLabel || undefined,
        ctaUrl: resolvedCtaUrl || undefined,
        heroImageUrl: heroImageUrl || undefined,
        audienceType,
      };
      if (action === 'schedule' && scheduledAt) {
        payload.scheduledAt = scheduledAt.toISOString();
      }

      const res = await adminApi.marketing.createCampaign(payload);
      const campaign = res.data?.data ?? res.data;
      const id = campaign?.id;

      if (action === 'send' && id) {
        await adminApi.marketing.sendNow(id);
      }

      router.replace(`/(admin)/marketing/${id}` as never);
    } catch (err: any) {
      setError(apiError(err, 'No pudimos crear la campaña'));
    } finally {
      setSubmitting(false);
    }
  }

  async function pickHeroImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para elegir una imagen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      setHeroUploading(true);
      const url = await uploadImage(result.assets[0].uri, { kind: 'marketing' });
      setHeroImageUrl(url);
    } catch (err: any) {
      const msg = err instanceof UploadError ? err.message : apiError(err, 'Intenta con una imagen más pequeña.');
      Alert.alert('No se pudo subir', msg);
    } finally {
      setHeroUploading(false);
    }
  }

  function confirmSend() {
    const total = audienceCount ?? 0;
    Alert.alert(
      'Enviar ahora',
      `Se enviarán ${total} correos con el asunto "${subject.trim()}". ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', style: 'destructive', onPress: () => submit('send') },
      ],
    );
  }

  function confirmSchedule() {
    if (!scheduledAt) return Alert.alert('Elige fecha', 'Selecciona fecha y hora del envío.');
    if (scheduledAt.getTime() < Date.now() + 60_000) {
      return Alert.alert('Fecha no válida', 'Elige una fecha al menos 1 minuto en el futuro.');
    }
    submit('schedule');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (step === 0 ? router.back() : setStep((s) => (s - 1) as 0 | 1 | 2 | 3))}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.hint}>Nueva campaña · {step + 1}/4</Text>
            <Text style={styles.title}>
              {step === 0 ? 'Elige plantilla' : step === 1 ? 'Escribe el mensaje' : step === 2 ? 'Audiencia' : 'Revisa y envía'}
            </Text>
          </View>
          {step > 0 && (
            <TouchableOpacity onPress={openPreview} style={styles.iconBtn} hitSlop={10}>
              <Feather name="eye" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <View style={{ gap: 10 }}>
              {templates.length === 0 ? (
                <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 40 }} />
              ) : (
                templates.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.templateCard,
                      selectedTemplate === t.id && { borderColor: t.accent, backgroundColor: t.accent + '10' },
                    ]}
                    onPress={() => setSelectedTemplate(t.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: t.accent + '22' }]}>
                      <Feather name={t.icon as any} size={20} color={t.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateName}>{t.name}</Text>
                      <Text style={styles.templateDesc}>{t.description}</Text>
                    </View>
                    {selectedTemplate === t.id && (
                      <Feather name="check-circle" size={20} color={t.accent} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: 16 }}>
              <Field
                label="Asunto"
                hint="Aparece en la bandeja del destinatario (3-200 caracteres)"
                value={subject}
                onChangeText={setSubject}
                maxLength={200}
                placeholder="Esta noche: jazz en vivo + 2x1 en mezcales"
              />
              <Field
                label="Preheader"
                hint="Texto corto que aparece junto al asunto (opcional)"
                value={preheader}
                onChangeText={setPreheader}
                maxLength={200}
                placeholder="Solo por hoy, hasta que se agoten las mesas."
              />
              <Field
                label="Título dentro del correo"
                hint="3-160 caracteres"
                value={headline}
                onChangeText={setHeadline}
                maxLength={160}
                placeholder="¿Qué tal un plan distinto esta noche?"
              />
              <Field
                label="Mensaje"
                hint="Usa **negritas** y deja líneas en blanco para separar párrafos"
                value={body}
                onChangeText={setBody}
                maxLength={4000}
                multiline
                minHeight={140}
                placeholder={'Tenemos jazz en vivo desde las 9pm…\n\nReserva tu mesa y recibe un shot de bienvenida.'}
              />
              {/* ── Hero image (pick from device) ─── */}
              <View>
                <Text style={styles.fieldLabel}>Imagen destacada</Text>
                <Text style={styles.fieldHint}>
                  Elige una foto de tu galería. Aparece arriba del mensaje.
                </Text>
                {heroImageUrl && /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(heroImageUrl) && (
                  <View style={styles.heroWarn}>
                    <Feather name="alert-triangle" size={14} color={Colors.accentWarning} />
                    <Text style={styles.heroWarnText}>
                      El API corre en una dirección privada. Gmail no podrá cargar la imagen en el correo real. Se omitirá y solo llegará el texto + botón hasta que el API esté público.
                    </Text>
                  </View>
                )}
                {heroImageUrl ? (
                  <View style={styles.heroPreviewWrap}>
                    <Image source={{ uri: heroImageUrl }} style={styles.heroPreview} resizeMode="cover" />
                    <View style={styles.heroActionsRow}>
                      <TouchableOpacity
                        style={styles.heroActionBtn}
                        onPress={pickHeroImage}
                        disabled={heroUploading}
                        activeOpacity={0.85}
                      >
                        <Feather name="refresh-cw" size={14} color={Colors.textPrimary} />
                        <Text style={styles.heroActionLabel}>Cambiar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.heroActionBtn, styles.heroActionDanger]}
                        onPress={() => setHeroImageUrl('')}
                        disabled={heroUploading}
                        activeOpacity={0.85}
                      >
                        <Feather name="trash-2" size={14} color={Colors.accentDanger} />
                        <Text style={[styles.heroActionLabel, { color: Colors.accentDanger }]}>Quitar</Text>
                      </TouchableOpacity>
                    </View>
                    {heroUploading && (
                      <View style={styles.heroUploadingOverlay}>
                        <ActivityIndicator color={Colors.textInverse} />
                        <Text style={styles.heroUploadingText}>Subiendo…</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.heroEmpty}
                    onPress={pickHeroImage}
                    disabled={heroUploading}
                    activeOpacity={0.85}
                  >
                    {heroUploading ? (
                      <>
                        <ActivityIndicator color={Colors.accentPrimary} />
                        <Text style={styles.heroEmptyText}>Subiendo imagen…</Text>
                      </>
                    ) : (
                      <>
                        <Feather name="image" size={28} color={Colors.textMuted} />
                        <Text style={styles.heroEmptyText}>Toca para elegir una foto</Text>
                        <Text style={styles.heroEmptyHint}>Recomendado: horizontal 16:9</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* ── CTA card (toggle + destination + label preview) ─── */}
              <View style={styles.ctaCard}>
                <TouchableOpacity
                  style={styles.ctaHeader}
                  onPress={() => setCtaEnabled((v) => !v)}
                  activeOpacity={0.85}
                >
                  <Feather
                    name={ctaEnabled ? 'check-square' : 'square'}
                    size={20}
                    color={ctaEnabled ? Colors.accentPrimary : Colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ctaTitle}>Incluir botón de acción</Text>
                    <Text style={styles.ctaSub}>
                      {ctaEnabled
                        ? 'El correo incluirá un botón que abre el destino elegido'
                        : 'Sin botón — el correo será solo de lectura'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {ctaEnabled && (
                  <View style={{ gap: 14, marginTop: 16 }}>
                    <Field
                      label="Texto del botón"
                      hint="Lo que lee el destinatario (máx 60 caracteres)"
                      value={ctaLabel}
                      onChangeText={setCtaLabel}
                      maxLength={60}
                      placeholder="Reservar mesa"
                    />
                    <Field
                      label="Enlace del botón"
                      hint="URL completa, empezando con https://"
                      value={ctaUrl}
                      onChangeText={setCtaUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                      placeholder="https://ejemplo.com/reservar"
                    />

                    {/* Live preview of how the button looks */}
                    <View style={styles.ctaPreviewWrap}>
                      <Text style={styles.ctaPreviewLabel}>Así se verá:</Text>
                      <View style={styles.ctaPreviewBtn}>
                        <Text style={styles.ctaPreviewBtnLabel} numberOfLines={1}>
                          {ctaLabel.trim() || 'Texto del botón'}
                        </Text>
                      </View>
                      {resolvedCtaUrl ? (
                        <Text style={styles.ctaPreviewUrl} numberOfLines={1}>
                          → {resolvedCtaUrl}
                        </Text>
                      ) : (
                        <Text style={[styles.ctaPreviewUrl, { color: Colors.accentDanger }]}>
                          Falta pegar la URL
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: 10 }}>
              {AUDIENCE_OPTIONS.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.audienceCard,
                    audienceType === a.id && { borderColor: Colors.accentPrimary, backgroundColor: Colors.accentPrimary + '10' },
                  ]}
                  onPress={() => setAudienceType(a.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.audienceIcon, { backgroundColor: Colors.accentPrimary + '22' }]}>
                    <Feather name={a.icon} size={18} color={Colors.accentPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.audienceName}>{a.name}</Text>
                    <Text style={styles.audienceHint}>{a.hint}</Text>
                  </View>
                  {audienceType === a.id && (
                    <Feather name="check-circle" size={20} color={Colors.accentPrimary} />
                  )}
                </TouchableOpacity>
              ))}

              <View style={styles.countBox}>
                {countingAudience ? (
                  <ActivityIndicator color={Colors.accentPrimary} />
                ) : (
                  <>
                    <Text style={styles.countBig}>{audienceCount ?? 0}</Text>
                    <Text style={styles.countLabel}>destinatarios con consentimiento</Text>
                    {audienceSample.length > 0 && (
                      <Text style={styles.countSample} numberOfLines={2}>
                        Incluye a {audienceSample.slice(0, 3).map((u) => u.firstName || u.email).join(', ')}
                        {audienceSample.length > 3 ? '…' : ''}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: 16 }}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Plantilla</Text>
                <Text style={styles.summaryValue}>
                  {templates.find((t) => t.id === selectedTemplate)?.name ?? selectedTemplate}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Asunto</Text>
                <Text style={styles.summaryValue}>{subject}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Audiencia</Text>
                <Text style={styles.summaryValue}>
                  {AUDIENCE_OPTIONS.find((a) => a.id === audienceType)?.name ?? audienceType}
                  {audienceCount !== null ? ` · ${audienceCount} destinatarios` : ''}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.scheduleToggle}
                onPress={() => setScheduleEnabled((v) => !v)}
                activeOpacity={0.85}
              >
                <Feather
                  name={scheduleEnabled ? 'check-square' : 'square'}
                  size={20}
                  color={scheduleEnabled ? Colors.accentPrimary : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleLabel}>Programar envío</Text>
                  <Text style={styles.scheduleHint}>Deja desactivado para enviar ahora</Text>
                </View>
              </TouchableOpacity>

              {scheduleEnabled && (
                <ScheduleQuickPicks value={scheduledAt} onChange={setScheduledAt} />
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={{ gap: 10, marginTop: 8 }}>
                {scheduleEnabled ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                    onPress={confirmSchedule}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator color={Colors.textInverse} />
                      : (
                        <>
                          <Feather name="clock" size={16} color={Colors.textInverse} />
                          <Text style={styles.primaryBtnLabel}>Programar campaña</Text>
                        </>
                      )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                    onPress={confirmSend}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator color={Colors.textInverse} />
                      : (
                        <>
                          <Feather name="send" size={16} color={Colors.textInverse} />
                          <Text style={styles.primaryBtnLabel}>Enviar ahora</Text>
                        </>
                      )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => submit('draft')}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryBtnLabel}>Guardar como borrador</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {step < 3 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, !canGoNext && styles.btnDisabled]}
              onPress={() => canGoNext && setStep((s) => (s + 1) as 0 | 1 | 2 | 3)}
              disabled={!canGoNext}
            >
              <Text style={styles.primaryBtnLabel}>Continuar</Text>
              <Feather name="arrow-right" size={16} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={previewLoading}
        text={previewText}
        subject={subject}
        headline={headline}
        body={body}
        ctaLabel={resolvedCtaLabel}
        ctaUrl={resolvedCtaUrl}
        heroImageUrl={heroImageUrl}
      />
    </SafeAreaView>
  );
}

function Field({
  label, hint, value, onChangeText, multiline, minHeight, ...rest
}: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, multiline && { minHeight: minHeight ?? 100, textAlignVertical: 'top', paddingVertical: 14 }]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

function ScheduleQuickPicks({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const picks = useMemo(() => {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60_000);
    const tonight = new Date(now); tonight.setHours(20, 0, 0, 0);
    const tomorrow9 = new Date(now); tomorrow9.setDate(now.getDate() + 1); tomorrow9.setHours(9, 0, 0, 0);
    const tomorrow6 = new Date(now); tomorrow6.setDate(now.getDate() + 1); tomorrow6.setHours(18, 0, 0, 0);
    const opts = [
      { label: 'En 1 hora',       date: in1h },
      { label: 'Hoy 8pm',         date: tonight },
      { label: 'Mañana 9am',      date: tomorrow9 },
      { label: 'Mañana 6pm',      date: tomorrow6 },
    ];
    return opts.filter((o) => o.date.getTime() > now.getTime() + 60_000);
  }, [value]);

  return (
    <View style={styles.pickRow}>
      {picks.map((p) => {
        const active = value?.getTime() === p.date.getTime();
        return (
          <TouchableOpacity
            key={p.label}
            style={[styles.pickBtn, active && { borderColor: Colors.accentPrimary, backgroundColor: Colors.accentPrimary + '14' }]}
            onPress={() => onChange(p.date)}
            activeOpacity={0.85}
          >
            <Text style={[styles.pickLabel, active && { color: Colors.accentPrimary }]}>{p.label}</Text>
            <Text style={styles.pickHint}>
              {p.date.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PreviewModal({
  open, onClose, loading, text, subject, headline, body, ctaLabel, ctaUrl, heroImageUrl,
}: {
  open: boolean; onClose: () => void; loading: boolean; text: string;
  subject: string; headline: string; body: string; ctaLabel: string; ctaUrl: string;
  heroImageUrl: string;
}) {
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPrimary }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Feather name="x" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.hint}>Vista previa</Text>
            <Text style={styles.title} numberOfLines={1}>{subject || 'Sin asunto'}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {loading ? (
            <ActivityIndicator color={Colors.accentPrimary} />
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.previewCard}>
                <View style={styles.previewMark}>
                  <Text style={styles.previewMarkText}>OPALBAR</Text>
                  <View style={styles.previewMarkDash} />
                </View>
                {heroImageUrl ? (
                  <Image
                    source={{ uri: heroImageUrl }}
                    style={styles.previewHero}
                    resizeMode="cover"
                  />
                ) : null}
                <Text style={styles.previewGreet}>HOLA.</Text>
                <Text style={styles.previewHeadline}>{headline || '(sin título)'}</Text>
                <Text style={styles.previewBody}>{body || '(sin contenido)'}</Text>
                {ctaLabel && ctaUrl ? (
                  <View style={styles.previewCta}>
                    <Text style={styles.previewCtaLabel}>{ctaLabel.toUpperCase()}</Text>
                  </View>
                ) : null}
                <View style={styles.previewDivider} />
                <Text style={styles.previewFoot}>© {new Date().getFullYear()} · OPALBAR</Text>
              </View>
              <Text style={styles.fieldHint}>Texto alternativo (plain text):</Text>
              <View style={[styles.previewCard, { backgroundColor: Colors.bgElevated }]}>
                <Text style={styles.previewText}>{text}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },

  progressTrack: {
    height: 3,
    marginHorizontal: 20,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
  },

  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  templateName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  templateDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  fieldLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  fieldHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },

  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  audienceIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  audienceName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  audienceHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  countBox: {
    marginTop: 10,
    padding: 20,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countBig: { color: Colors.accentPrimary, fontSize: 36, fontWeight: '800' },
  countLabel: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  countSample: { color: Colors.textMuted, fontSize: 11, marginTop: 8, textAlign: 'center' },

  summaryCard: {
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
  },
  summaryValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },

  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scheduleLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  scheduleHint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickBtn: {
    flexGrow: 1,
    minWidth: '47%',
    padding: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  pickHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  errorText: { color: Colors.accentDanger, fontSize: 13, textAlign: 'center' },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    height: 46,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },

  previewCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E3DD',
    gap: 14,
  },
  previewMark: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  previewMarkText: {
    color: '#1A1A1E',
    fontSize: 14,
    letterSpacing: 5,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  previewMarkDash: {
    width: 28,
    height: 1,
    backgroundColor: '#1A1A1E',
  },
  previewGreet: {
    color: '#8A8A92',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  previewHeadline: {
    color: '#1A1A1E',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  previewBody: {
    color: '#3A3A42',
    fontSize: 14,
    lineHeight: 23,
  },
  previewCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: '#1A1A1E',
    borderRadius: 2,
    marginTop: 4,
  },
  previewCtaLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E5E3DD',
    marginTop: 6,
  },
  previewFoot: {
    textAlign: 'center',
    color: '#8A8A92',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  previewText: { color: Colors.textSecondary, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 17 },
  previewHero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },

  // Hero image picker
  heroPreviewWrap: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  heroPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.bgElevated,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: Colors.bgCard,
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  heroActionDanger: {
    borderColor: 'rgba(228,88,88,0.3)',
    backgroundColor: 'rgba(228,88,88,0.08)',
  },
  heroActionLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroUploadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
  },
  heroUploadingText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  heroEmpty: {
    height: 160,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroEmptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  heroEmptyHint: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  heroWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,163,64,0.3)',
  },
  heroWarnText: {
    flex: 1,
    color: Colors.accentWarning,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },

  // CTA card
  ctaCard: {
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  ctaSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  ctaPreviewWrap: {
    marginTop: 4,
    padding: 14,
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  ctaPreviewLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ctaPreviewBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 10,
  },
  ctaPreviewBtnLabel: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },
  ctaPreviewUrl: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
