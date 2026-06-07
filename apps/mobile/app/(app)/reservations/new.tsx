// ─────────────────────────────────────────────
//  New Reservation — 4-step Wizard (OpenTable Premium feel)
//
//  Brief usuario: NO formulario plano. Wizard secuencial.
//    Step 1 — Fecha (horizontal scroll de días)
//    Step 2 — Hora  (grid de slots)
//    Step 3 — Mesa  (visual: zona + asientos alrededor de la mesa)
//    Step 4 — Confirmación (resumen + CTA)
//
//  Reduce abandono: una decisión por pantalla, progreso visible.
//  Logic preservada: eventsApi/venueApi/reservationsApi calls intactas.
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
  Subhead,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { eventsApi, reservationsApi, venueApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { useAuthStore } from '@/stores/auth.store';
import { resolveTier } from '@/constants/tiers';
import { Text } from 'react-native';

const DEFAULT_TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00',
];

const ZONES: Array<{ key: string; labelEs: string; labelEn: string; capacity: number[] }> = [
  { key: 'bar', labelEs: 'Barra', labelEn: 'Bar', capacity: [1, 2] },
  { key: 'lounge', labelEs: 'Lounge', labelEn: 'Lounge', capacity: [2, 4, 6] },
  { key: 'terrace', labelEs: 'Terraza', labelEn: 'Terrace', capacity: [2, 4, 6, 8] },
  { key: 'private', labelEs: 'Privado', labelEn: 'Private', capacity: [6, 8, 10] },
];

function buildSlotsFromVenue(venue: {
  openTime?: string | null;
  closeTime?: string | null;
  slotMinutes?: number | null;
}): string[] {
  const open = venue.openTime;
  const close = venue.closeTime;
  const step = venue.slotMinutes ?? 30;
  if (!open || !close || !step) return DEFAULT_TIME_SLOTS;
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const fromMin = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  let start = toMin(open);
  let end = toMin(close);
  if (end <= start) end += 24 * 60;
  const out: string[] = [];
  for (let t = start; t <= end - step; t += step) out.push(fromMin(t));
  return out.length > 0 ? out : DEFAULT_TIME_SLOTS;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDays(count = 14): Date[] {
  const result: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push(d);
  }
  return result;
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [venueId, setVenueId] = useState<string | null>(venueIdParam || null);
  const [venueName, setVenueName] = useState<string>('OPALBAR');
  const [dateObj, setDateObj] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [zone, setZone] = useState<typeof ZONES[number]>(ZONES[1]);
  const [partySize, setPartySize] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);
  const [party, setParty] = useState(false);

  useEffect(() => {
    if (eventIdParam) {
      eventsApi.get(eventIdParam).then((r) => {
        const ev = r.data?.data;
        if (!ev) return;
        if (ev.venue?.id) {
          setVenueId(ev.venue.id);
          setVenueName(ev.venue.name || 'OPALBAR');
        }
        if (ev.startDate) {
          const d = new Date(ev.startDate);
          d.setHours(0, 0, 0, 0);
          setDateObj(d);
          const hh = String(new Date(ev.startDate).getHours()).padStart(2, '0');
          const mm = String(new Date(ev.startDate).getMinutes()).padStart(2, '0');
          setTimeSlot(`${hh}:${mm}`);
        }
      }).catch(() => {});
      return;
    }
    if (!venueId) {
      venueApi.list({}).then((r) => {
        const first = r.data?.data?.data?.[0] ?? r.data?.data?.[0];
        if (first) {
          setVenueId(first.id);
          setVenueName(first.name || 'OPALBAR');
          setTimeSlots(buildSlotsFromVenue(first));
        }
      }).catch(() => {});
    } else {
      venueApi.get(venueId).then((r) => {
        const v = r.data?.data;
        if (v?.name) setVenueName(v.name);
        if (v) setTimeSlots(buildSlotsFromVenue(v));
      }).catch(() => {});
    }
  }, [venueId, eventIdParam]);

  async function handleSubmit() {
    let vid = venueId;
    if (!vid) {
      try {
        const r = await venueApi.list({});
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
        date: formatDateISO(dateObj),
        timeSlot,
        partySize,
        specialRequests:
          [zone.key !== 'lounge' ? `Zona: ${t ? zone.labelEs : zone.labelEn}` : null, notes.trim() || null]
            .filter(Boolean)
            .join(' · ') || undefined,
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
    if (step === 1) return !!dateObj;
    if (step === 2) return !!timeSlot;
    if (step === 3) return !!zone && partySize > 0;
    return true;
  }, [step, dateObj, timeSlot, zone, partySize]);

  const stepLabels: Record<1 | 2 | 3 | 4, { es: string; en: string }> = {
    1: { es: 'FECHA', en: 'DATE' },
    2: { es: 'HORA', en: 'TIME' },
    3: { es: 'MESA', en: 'TABLE' },
    4: { es: 'CONFIRMAR', en: 'CONFIRM' },
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
            onPress={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : router.back())}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Atrás' : 'Back'}
            hitSlop={HitSlop.expand}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((n) => (
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
              {t ? `PASO ${step} DE 4` : `STEP ${step} OF 4`} ·{' '}
              {(t ? stepLabels[step].es : stepLabels[step].en)}
            </Kicker>
            <Heading size="lg" style={{ marginTop: Spacing[2] }}>
              {step === 1 && (t ? '¿Cuándo nos visitas?' : 'When are you joining us?')}
              {step === 2 && (t ? 'Elige una hora.' : 'Pick a time.')}
              {step === 3 && (t ? 'Elige tu mesa.' : 'Pick your table.')}
              {step === 4 && (t ? 'Confirma tu reserva.' : 'Confirm your reservation.')}
            </Heading>
          </FadeIn>

          {step === 1 && (
            <StepDate dateObj={dateObj} setDateObj={setDateObj} language={language} tierColor={tier.base} />
          )}

          {step === 2 && (
            <StepTime
              slots={timeSlots}
              timeSlot={timeSlot}
              setTimeSlot={setTimeSlot}
              tierColor={tier.base}
            />
          )}

          {step === 3 && (
            <StepTable
              zone={zone}
              setZone={setZone}
              partySize={partySize}
              setPartySize={setPartySize}
              t={t}
              tierColor={tier.base}
            />
          )}

          {step === 4 && (
            <StepConfirm
              venueName={venueName}
              dateObj={dateObj}
              timeSlot={timeSlot}
              zone={zone}
              partySize={partySize}
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
                step < 4
                  ? t
                    ? 'Continuar'
                    : 'Continue'
                  : t
                    ? 'Confirmar reserva'
                    : 'Confirm reservation'
              }
              onPress={() => {
                if (step < 4) {
                  setStep((s) => (s + 1) as 2 | 3 | 4);
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
  dateObj,
  setDateObj,
  language,
  tierColor,
}: {
  dateObj: Date;
  setDateObj: (d: Date) => void;
  language: string;
  tierColor: string;
}) {
  const days = nextDays(21);
  const selectedISO = formatDateISO(dateObj);
  return (
    <View style={{ marginTop: Spacing[8] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing[2], paddingHorizontal: EditorialSpacing.pageGutter }}
        style={{ marginHorizontal: -EditorialSpacing.pageGutter }}
      >
        {days.map((d) => {
          const iso = formatDateISO(d);
          const selected = iso === selectedISO;
          const weekday = d.toLocaleDateString(language, { weekday: 'short' });
          const day = d.getDate();
          const month = d.toLocaleDateString(language, { month: 'short' });
          return (
            <Pressy
              key={iso}
              onPress={() => setDateObj(d)}
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

// ── Step 2 — Time ────────────────────────────
function StepTime({
  slots,
  timeSlot,
  setTimeSlot,
  tierColor,
}: {
  slots: string[];
  timeSlot: string;
  setTimeSlot: (s: string) => void;
  tierColor: string;
}) {
  return (
    <View style={[styles.grid, { marginTop: Spacing[8] }]}>
      {slots.map((slot) => {
        const selected = slot === timeSlot;
        return (
          <Pressy
            key={slot}
            onPress={() => setTimeSlot(slot)}
            haptic="select"
            accessibilityRole={Roles.button}
            accessibilityLabel={slot}
            accessibilityState={{ selected }}
            style={[
              styles.slotTile,
              selected ? { borderColor: tierColor, backgroundColor: Colors.bgCard } : null,
            ]}
          >
            <Text
              style={[
                TypePresets.subhead,
                { color: selected ? Colors.textPrimary : Colors.textSecondary },
              ]}
            >
              {slot}
            </Text>
          </Pressy>
        );
      })}
    </View>
  );
}

// ── Step 3 — Table (visual zone + seats) ─────
function StepTable({
  zone,
  setZone,
  partySize,
  setPartySize,
  t,
  tierColor,
}: {
  zone: typeof ZONES[number];
  setZone: (z: typeof ZONES[number]) => void;
  partySize: number;
  setPartySize: (n: number) => void;
  t: boolean;
  tierColor: string;
}) {
  const seats = useMemo(() => zone.capacity.filter((c) => c >= partySize)[0] ?? Math.max(...zone.capacity), [zone, partySize]);

  return (
    <View style={{ marginTop: Spacing[8] }}>
      {/* Zone selector */}
      <View style={styles.zoneRow}>
        {ZONES.map((z) => {
          const selected = z.key === zone.key;
          return (
            <Pressy
              key={z.key}
              onPress={() => {
                setZone(z);
                if (!z.capacity.includes(partySize)) {
                  setPartySize(z.capacity[0]);
                }
              }}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? z.labelEs : z.labelEn}
              accessibilityState={{ selected }}
              style={[
                styles.zoneTile,
                selected ? { borderColor: tierColor, backgroundColor: Colors.bgCard } : null,
              ]}
            >
              <Caption tone={selected ? 'primary' : 'muted'}>
                {(t ? z.labelEs : z.labelEn).toUpperCase()}
              </Caption>
            </Pressy>
          );
        })}
      </View>

      {/* Visual table with seats around */}
      <View style={styles.tableVizWrap}>
        <View style={styles.tableViz}>
          <View style={[styles.tableSurface, { borderColor: tierColor }]}>
            <Body size="sm" tone="muted">
              {z(zone, t)}
            </Body>
            <Caption tone="muted" style={{ marginTop: 2 }}>
              {partySize} {t ? 'INVITADOS' : 'GUESTS'}
            </Caption>
          </View>
          <SeatRing count={seats} active={partySize} tierColor={tierColor} />
        </View>
      </View>

      {/* Party size +/- */}
      <View style={styles.partyRow}>
        <Pressy
          onPress={() => {
            const minP = Math.min(...zone.capacity);
            if (partySize > minP) setPartySize(partySize - 1);
          }}
          disabled={partySize <= Math.min(...zone.capacity)}
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
          onPress={() => {
            const maxP = Math.max(...zone.capacity);
            if (partySize < maxP) setPartySize(partySize + 1);
          }}
          disabled={partySize >= Math.max(...zone.capacity)}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Añadir invitado' : 'Add guest'}
          style={[styles.partyBtn, { borderColor: Colors.border }]}
        >
          <Feather name="plus" size={18} color={Colors.textPrimary} />
        </Pressy>
      </View>
    </View>
  );
}

function z(zone: typeof ZONES[number], t: boolean) {
  return t ? zone.labelEs : zone.labelEn;
}

function SeatRing({
  count,
  active,
  tierColor,
}: {
  count: number;
  active: number;
  tierColor: string;
}) {
  const radius = 88;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        const filled = i < active;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              transform: [{ translateX: dx }, { translateY: dy }],
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: filled ? tierColor : Colors.border,
              backgroundColor: filled ? tierColor : 'transparent',
            }}
          />
        );
      })}
    </View>
  );
}

// ── Step 4 — Confirm ─────────────────────────
function StepConfirm({
  venueName,
  dateObj,
  timeSlot,
  zone,
  partySize,
  notes,
  setNotes,
  language,
  t,
}: {
  venueName: string;
  dateObj: Date;
  timeSlot: string;
  zone: typeof ZONES[number];
  partySize: number;
  notes: string;
  setNotes: (s: string) => void;
  language: string;
  t: boolean;
}) {
  const dateLabel = dateObj.toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const rows = [
    { label: t ? 'LUGAR' : 'VENUE', value: venueName },
    { label: t ? 'FECHA' : 'DATE', value: dateLabel },
    { label: t ? 'HORA' : 'TIME', value: timeSlot },
    { label: t ? 'ZONA' : 'ZONE', value: t ? zone.labelEs : zone.labelEn },
    { label: t ? 'INVITADOS' : 'GUESTS', value: String(partySize) },
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
        accessibilityLabel={t ? 'Notas' : 'Notes'}
        style={styles.notesInput}
      />
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

  // Step 3
  zoneRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  zoneTile: {
    flex: 1,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  tableVizWrap: {
    marginTop: Spacing[8],
    alignItems: 'center',
  },
  tableViz: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tableSurface: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Step 4
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
