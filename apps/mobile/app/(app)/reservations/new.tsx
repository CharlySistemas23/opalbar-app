// ─────────────────────────────────────────────
//  New Reservation — Editorial Premium
//
//  Editorial form: kicker + Display title, then four editorial sections
//  (venue, date, time, party, notes) separated by hairlines. Sticky
//  primary CTA at the foot.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
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
  Display,
  FadeIn,
  Hairline,
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

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00',
];

/**
 * Build the available reservation slots from the venue's openTime/closeTime/slotMinutes.
 * Handles venues that close past midnight (e.g. open 20:00, close 02:00).
 * Returns DEFAULT_TIME_SLOTS if the venue has no config yet.
 */
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

function formatDate(d: Date): string {
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
  const t = language === 'es';
  const fb = useFeedback();
  const insets = useSafeAreaInsets();

  const [venueId, setVenueId] = useState<string | null>(venueIdParam || null);
  const [venueName, setVenueName] = useState<string>('OPALBAR');
  const [dateStr, setDateStr] = useState<string>(formatDate(new Date()));
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);
  const [party, setParty] = useState(false);

  // Coming from an event we pre-fill date+time but keep them EDITABLE.
  const lockedToEvent = false;

  useEffect(() => {
    if (eventIdParam) {
      eventsApi.get(eventIdParam).then((r) => {
        const ev = r.data?.data;
        if (!ev) return;
        setEvent(ev);
        if (ev.venue?.id) {
          setVenueId(ev.venue.id);
          setVenueName(ev.venue.name || 'OPALBAR');
        }
        if (ev.startDate) {
          const d = new Date(ev.startDate);
          setDateStr(formatDate(d));
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
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
      Alert.alert(t ? 'Error' : 'Error', t ? 'No hay local disponible. Intenta de nuevo.' : 'No venue available. Try again.');
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

  const days = nextDays(14);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Confetti visible={party} onDone={() => setParty(false)} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressy
            onPress={() => router.back()}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Volver' : 'Back'}
            hitSlop={HitSlop.expand}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'NUEVA RESERVA' : 'NEW BOOKING'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{t ? 'Reservar mesa.' : 'Book a table.'}</Display>
          </FadeIn>

          {lockedToEvent && event ? (
            <FadeIn delay={160} style={{ marginTop: Spacing[6] }}>
              <Kicker tone="champagne">
                {t ? 'MESA PARA EL EVENTO' : 'TABLE FOR EVENT'}
              </Kicker>
              <Subhead style={{ marginTop: Spacing[2] }}>
                {t ? event.title : event.titleEn || event.title}
              </Subhead>
              {typeof event.maxCapacity === 'number' ? (
                <Caption tone="muted" style={{ marginTop: Spacing[1] }}>
                  {t ? 'Cupo: ' : 'Capacity: '}{event.currentCapacity ?? 0}/{event.maxCapacity}
                </Caption>
              ) : null}
            </FadeIn>
          ) : null}

          {/* Venue ─────────────────────────── */}
          <FadeIn delay={180} style={styles.section}>
            <Kicker tone="muted">{t ? 'LOCAL' : 'VENUE'}</Kicker>
            <View style={{ marginTop: Spacing[2], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
              <Feather name="map-pin" size={14} color={Colors.accentPrimary} />
              <Subhead>{venueName}</Subhead>
            </View>
          </FadeIn>

          <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />

          {/* Date ────────────────────────── */}
          <FadeIn delay={240} style={styles.section}>
            <Kicker tone="muted">{t ? 'FECHA' : 'DATE'}</Kicker>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing[2], paddingRight: EditorialSpacing.pageGutter }}
              style={{ marginTop: Spacing[3] }}
            >
              {days.map((d) => {
                const iso = formatDate(d);
                const selected = iso === dateStr;
                const day = d.getDate();
                const weekday = d.toLocaleDateString(language, { weekday: 'short' }).replace('.', '');
                const month = d.toLocaleDateString(language, { month: 'short' }).replace('.', '');
                return (
                  <Pressy
                    key={iso}
                    onPress={() => setDateStr(iso)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={`${weekday} ${day} ${month}`}
                    accessibilityState={{ selected }}
                    haptic="select"
                    style={[styles.dateChip, selected && styles.dateChipActive]}
                  >
                    <Caption tone={selected ? 'inverse' : 'muted'} style={styles.dateChipTopText}>
                      {weekday.toUpperCase()}
                    </Caption>
                    <Body size="lg" tone={selected ? 'inverse' : 'primary'} weight="semiBold" style={{ marginTop: 2 }}>
                      {day}
                    </Body>
                    <Caption tone={selected ? 'inverse' : 'muted'} style={styles.dateChipTopText}>
                      {month.toUpperCase()}
                    </Caption>
                  </Pressy>
                );
              })}
            </ScrollView>
          </FadeIn>

          <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />

          {/* Time ────────────────────────── */}
          <FadeIn delay={300} style={styles.section}>
            <Kicker tone="muted">{t ? 'HORARIO' : 'TIME'}</Kicker>
            <View style={styles.timeGrid}>
              {timeSlots.map((slot) => {
                const selected = slot === timeSlot;
                return (
                  <Pressy
                    key={slot}
                    onPress={() => setTimeSlot(slot)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={slot}
                    accessibilityState={{ selected }}
                    haptic="select"
                    style={[styles.timeChip, selected && styles.timeChipActive]}
                  >
                    <Body size="sm" tone={selected ? 'inverse' : 'secondary'} weight={selected ? 'semiBold' : 'regular'}>
                      {slot}
                    </Body>
                  </Pressy>
                );
              })}
            </View>
          </FadeIn>

          <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />

          {/* Party size ────────────────── */}
          <FadeIn delay={360} style={styles.section}>
            <Kicker tone="muted">{t ? 'PERSONAS' : 'PARTY SIZE'}</Kicker>
            <View style={styles.partyRow}>
              {PARTY_SIZES.map((n) => {
                const selected = n === partySize;
                return (
                  <Pressy
                    key={n}
                    onPress={() => setPartySize(n)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={`${n}`}
                    accessibilityState={{ selected }}
                    haptic="select"
                    style={[styles.partyChip, selected && styles.partyChipActive]}
                  >
                    <Body size="md" tone={selected ? 'inverse' : 'secondary'} weight="semiBold">
                      {n}
                    </Body>
                  </Pressy>
                );
              })}
            </View>
          </FadeIn>

          <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />

          {/* Notes ──────────────────────── */}
          <FadeIn delay={420} style={styles.section}>
            <Kicker tone="muted">{t ? 'NOTAS (OPCIONAL)' : 'NOTES (OPTIONAL)'}</Kicker>
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={t ? 'Cumpleaños, celiaco, silla alta…' : 'Birthday, gluten-free, high chair…'}
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                accessibilityLabel={t ? 'Notas' : 'Notes'}
              />
            </View>
          </FadeIn>
        </ScrollView>

        {/* Sticky CTA ─────────────────────── */}
        <View style={[styles.ctaWrap, { paddingBottom: Spacing[4] + insets.bottom }]}>
          <Hairline variant="subtle" />
          <View style={styles.ctaInner}>
            <Button
              label={t ? 'Confirmar reserva' : 'Confirm booking'}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              variant="primary"
              size="lg"
              fullWidth
              haptic="success"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerRow: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
  },
  section: { marginTop: Spacing[6] },

  dateChip: {
    minWidth: 60,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  dateChipTopText: { letterSpacing: 1.2 },

  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[3],
  },
  timeChip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },

  partyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[3],
  },
  partyChip: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },

  notesBox: {
    marginTop: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    padding: Spacing[4],
    minHeight: 110,
  },
  notesInput: {
    flex: 1,
    color: Colors.textPrimary,
    ...TypePresets.body,
    padding: 0,
    minHeight: 80,
  },

  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgPrimary,
  },
  ctaInner: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
  },
});
