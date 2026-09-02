// ─────────────────────────────────────────────
//  New Reservation — 3-step Wizard (OpenTable Premium feel)
//
//  Step 1 — Fecha (horizontal scroll of venue-local days)
//  Step 2 — Hora  (grid of REAL slots from the availability endpoint —
//                  full/past/blocked slots render disabled with a reason)
//  Step 3 — Invitados + notas + resumen + confirm CTA
//
//  There used to be a "Zona" step (Barra/Lounge/Terraza/Privado) that
//  doesn't exist anywhere in the backend — it was being smuggled into
//  `specialRequests` as free text ("Zona: Lounge · <notes>"), which read
//  back to the guest as if it were a real seating choice. Removed.
//
//  Dates are handled as `'YYYY-MM-DD'` strings (Mexico-local calendar
//  days) end to end — never a bare `Date` object — so nothing shifts a
//  day when the device's timezone isn't Mexico City.
// ─────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  Confetti,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Pressy,
  Skeleton,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, reservationsApi, venueApi, type AvailabilitySlot } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useAuthStore } from '@/stores/auth.store';
import { resolveTier } from '@/constants/tiers';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import {
  formatDateOnly,
  formatTimeSlot,
  nextDaysMx,
  nowTimeMx,
  parseDateOnly,
  todayMx,
  toMinutes,
} from '@/utils/date';

const MIN_PARTY = 1;
const MAX_PARTY_CAP = 12;
const NOTES_MAX_LENGTH = 480;

function pickNearestAvailableSlot(slots: AvailabilitySlot[], hhmm: string): AvailabilitySlot | undefined {
  const target = toMinutes(hhmm);
  if (target == null) return undefined;
  let best: AvailabilitySlot | undefined;
  let bestDiff = Infinity;
  for (const s of slots) {
    if (!s.available) continue;
    const m = toMinutes(s.time);
    if (m == null) continue;
    const diff = Math.abs(m - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

interface AvailabilityPayload {
  date: string;
  today: string;
  reservationsEnabled: boolean;
  openTime: string | null;
  closeTime: string | null;
  slotMinutes: number;
  capacity: number;
  slots: AvailabilitySlot[];
}

export default function NewReservation() {
  const { venueId: venueIdParam, eventId: eventIdParam } =
    useLocalSearchParams<{ venueId: string; eventId: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const { user } = useAuthStore();
  const t = language === 'es';
  const fb = useFeedback();
  const insets = useSafeAreaInsets();
  const tier = resolveTier(user?.profile?.loyaltyLevel?.name);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [venueId, setVenueId] = useState<string | null>(venueIdParam || null);
  const [venueName, setVenueName] = useState<string>('OPALBAR');
  const [dateStr, setDateStr] = useState<string>(() => todayMx());
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [party, setParty] = useState(false);

  const [availability, setAvailability] = useState<AvailabilityPayload | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Set once from the event's start time (Mexico-local), consumed the first
  // time availability for that day loads so we can snap to a real slot.
  const pendingEventTimeRef = useRef<string | null>(null);

  // ── Resolve the venue (from an event, an explicit venueId, or the first
  //    active venue) — runs once per route params, not on every render. ──
  useEffect(() => {
    if (eventIdParam) {
      eventsApi
        .get(eventIdParam)
        .then((r) => {
          const ev = r.data?.data;
          if (!ev) return;
          if (ev.venue?.id) {
            setVenueId(ev.venue.id);
            setVenueName(ev.venue.name || 'OPALBAR');
          }
          if (ev.startDate) {
            const evDate = new Date(ev.startDate);
            // Mexico-local calendar day + wall-clock time of the event —
            // never the device's own timezone reading of the UTC instant.
            pendingEventTimeRef.current = nowTimeMx(evDate);
            setDateStr(todayMx(evDate));
          }
        })
        .catch(() => {});
      return;
    }
    if (venueIdParam) {
      venueApi
        .get(venueIdParam)
        .then((r) => {
          const v = r.data?.data;
          if (v?.name) setVenueName(v.name);
        })
        .catch(() => {});
      return;
    }
    venueApi
      .list({ limit: 1 })
      .then((r) => {
        const first = r.data?.data?.data?.[0] ?? r.data?.data?.[0];
        if (first) {
          setVenueId(first.id);
          setVenueName(first.name || 'OPALBAR');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdParam, venueIdParam]);

  const loadAvailability = () => {
    if (!venueId) return;
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    reservationsApi
      .availability(venueId, dateStr)
      .then((r) => {
        const data: AvailabilityPayload | undefined = r.data?.data;
        setAvailability(data ?? null);
        const slots = data?.slots ?? [];
        if (pendingEventTimeRef.current) {
          const hint = pendingEventTimeRef.current;
          pendingEventTimeRef.current = null;
          const exact = slots.find((s) => s.time === hint && s.available);
          const nearest = exact ?? pickNearestAvailableSlot(slots, hint);
          if (nearest) setTimeSlot(nearest.time);
        } else {
          // Keep the current pick only if it's still on offer for this date.
          setTimeSlot((prev) => {
            if (!prev) return prev;
            const stillOk = slots.find((s) => s.time === prev && s.available);
            return stillOk ? prev : '';
          });
        }
      })
      .catch((err) => setAvailabilityError(apiError(err)))
      .finally(() => setAvailabilityLoading(false));
  };

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, dateStr]);

  // Clamp party size to the chosen slot's remaining capacity (never below 1).
  const selectedSlot = availability?.slots.find((s) => s.time === timeSlot);
  const maxParty = selectedSlot ? Math.max(MIN_PARTY, Math.min(MAX_PARTY_CAP, selectedSlot.remaining)) : MAX_PARTY_CAP;
  useEffect(() => {
    setPartySize((prev) => Math.min(prev, maxParty));
  }, [maxParty]);

  async function handleSubmit() {
    let vid = venueId;
    if (!vid) {
      try {
        const r = await venueApi.list({ limit: 1 });
        const first = r.data?.data?.data?.[0] ?? r.data?.data?.[0];
        if (first?.id) { vid = first.id; setVenueId(first.id); }
      } catch {}
    }
    if (!vid) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'No hay local disponible.' : 'No venue available.');
      return;
    }
    if (!timeSlot) {
      Alert.alert(t ? 'Falta horario' : 'Time missing', t ? 'Elige una hora.' : 'Pick a time.');
      return;
    }
    setLoading(true);
    try {
      await reservationsApi.create({
        venueId: vid,
        eventId: eventIdParam || undefined,
        date: dateStr,
        timeSlot,
        partySize,
        specialRequests: notes.trim() || undefined,
      });
      fb.success();
      setParty(true);
      setTimeout(() => {
        Alert.alert(
          t ? '¡Reserva creada!' : 'Reservation created!',
          t ? 'Te esperamos. Revisa tus reservas.' : 'We look forward to seeing you.',
          [{ text: 'OK', onPress: () => router.replace('/(app)/reservations/my') }],
        );
      }, 350);
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setLoading(false);
    }
  }

  const canContinue = useMemo(() => {
    if (step === 1) return !!dateStr;
    if (step === 2) return !!timeSlot && !!availability?.reservationsEnabled;
    return partySize >= MIN_PARTY;
  }, [step, dateStr, timeSlot, availability, partySize]);

  const stepLabels: Record<1 | 2 | 3, { es: string; en: string }> = {
    1: { es: 'FECHA', en: 'DATE' },
    2: { es: 'HORA', en: 'TIME' },
    3: { es: 'CONFIRMAR', en: 'CONFIRM' },
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with back + progress */}
        <View style={styles.header}>
          <Pressy
            onPress={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2) : router.back())}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Atrás' : 'Back'}
            hitSlop={HitSlop.expand}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
          <View style={styles.progressRow}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[
                  styles.progressDot,
                  n <= step
                    ? { backgroundColor: tier.base, width: 24 }
                    : { backgroundColor: Colors.border },
                ]}
              />
            ))}
          </View>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn key={`step-${step}`}>
            <Kicker tone="muted">
              {t ? `PASO ${step} DE 3` : `STEP ${step} OF 3`} ·{' '}
              {(t ? stepLabels[step].es : stepLabels[step].en)}
            </Kicker>
            <Heading size="lg" style={{ marginTop: Spacing[2] }}>
              {step === 1 && (t ? '¿Cuándo nos visitas?' : 'When are you joining us?')}
              {step === 2 && (t ? 'Elige una hora.' : 'Pick a time.')}
              {step === 3 && (t ? 'Confirma tu reserva.' : 'Confirm your reservation.')}
            </Heading>
          </FadeIn>

          {step === 1 && (
            <StepDate dateStr={dateStr} setDateStr={setDateStr} language={language} tierColor={tier.base} />
          )}

          {step === 2 && (
            <StepTime
              availability={availability}
              loading={availabilityLoading}
              error={availabilityError}
              timeSlot={timeSlot}
              setTimeSlot={setTimeSlot}
              tierColor={tier.base}
              t={t}
              onRetry={loadAvailability}
            />
          )}

          {step === 3 && (
            <StepConfirm
              venueName={venueName}
              dateStr={dateStr}
              timeSlot={timeSlot}
              partySize={partySize}
              setPartySize={setPartySize}
              maxParty={maxParty}
              notes={notes}
              setNotes={setNotes}
              language={language}
              t={t}
            />
          )}
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[3] }]}>
          <Hairline variant="subtle" />
          <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[3] }}>
            <Button
              label={
                step < 3
                  ? t
                    ? 'Continuar'
                    : 'Continue'
                  : t
                    ? 'Confirmar reserva'
                    : 'Confirm reservation'
              }
              onPress={() => {
                if (step < 3) {
                  setStep((s) => (s + 1) as 2 | 3);
                } else {
                  handleSubmit();
                }
              }}
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!canContinue}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      <Confetti visible={party} onDone={() => setParty(false)} />
    </SafeAreaView>
  );
}

// ── Step 1 — Date ────────────────────────────
function StepDate({
  dateStr,
  setDateStr,
  language,
  tierColor,
}: {
  dateStr: string;
  setDateStr: (d: string) => void;
  language: string;
  tierColor: string;
}) {
  const days = nextDaysMx(21);
  return (
    <View style={{ marginTop: Spacing[8] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing[2], paddingHorizontal: EditorialSpacing.pageGutter }}
        style={{ marginHorizontal: -EditorialSpacing.pageGutter }}
      >
        {days.map((iso) => {
          const selected = iso === dateStr;
          const d = parseDateOnly(iso);
          if (!d) return null;
          const weekday = d.toLocaleDateString(language, { weekday: 'short' });
          const day = d.getDate();
          const month = d.toLocaleDateString(language, { month: 'short' });
          return (
            <Pressy
              key={iso}
              onPress={() => setDateStr(iso)}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={`${weekday} ${day} ${month}`}
              accessibilityState={{ selected }}
              style={[
                styles.dateTile,
                selected ? { borderColor: tierColor, backgroundColor: Colors.bgCard } : null,
              ]}
            >
              <Text style={[TypePresets.label, { color: selected ? tierColor : Colors.textMuted }]}>
                {weekday.toUpperCase()}
              </Text>
              <Text
                style={[
                  TypePresets.headingSm,
                  { color: Colors.textPrimary, marginTop: 2 },
                ]}
              >
                {day}
              </Text>
              <Text style={[TypePresets.caption, { color: Colors.textMuted, marginTop: 1 }]}>
                {month.toUpperCase()}
              </Text>
            </Pressy>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Step 2 — Time (real slots from the availability endpoint) ───────────
function StepTime({
  availability,
  loading,
  error,
  timeSlot,
  setTimeSlot,
  tierColor,
  t,
  onRetry,
}: {
  availability: AvailabilityPayload | null;
  loading: boolean;
  error: string | null;
  timeSlot: string;
  setTimeSlot: (s: string) => void;
  tierColor: string;
  t: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={[styles.grid, { marginTop: Spacing[8] }]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={72} height={52} radius={Radius.sm} />
        ))}
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ marginTop: Spacing[8], minHeight: 220 }}>
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={onRetry}
        />
      </View>
    );
  }
  if (!availability || !availability.reservationsEnabled) {
    return (
      <View style={{ marginTop: Spacing[8], minHeight: 220 }}>
        <EmptyState
          icon="calendar"
          title={t ? 'Sin reservas este día' : 'No reservations this day'}
          message={t ? 'Elige otra fecha para ver horarios disponibles.' : 'Pick another date to see available times.'}
        />
      </View>
    );
  }
  if (availability.slots.length === 0) {
    return (
      <View style={{ marginTop: Spacing[8], minHeight: 220 }}>
        <EmptyState
          icon="clock"
          title={t ? 'Sin horarios disponibles' : 'No time slots available'}
          message={t ? 'Elige otra fecha.' : 'Pick another date.'}
        />
      </View>
    );
  }

  const reasonLabel = (reason?: AvailabilitySlot['reason']) => {
    if (reason === 'past') return t ? 'Pasó' : 'Past';
    if (reason === 'full') return t ? 'Lleno' : 'Full';
    if (reason === 'blocked') return t ? 'No disp.' : 'Blocked';
    return '';
  };

  return (
    <View style={[styles.grid, { marginTop: Spacing[8] }]}>
      {availability.slots.map((slot) => {
        const selected = slot.time === timeSlot;
        const disabled = !slot.available;
        return (
          <Pressy
            key={slot.time}
            onPress={() => setTimeSlot(slot.time)}
            disabled={disabled}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={`${slot.time}${disabled ? ` · ${reasonLabel(slot.reason)}` : ''}`}
            accessibilityState={{ selected, disabled }}
            style={[
              styles.slotTile,
              selected ? { borderColor: tierColor, backgroundColor: Colors.bgCard } : null,
              disabled ? styles.slotTileDisabled : null,
            ]}
          >
            <Text
              style={[
                TypePresets.subhead,
                { color: disabled ? Colors.textMuted : selected ? Colors.textPrimary : Colors.textSecondary },
              ]}
            >
              {slot.time}
            </Text>
            {disabled ? (
              <Text style={[TypePresets.caption, { color: Colors.textMuted, marginTop: 2 }]}>
                {reasonLabel(slot.reason)}
              </Text>
            ) : null}
          </Pressy>
        );
      })}
    </View>
  );
}

// ── Step 3 — Confirm (guests + notes + summary) ──────────────────────
function StepConfirm({
  venueName,
  dateStr,
  timeSlot,
  partySize,
  setPartySize,
  maxParty,
  notes,
  setNotes,
  language,
  t,
}: {
  venueName: string;
  dateStr: string;
  timeSlot: string;
  partySize: number;
  setPartySize: (n: number) => void;
  maxParty: number;
  notes: string;
  setNotes: (s: string) => void;
  language: 'es' | 'en';
  t: boolean;
}) {
  const dateLabel = formatDateOnly(dateStr, language, { weekday: 'long', month: 'long' });
  const timeLabel = timeSlot ? formatTimeSlot(timeSlot, language) : '—';
  const rows = [
    { label: t ? 'LUGAR' : 'VENUE', value: venueName },
    { label: t ? 'FECHA' : 'DATE', value: dateLabel },
    { label: t ? 'HORA' : 'TIME', value: timeLabel },
  ];
  return (
    <View style={{ marginTop: Spacing[6] }}>
      <View style={styles.summaryShell}>
        {rows.map((r, i) => (
          <View key={r.label}>
            <View style={styles.summaryRow}>
              <Kicker tone="muted">{r.label}</Kicker>
              <Body size="sm" weight="medium">
                {r.value}
              </Body>
            </View>
            {i < rows.length - 1 ? <Hairline variant="subtle" /> : null}
          </View>
        ))}
      </View>

      {/* Party size +/- */}
      <View style={styles.partyRow}>
        <Pressy
          onPress={() => partySize > MIN_PARTY && setPartySize(partySize - 1)}
          disabled={partySize <= MIN_PARTY}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Quitar invitado' : 'Remove guest'}
          style={[styles.partyBtn, { borderColor: Colors.border }]}
        >
          <Feather name="minus" size={18} color={Colors.textPrimary} />
        </Pressy>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[TypePresets.heading, { color: Colors.textPrimary }]}>{partySize}</Text>
          <Kicker tone="muted">{t ? 'INVITADOS' : 'GUESTS'}</Kicker>
        </View>
        <Pressy
          onPress={() => partySize < maxParty && setPartySize(partySize + 1)}
          disabled={partySize >= maxParty}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Añadir invitado' : 'Add guest'}
          style={[styles.partyBtn, { borderColor: Colors.border }]}
        >
          <Feather name="plus" size={18} color={Colors.textPrimary} />
        </Pressy>
      </View>
      {maxParty < MAX_PARTY_CAP ? (
        <Caption tone="muted" align="center" style={{ marginTop: Spacing[2] }}>
          {t ? `Máximo ${maxParty} para este horario` : `Max ${maxParty} for this time`}
        </Caption>
      ) : null}

      <Kicker tone="muted" style={{ marginTop: Spacing[6], marginBottom: Spacing[2] }}>
        {t ? 'NOTAS (OPCIONAL)' : 'NOTES (OPTIONAL)'}
      </Kicker>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t ? 'Alergias, ocasión especial…' : 'Allergies, special occasion…'}
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={3}
        maxLength={NOTES_MAX_LENGTH}
        accessibilityLabel={t ? 'Notas' : 'Notes'}
        style={styles.notesInput}
      />
      <Caption tone="muted" align="right" style={{ marginTop: Spacing[2] }}>
        {`${notes.length}/${NOTES_MAX_LENGTH}`}
      </Caption>
    </View>
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
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  progressDot: {
    height: 3,
    width: 12,
    borderRadius: 2,
  },
  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[10],
  },
  footer: {
    backgroundColor: Colors.bgPrimary,
  },

  // Step 1
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

  // Step 2
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  slotTile: {
    minWidth: 72,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  slotTileDisabled: {
    opacity: 0.4,
  },

  // Step 3
  summaryShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  partyRow: {
    marginTop: Spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  partyBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notesInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
