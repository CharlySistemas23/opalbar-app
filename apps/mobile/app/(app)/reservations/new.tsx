import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { reservationsApi, venueApi, eventsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_TIME_SLOTS = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];

/**
 * Build the available reservation slots from the venue's openTime/closeTime/slotMinutes.
 * Handles venues that close past midnight (e.g. open 20:00, close 02:00).
 * Returns DEFAULT_TIME_SLOTS if the venue has no config yet.
 */
function buildSlotsFromVenue(venue: { openTime?: string | null; closeTime?: string | null; slotMinutes?: number | null }): string[] {
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
  // Closes past midnight — add 24h so the loop covers the right range.
  if (end <= start) end += 24 * 60;

  const out: string[] = [];
  // Stop a bit before close so last slot fits in opening hours.
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
  const { venueId: venueIdParam, eventId: eventIdParam } = useLocalSearchParams<{ venueId: string; eventId: string }>();
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
  // When coming from an event we pre-fill date + time but keep them EDITABLE.
  // Users often want an earlier/later seating; forcing them to back out of the
  // screen to change it was confusing. `dateLocked` is no longer set to true.
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
      Alert.alert(
        t ? '¡Reserva creada!' : 'Reservation created!',
        t ? 'Te esperamos. Revisa tus reservas.' : 'We look forward to seeing you.',
        [{ text: 'OK', onPress: () => router.replace('/(app)/reservations/my') }],
      );
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t ? 'Reservar mesa' : 'Book a table'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 + insets.bottom, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {lockedToEvent && event && (
            <View style={styles.eventBanner}>
              <View style={styles.eventBannerIcon}>
                <Feather name="star" size={18} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventBannerLabel}>
                  {t ? 'Mesa para el evento' : 'Table for event'}
                </Text>
                <Text style={styles.eventBannerTitle} numberOfLines={1}>
                  {t ? event.title : (event.titleEn || event.title)}
                </Text>
                {typeof event.maxCapacity === 'number' && (
                  <Text style={styles.eventBannerMeta}>
                    {t ? 'Cupo: ' : 'Capacity: '}{event.currentCapacity ?? 0}/{event.maxCapacity}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Venue card */}
          <View style={styles.venueCard}>
            <View style={styles.venueIcon}>
              <Feather name="map-pin" size={18} color={Colors.accentPrimary} />
            </View>
            <View>
              <Text style={styles.venueLabel}>{t ? 'Local' : 'Venue'}</Text>
              <Text style={styles.venueName}>{venueName}</Text>
            </View>
          </View>

          {/* Date */}
          <View>
            <Text style={styles.sectionLabel}>{t ? 'Fecha' : 'Date'}</Text>
            {lockedToEvent ? (
              <View style={styles.lockedRow}>
                <Feather name="lock" size={14} color={Colors.textMuted} />
                <Text style={styles.lockedText}>
                  {new Date(dateStr).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
              {days.map((d) => {
                const iso = formatDate(d);
                const selected = iso === dateStr;
                const day = d.getDate();
                const weekday = d.toLocaleDateString(language, { weekday: 'short' }).replace('.', '');
                const month = d.toLocaleDateString(language, { month: 'short' }).replace('.', '');
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[styles.dateChip, selected && styles.dateChipActive]}
                    onPress={() => setDateStr(iso)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dateChipDay, selected && { color: Colors.textInverse }]}>{day}</Text>
                    <Text style={[styles.dateChipSub, selected && { color: Colors.textInverse, opacity: 0.9 }]}>
                      {weekday}
                    </Text>
                    <Text style={[styles.dateChipMonth, selected && { color: Colors.textInverse, opacity: 0.8 }]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            )}
          </View>

          {/* Time */}
          <View>
            <Text style={styles.sectionLabel}>{t ? 'Horario' : 'Time'}</Text>
            {lockedToEvent ? (
              <View style={styles.lockedRow}>
                <Feather name="lock" size={14} color={Colors.textMuted} />
                <Text style={styles.lockedText}>{timeSlot || '—'}</Text>
              </View>
            ) : (
            <View style={styles.timeGrid}>
              {timeSlots.map((slot) => {
                const selected = slot === timeSlot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeChip, selected && styles.timeChipActive]}
                    onPress={() => setTimeSlot(slot)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.timeText, selected && styles.timeTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            )}
          </View>

          {/* Party size */}
          <View>
            <Text style={styles.sectionLabel}>{t ? 'Personas' : 'Party size'}</Text>
            <View style={styles.partyRow}>
              {PARTY_SIZES.map((n) => {
                const selected = n === partySize;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.partyChip, selected && styles.partyChipActive]}
                    onPress={() => setPartySize(n)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.partyText, selected && styles.partyTextActive]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View>
            <Text style={styles.sectionLabel}>{t ? 'Notas (opcional)' : 'Notes (optional)'}</Text>
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={t ? 'Cumpleaños, celiaco, silla alta…' : 'Birthday, gluten-free, high chair…'}
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        {/* CTA — uses safe area inset so it clears the home indicator. */}
        <View style={[styles.cta, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <>
                  <Feather name="calendar" size={18} color={Colors.textInverse} />
                  <Text style={styles.ctaLabel}>
                    {t ? 'Confirmar reserva' : 'Confirm booking'}
                  </Text>
                </>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  eventBannerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  eventBannerLabel: { color: '#A855F7', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  eventBannerTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  eventBannerMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', flex: 1 },

  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 14,
    marginTop: 8,
  },
  venueIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  venueLabel: { color: Colors.textMuted, fontSize: 11 },
  venueName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },

  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },

  dateChip: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  dateChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  dateChipDay: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  dateChipSub: { color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase' },
  dateChipMonth: { color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase' },

  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  timeChipActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  timeText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  timeTextActive: { color: Colors.textInverse, fontWeight: '700' },

  partyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  partyChip: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  partyChipActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  partyText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  partyTextActive: { color: Colors.textInverse },

  notesBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    minHeight: 96,
  },
  notesInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
    minHeight: 72,
  },

  cta: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  ctaLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
});
