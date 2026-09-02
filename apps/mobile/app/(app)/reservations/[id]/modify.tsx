// ─────────────────────────────────────────────
//  Reservation · Modify — Editorial Premium
//
//  Pantalla de edición de una reserva existente. Lógica intacta
//  (reservationsApi.detail/modify); sólo cambia el chrome:
//   · Header back 40x40 + título centrado
//   · Hero kicker + heading
//   · Aviso de bloqueo como hairline card neutra (Kicker + Body)
//   · Card "Bar" usando primitives Card + Body
//   · DateTimeField (sin cambios, conserva su look)
//   · Counter con Pressy y Body Numeric centrado
//   · Notas como textarea bgCard hairline
//   · CTA primario sticky bottom (Button primary)
//
//  Reemplazo de Alert en éxito por toast() (no destructivo).
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
import { DateTimeField } from '@/components/DateTimeField';
import { toast } from '@/components/Toast';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets, Typography } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reservationsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';

function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ModifyReservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [venueName, setVenueName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    reservationsApi
      .detail(id)
      .then((r) => {
        const res = r.data?.data ?? r.data;
        setDate(toLocal(new Date(res.date)));
        setPartySize(res.partySize ?? 2);
        setNotes(res.specialRequests ?? '');
        setVenueName(res.venue?.name ?? '');
        setStatus(res.status ?? '');
      })
      .catch((err) => Alert.alert('Error', apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const locked = ['CANCELLED', 'COMPLETED', 'SEATED'].includes(status);

  async function save() {
    setSaving(true);
    try {
      await reservationsApi.modify(id!, { date, partySize, specialRequests: notes });
      toast(
        t ? 'Reserva actualizada' : 'Reservation updated',
        'success',
      );
      router.back();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setSaving(false);
    }
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
            <Skeleton width="100%" height={56} radius={Radius.md} />
            <Skeleton width="100%" height={56} radius={Radius.md} />
            <Skeleton width="100%" height={96} radius={Radius.md} />
          </View>
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
                    {t
                      ? 'Esta reserva ya no puede modificarse en su estado actual.'
                      : 'This reservation can no longer be modified in its current state.'}
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

            {/* Date & time ───────────────────── */}
            <FadeIn delay={260}>
              <DateTimeField
                label={t ? 'Fecha y hora' : 'Date & time'}
                value={date}
                onChange={setDate}
                minimumDate={new Date()}
              />
            </FadeIn>

            {/* Party size ────────────────────── */}
            <FadeIn delay={320} style={{ marginTop: Spacing[5] }}>
              <View style={styles.labelRow}>
                <Caption tone="secondary" style={styles.fieldLabel}>
                  {t ? 'PERSONAS' : 'GUESTS'}
                </Caption>
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
                  onPress={() => setPartySize((n) => Math.min(30, n + 1))}
                  disabled={locked || partySize >= 30}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={t ? 'Más personas' : 'Increase guests'}
                  hitSlop={HitSlop.expand}
                  haptic="select"
                  style={[
                    styles.counterBtn,
                    (locked || partySize >= 30) && styles.counterBtnDisabled,
                  ]}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color={locked || partySize >= 30 ? Colors.textDisabled : Colors.textPrimary}
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
        {!loading && (
          <View style={styles.footer}>
            <Button
              label={t ? 'Guardar cambios' : 'Save changes'}
              onPress={save}
              loading={saving}
              disabled={saving || locked}
              variant="primary"
              size="lg"
              haptic="success"
              fullWidth
              accessibilityHint={
                locked
                  ? t
                    ? 'No disponible: la reserva está bloqueada.'
                    : 'Unavailable: reservation is locked.'
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
    paddingHorizontal: Spacing[1],
    marginBottom: Spacing[2],
  },
  fieldLabel: {
    ...TypePresets.label,
    color: Colors.textSecondary,
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
