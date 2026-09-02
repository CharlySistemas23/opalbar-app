// ─────────────────────────────────────────────
//  Reservation · Modify — Editorial Premium
//
//  Edits a reservation as the API models it: a venue-local calendar day
//  (`date: 'YYYY-MM-DD'`) plus a `timeSlot: 'HH:mm'`. Slots come from
//  GET /reservations/availability so full / past / blocked ones are shown
//  but disabled. The guest's own slot is excluded from the count so keeping
//  the same time is always allowed.
//
//   · Header back 40x40 + título centrado
//   · Hero kicker + heading
//   · Aviso de bloqueo como hairline card neutra (Kicker + Body)
//   · Card "Bar" usando primitives Card + Body
//   · Día (strip horizontal) + hora (grid de slots)
//   · Counter con Pressy y Body Numeric centrado (≤ 20)
//   · Notas como textarea bgCard hairline
//   · CTA primario sticky bottom (Button primary)
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Skeleton,
  Subhead,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets, Typography } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reservationsApi, type AvailabilitySlot } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import {
  formatDateOnly,
  formatTimeSlot,
  isPastSlot,
  nextDaysMx,
  parseDateOnly,
  toDateOnly,
} from '@/utils/date';

const MAX_PARTY = 20;
const LOCKED_STATUSES = ['CANCELLED', 'COMPLETED', 'SEATED', 'NO_SHOW'];

export default function ModifyReservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [venueId, setVenueId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [status, setStatus] = useState('');
  const [original, setOriginal] = useState<{ date: string; timeSlot: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [reservationsEnabled, setReservationsEnabled] = useState(true);
  const slotsReq = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const r = await reservationsApi.detail(id);
      const res = r.data?.data ?? r.data;
      const d = toDateOnly(res?.date) ?? '';
      setDate(d);
      setTimeSlot(res?.timeSlot ?? '');
      setOriginal({ date: d, timeSlot: res?.timeSlot ?? '' });
      setPartySize(Math.min(MAX_PARTY, Math.max(1, res?.partySize ?? 2)));
      setNotes(res?.specialRequests ?? '');
      setVenueId(res?.venueId ?? res?.venue?.id ?? '');
      setVenueName(res?.venue?.name ?? '');
      setStatus(res?.status ?? '');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadSlots = useCallback(async () => {
    if (!venueId || !date) return;
    const req = ++slotsReq.current;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const r = await reservationsApi.availability(venueId, date, id);
      if (req !== slotsReq.current) return;
      const data = r.data?.data ?? r.data;
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
      setReservationsEnabled(data?.reservationsEnabled !== false);
    } catch (err) {
      if (req !== slotsReq.current) return;
      setSlotsError(apiError(err));
    } finally {
      if (req === slotsReq.current) setSlotsLoading(false);
    }
  }, [venueId, date, id]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const statusLocked = LOCKED_STATUSES.includes(status);
  // The original slot already started → nothing to move anymore.
  const slotPassed = !!original && isPastSlot(original.date, original.timeSlot);
  const locked = statusLocked || slotPassed;

  const keepingOriginal = !!original && original.date === date && original.timeSlot === timeSlot;
  const selectedSlot = slots.find((s) => s.time === timeSlot);
  const slotOk = keepingOriginal || (!!selectedSlot && selectedSlot.available);
  const canSave = !locked && !saving && !!date && !!timeSlot && slotOk && reservationsEnabled;

  async function save() {
    if (!id || !canSave) return;
    setSaving(true);
    try {
      await reservationsApi.modify(id, {
        date,
        timeSlot,
        partySize,
        specialRequests: notes.trim() || undefined,
      });
      fb.success();
      toast(t ? 'Reserva actualizada' : 'Reservation updated', 'success');
      router.back();
    } catch (err) {
      fb.error();
      toast(apiError(err), 'danger');
      // Availability may have changed under us — refresh the grid.
      loadSlots();
    } finally {
      setSaving(false);
    }
  }

  const days = nextDaysMx(21);
  // Keep the original day visible even if it's earlier than the strip (edge: today rollover).
  const dayList = original?.date && !days.includes(original.date) ? [original.date, ...days] : days;

  const lockReason = statusLocked
    ? t
      ? 'Esta reserva ya no puede modificarse en su estado actual.'
      : 'This reservation can no longer be modified in its current state.'
    : t
      ? 'La hora de tu reserva ya pasó; ya no puede moverse.'
      : 'Your reservation time has already passed; it can no longer be moved.';

  function slotHint(s: AvailabilitySlot): string | null {
    if (s.available) return null;
    if (s.reason === 'past') return t ? 'Pasó' : 'Past';
    if (s.reason === 'blocked') return t ? 'Cerrado' : 'Closed';
    return t ? 'Lleno' : 'Full';
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header ─────────────────────────────── */}
        <View style={styles.headerRow}>
          <Pressy
            onPress={() => router.back()}
            accessibilityLabel={t ? 'Volver' : 'Back'}
            accessibilityRole={Roles.button}
            hitSlop={HitSlop.expand}
            style={styles.iconBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
          <Subhead tone="primary" numberOfLines={1} style={styles.headerTitle}>
            {t ? 'Modificar reserva' : 'Modify reservation'}
          </Subhead>
          <View style={styles.iconBtn} />
        </View>

        {loading ? (
          <View style={styles.skeletonWrap}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="70%" height={28} />
            <Skeleton width="100%" height={64} radius={Radius.md} />
            <Skeleton width="100%" height={72} radius={Radius.md} />
            <Skeleton width="100%" height={120} radius={Radius.md} />
            <Skeleton width="100%" height={56} radius={Radius.md} />
            <Skeleton width="100%" height={96} radius={Radius.md} />
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            title={t ? 'No pudimos cargar tu reserva' : "Couldn't load your reservation"}
            retryLabel={t ? 'Reintentar' : 'Retry'}
            onRetry={() => { setLoading(true); load(); }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero ─────────────────────────── */}
            <FadeIn>
              <Kicker tone="champagne">
                {t ? 'AJUSTES DE RESERVA' : 'BOOKING ADJUSTMENTS'}
              </Kicker>
            </FadeIn>
            <FadeIn delay={80} style={{ marginTop: Spacing[2] }}>
              <Heading size="lg">
                {t ? 'Modifica tu visita.' : 'Update your visit.'}
              </Heading>
            </FadeIn>

            {/* Lock notice ───────────────────── */}
            {locked && (
              <FadeIn delay={140} style={styles.lockedCard}>
                <Feather name="lock" size={14} color={Colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Kicker tone="muted">
                    {t ? 'BLOQUEADA' : 'LOCKED'}
                  </Kicker>
                  <Body size="sm" tone="secondary" style={{ marginTop: 4 }}>
                    {lockReason}
                  </Body>
                </View>
              </FadeIn>
            )}

            {/* Venue ─────────────────────────── */}
            <FadeIn delay={200} style={styles.venueCard}>
              <View style={styles.venueIcon}>
                <Feather name="map-pin" size={16} color={Colors.accentPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Kicker tone="muted">{t ? 'BAR' : 'VENUE'}</Kicker>
                <Subhead style={{ marginTop: 4 }}>
                  {venueName || '—'}
                </Subhead>
              </View>
            </FadeIn>

            <Hairline variant="subtle" style={{ marginVertical: Spacing[5] }} />

            {/* Date ──────────────────────────── */}
            <FadeIn delay={260}>
              <View style={styles.labelRow}>
                <Caption tone="secondary" style={styles.fieldLabel}>
                  {t ? 'FECHA' : 'DATE'}
                </Caption>
                {date ? (
                  <Caption tone="muted">
                    {formatDateOnly(date, language, { weekday: 'long', month: 'long' })}
                  </Caption>
                ) : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing[2], paddingHorizontal: EditorialSpacing.pageGutter }}
                style={{ marginHorizontal: -EditorialSpacing.pageGutter }}
              >
                {dayList.map((iso) => {
                  const d = parseDateOnly(iso);
                  if (!d) return null;
                  const selected = iso === date;
                  const weekday = formatDateOnly(iso, language, { weekday: 'short', month: 'numeric' })
                    .split(/[,\s]/)[0];
                  const month = new Intl.DateTimeFormat(t ? 'es-MX' : 'en-US', { month: 'short' }).format(d);
                  return (
                    <Pressy
                      key={iso}
                      onPress={() => { setDate(iso); setTimeSlot(''); }}
                      disabled={locked}
                      haptic="select"
                      accessibilityRole={Roles.button}
                      accessibilityLabel={formatDateOnly(iso, language, { weekday: 'long', month: 'long' })}
                      accessibilityState={{ selected, disabled: locked }}
                      style={[
                        styles.dateTile,
                        selected ? styles.tileSelected : null,
                        locked ? styles.tileDisabled : null,
                      ]}
                    >
                      <Caption tone={selected ? 'primary' : 'muted'} style={styles.tileKicker}>
                        {weekday.toUpperCase()}
                      </Caption>
                      <Body size="lg" weight="semiBold" style={{ marginTop: 2 }}>
                        {String(d.getDate())}
                      </Body>
                      <Caption tone="muted" style={{ marginTop: 1 }}>
                        {month.replace('.', '').toUpperCase()}
                      </Caption>
                    </Pressy>
                  );
                })}
              </ScrollView>
            </FadeIn>

            {/* Time slot ─────────────────────── */}
            <FadeIn delay={300} style={{ marginTop: Spacing[5] }}>
              <View style={styles.labelRow}>
                <Caption tone="secondary" style={styles.fieldLabel}>
                  {t ? 'HORA' : 'TIME'}
                </Caption>
              </View>
              {slotsLoading ? (
                <View style={styles.grid}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} width={76} height={44} radius={Radius.sm} />
                  ))}
                </View>
              ) : slotsError ? (
                <ErrorState
                  message={slotsError}
                  title={t ? 'No pudimos cargar los horarios' : "Couldn't load time slots"}
                  retryLabel={t ? 'Reintentar' : 'Retry'}
                  onRetry={loadSlots}
                />
              ) : !reservationsEnabled ? (
                <Body size="sm" tone="secondary">
                  {t
                    ? 'Las reservas están pausadas por ahora. Puedes conservar tu horario actual.'
                    : 'Reservations are paused right now. You can keep your current time.'}
                </Body>
              ) : slots.length === 0 ? (
                <Body size="sm" tone="secondary">
                  {t ? 'No hay horarios para este día.' : 'No time slots for this day.'}
                </Body>
              ) : (
                <View style={styles.grid}>
                  {slots.map((s) => {
                    const selected = s.time === timeSlot;
                    const isOriginal = !!original && original.date === date && original.timeSlot === s.time;
                    const disabled = locked || (!s.available && !isOriginal);
                    const hint = isOriginal ? (t ? 'Actual' : 'Current') : slotHint(s);
                    return (
                      <Pressy
                        key={s.time}
                        onPress={() => setTimeSlot(s.time)}
                        disabled={disabled}
                        haptic="select"
                        accessibilityRole={Roles.button}
                        accessibilityLabel={`${formatTimeSlot(s.time, language)}${hint ? ` · ${hint}` : ''}`}
                        accessibilityState={{ selected, disabled }}
                        style={[
                          styles.slotTile,
                          selected ? styles.tileSelected : null,
                          disabled ? styles.tileDisabled : null,
                        ]}
                      >
                        <Body
                          size="sm"
                          weight={selected ? 'semiBold' : 'medium'}
                          tone={disabled ? 'muted' : selected ? 'primary' : 'secondary'}
                        >
                          {formatTimeSlot(s.time, language)}
                        </Body>
                        {hint ? (
                          <Caption tone={isOriginal ? 'champagne' : 'muted'} style={{ marginTop: 2 }}>
                            {hint.toUpperCase()}
                          </Caption>
                        ) : null}
                      </Pressy>
                    );
                  })}
                </View>
              )}
            </FadeIn>

            {/* Party size ────────────────────── */}
            <FadeIn delay={340} style={{ marginTop: Spacing[5] }}>
              <View style={styles.labelRow}>
                <Caption tone="secondary" style={styles.fieldLabel}>
                  {t ? 'PERSONAS' : 'GUESTS'}
                </Caption>
                <Caption tone="muted">{t ? `máx. ${MAX_PARTY}` : `max ${MAX_PARTY}`}</Caption>
              </View>
              <View style={styles.counter}>
                <Pressy
                  onPress={() => setPartySize((n) => Math.max(1, n - 1))}
                  disabled={locked || partySize <= 1}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? 'Menos personas' : 'Decrease guests'}
                  hitSlop={HitSlop.expand}
                  haptic="select"
                  style={[
                    styles.counterBtn,
                    (locked || partySize <= 1) && styles.counterBtnDisabled,
                  ]}
                >
                  <Feather
                    name="minus"
                    size={18}
                    color={locked || partySize <= 1 ? Colors.textDisabled : Colors.textPrimary}
                  />
                </Pressy>
                <Body
                  size="lg"
                  tone="primary"
                  weight="semiBold"
                  style={styles.counterValue}
                >
                  {String(partySize)}
                </Body>
                <Pressy
                  onPress={() => setPartySize((n) => Math.min(MAX_PARTY, n + 1))}
                  disabled={locked || partySize >= MAX_PARTY}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? 'Más personas' : 'Increase guests'}
                  hitSlop={HitSlop.expand}
                  haptic="select"
                  style={[
                    styles.counterBtn,
                    (locked || partySize >= MAX_PARTY) && styles.counterBtnDisabled,
                  ]}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color={locked || partySize >= MAX_PARTY ? Colors.textDisabled : Colors.textPrimary}
                  />
                </Pressy>
              </View>
            </FadeIn>

            {/* Notes ─────────────────────────── */}
            <FadeIn delay={380} style={{ marginTop: Spacing[5] }}>
              <View style={styles.labelRow}>
                <Caption tone="secondary" style={styles.fieldLabel}>
                  {t ? 'NOTAS' : 'NOTES'}
                </Caption>
              </View>
              <TextInput
                style={styles.notes}
                multiline
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
                placeholder={
                  t ? 'Alergias, solicitudes especiales…' : 'Allergies, special requests…'
                }
                placeholderTextColor={Colors.textMuted}
                editable={!locked}
                accessibilityLabel={t ? 'Notas para tu reserva' : 'Notes for your reservation'}
              />
            </FadeIn>
          </ScrollView>
        )}

        {/* Sticky CTA ───────────────────────── */}
        {!loading && !error && (
          <View style={styles.footer}>
            <Button
              label={t ? 'Guardar cambios' : 'Save changes'}
              onPress={save}
              loading={saving}
              disabled={!canSave}
              variant="primary"
              size="lg"
              haptic="success"
              fullWidth
              accessibilityHint={
                locked
                  ? t
                    ? 'No disponible: la reserva está bloqueada.'
                    : 'Unavailable: reservation is locked.'
                  : !timeSlot
                    ? t
                      ? 'Elige una hora para continuar.'
                      : 'Pick a time to continue.'
                    : undefined
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    flex: 1,
  },

  skeletonWrap: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[5],
    gap: Spacing[3],
  },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[10],
  },

  lockedCard: {
    marginTop: Spacing[5],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  venueCard: {
    marginTop: Spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  venueIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(201,169,97,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[1],
    marginBottom: Spacing[2],
  },
  fieldLabel: {
    ...TypePresets.label,
    color: Colors.textSecondary,
  },

  dateTile: {
    minWidth: 72,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  tileKicker: {
    ...TypePresets.label,
  },
  tileSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.bgCard,
  },
  tileDisabled: {
    opacity: 0.45,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  slotTile: {
    minWidth: 76,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[2],
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  counterBtnDisabled: {
    opacity: 0.45,
  },
  counterValue: {
    minWidth: 48,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.serifSemiBold,
  },

  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * 1.5,
  },

  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
  },
});
