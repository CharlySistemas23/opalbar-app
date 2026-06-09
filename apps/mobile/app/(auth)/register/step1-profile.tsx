// ─────────────────────────────────────────────
//  Onboarding · Step 1 — Profile (Editorial Premium)
//
//  Layout = Figma canonical:
//   · SafeAreaView edges ['top','bottom'] fill bgPrimary
//   · Progress bar (1/4) + Kicker + Display headline + Lead
//   · Form cards: each field lives in a bgCard hairline pill with
//     uppercase Kicker label + Input/Pressable value
//   · Bottom CTAs: primary gold "Continuar" + ghost "Omitir"
//
//  Lógica intacta: usersApi.updateProfile + native DateTimePicker.
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { usersApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
  TypePresets,
} from '@/constants/tokens';
import { HitSlop } from '@/constants/a11y';
import { useFeedback } from '@/hooks/useFeedback';
import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Input,
  Kicker,
  Label,
  Lead,
  Pressy,
} from '@/components/ui';

const MAX_BIO = 160;
const MIN_BIRTH_YEAR = 1920;

function formatBirth(d: Date | null, locale: string): string {
  if (!d) return '';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function Step1Profile() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d;
  }, []);
  const minDate = useMemo(() => new Date(`${MIN_BIRTH_YEAR}-01-01`), []);

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(maxDate);
  const [city, setCity] = useState('Puerto Vallarta');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [occupation, setOccupation] = useState('');
  const [discoverySource, setDiscoverySource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const firstName = user?.profile?.firstName ?? '';

  const genderOptions: { key: string; label: string }[] = [
    { key: 'FEMALE', label: t ? 'Mujer' : 'Woman' },
    { key: 'MALE', label: t ? 'Hombre' : 'Man' },
    { key: 'NON_BINARY', label: t ? 'No binario' : 'Non-binary' },
    { key: 'OTHER', label: t ? 'Otro' : 'Other' },
    { key: 'PREFER_NOT_TO_SAY', label: t ? 'Prefiero no decirlo' : 'Prefer not to say' },
  ];

  const discoveryOptions: { key: string; label: string; icon: string }[] = [
    { key: 'INSTAGRAM', label: 'Instagram', icon: 'instagram' },
    { key: 'TIKTOK', label: 'TikTok', icon: 'music' },
    { key: 'FACEBOOK', label: 'Facebook', icon: 'facebook' },
    { key: 'GOOGLE', label: 'Google', icon: 'search' },
    { key: 'FRIEND', label: t ? 'Un amigo' : 'A friend', icon: 'users' },
    { key: 'WALKED_BY', label: t ? 'Pasé por el bar' : 'Walked by', icon: 'map-pin' },
    { key: 'EVENT', label: t ? 'Un evento' : 'An event', icon: 'calendar' },
    { key: 'INFLUENCER', label: t ? 'Un influencer' : 'An influencer', icon: 'star' },
    { key: 'OTHER', label: t ? 'Otro' : 'Other', icon: 'more-horizontal' },
  ];

  function onPickerChange(_: any, d?: Date) {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (d) setBirthDate(d);
    } else if (d) {
      setTempDate(d);
    }
  }

  function confirmDate() {
    fb.select();
    setBirthDate(tempDate);
    setPickerOpen(false);
  }

  async function handleNext() {
    fb.tap();
    setLoading(true);
    try {
      const payload: any = {};
      if (birthDate) payload.birthDate = birthDate.toISOString();
      if (city.trim()) payload.city = city.trim();
      if (bio.trim()) payload.bio = bio.trim();
      if (gender) payload.gender = gender;
      if (occupation.trim()) payload.occupation = occupation.trim();
      if (discoverySource) payload.discoverySource = discoverySource;
      if (Object.keys(payload).length > 0) {
        await usersApi.updateProfile(payload);
        await refreshUser();
      }
    } catch {
      // Non-blocking — user can edit later from Profile
    } finally {
      setLoading(false);
      router.replace('/(auth)/register/step2-interests' as never);
    }
  }

  function handleSkip() {
    router.replace('/(auth)/register/step2-interests' as never);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Progress 1/4 */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'PASO 1 DE 4' : 'STEP 1 OF 4'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">
              {firstName
                ? t
                  ? `Un placer,\n${firstName}.`
                  : `Nice to meet you,\n${firstName}.`
                : t
                  ? 'Un placer.'
                  : 'Nice to meet you.'}
            </Display>
          </FadeIn>
          <FadeIn delay={180} style={{ marginTop: Spacing[4], maxWidth: 360 }}>
            <Lead tone="secondary">
              {t
                ? 'Cuéntanos un poco más para que tu noche sea a la medida.'
                : 'Tell us a bit more so we can tailor your night.'}
            </Lead>
          </FadeIn>

          <View style={styles.form}>
            {/* Birthday */}
            <FadeIn delay={240}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t ? 'Elegir fecha de cumpleaños' : 'Pick birthday'}
                onPress={() => {
                  setTempDate(birthDate || maxDate);
                  setPickerOpen(true);
                }}
                style={({ pressed }) => [styles.fieldCard, pressed && styles.pressed]}
              >
                <View style={styles.labelRow}>
                  <Label tone="secondary">{t ? 'CUMPLEAÑOS' : 'BIRTHDAY'}</Label>
                </View>
                <View style={styles.fieldValueRow}>
                  <Body tone={birthDate ? 'primary' : 'muted'}>
                    {birthDate
                      ? formatBirth(birthDate, language)
                      : t
                        ? 'Toca para elegir'
                        : 'Tap to choose'}
                  </Body>
                  <Feather
                    name={birthDate ? 'edit-2' : 'chevron-right'}
                    size={16}
                    color={Colors.textMuted}
                  />
                </View>
              </Pressable>
            </FadeIn>

            {/* City */}
            <FadeIn delay={310}>
              <Input
                label={t ? 'CIUDAD' : 'CITY'}
                value={city}
                onChangeText={setCity}
                placeholder={t ? 'Puerto Vallarta' : 'Puerto Vallarta'}
                autoCapitalize="words"
                accessibilityLabel={t ? 'Ciudad' : 'City'}
                leftIcon={<Feather name="map-pin" size={18} color={Colors.textMuted} />}
              />
            </FadeIn>

            {/* Gender */}
            <FadeIn delay={380}>
              <View style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <Label tone="secondary">{t ? 'GÉNERO' : 'GENDER'}</Label>
                  <Caption tone="muted">{t ? 'OPCIONAL' : 'OPTIONAL'}</Caption>
                </View>
                <View style={styles.pillRow}>
                  {genderOptions.map((opt) => {
                    const active = gender === opt.key;
                    return (
                      <Pressy
                        key={opt.key}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ selected: active }}
                        haptic="select"
                        onPress={() => setGender(active ? null : opt.key)}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Body
                          size="sm"
                          tone={active ? 'inverse' : 'secondary'}
                          weight={active ? 'semiBold' : 'regular'}
                        >
                          {opt.label}
                        </Body>
                      </Pressy>
                    );
                  })}
                </View>
              </View>
            </FadeIn>

            {/* Occupation */}
            <FadeIn delay={440}>
              <Input
                label={t ? 'A QUÉ TE DEDICAS' : 'WHAT YOU DO'}
                value={occupation}
                onChangeText={(v) => setOccupation(v.slice(0, 120))}
                placeholder={
                  t ? 'Ej. Diseñadora, chef, estudiante' : 'Ex. Designer, chef, student'
                }
                autoCapitalize="sentences"
                accessibilityLabel={t ? 'A qué te dedicas' : 'What you do'}
                leftIcon={<Feather name="briefcase" size={18} color={Colors.textMuted} />}
                helper={t ? 'Opcional' : 'Optional'}
              />
            </FadeIn>

            {/* Discovery */}
            <FadeIn delay={500}>
              <View style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <Label tone="secondary">
                    {t ? 'CÓMO NOS CONOCISTE' : 'HOW YOU FOUND US'}
                  </Label>
                  <Caption tone="muted">{t ? 'OPCIONAL' : 'OPTIONAL'}</Caption>
                </View>
                <View style={styles.pillRow}>
                  {discoveryOptions.map((opt) => {
                    const active = discoverySource === opt.key;
                    return (
                      <Pressy
                        key={opt.key}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ selected: active }}
                        haptic="select"
                        onPress={() => setDiscoverySource(active ? null : opt.key)}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Feather
                          name={opt.icon as any}
                          size={12}
                          color={active ? Colors.textInverse : Colors.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Body
                          size="sm"
                          tone={active ? 'inverse' : 'secondary'}
                          weight={active ? 'semiBold' : 'regular'}
                        >
                          {opt.label}
                        </Body>
                      </Pressy>
                    );
                  })}
                </View>
              </View>
            </FadeIn>

            {/* Bio */}
            <FadeIn delay={560}>
              <View style={styles.fieldCardOpen}>
                <View style={styles.groupHeader}>
                  <Label tone="secondary">{t ? 'BIO CORTA' : 'SHORT BIO'}</Label>
                  <Caption tone="muted">
                    {bio.length} / {MAX_BIO}
                  </Caption>
                </View>
                <TextInput
                  style={styles.bioInput}
                  value={bio}
                  onChangeText={(v) => setBio(v.slice(0, MAX_BIO))}
                  placeholder={
                    t
                      ? 'Ej. Cocteles de autor y noches de jazz'
                      : 'Ex. Craft cocktails and jazz nights'
                  }
                  placeholderTextColor={Colors.textDisabled}
                  multiline
                  accessibilityLabel={t ? 'Bio corta' : 'Short bio'}
                />
              </View>
            </FadeIn>
          </View>
        </ScrollView>

        {/* Footer CTAs */}
        <View style={styles.footer}>
          <Button
            label={t ? 'Continuar' : 'Continue'}
            onPress={handleNext}
            loading={loading}
            variant="primary"
            size="lg"
            fullWidth
            rightIcon={<Feather name="arrow-right" size={18} color={Colors.textInverse} />}
          />
          <Pressy
            accessibilityRole="button"
            accessibilityLabel={t ? 'Omitir por ahora' : 'Skip for now'}
            haptic="select"
            onPress={handleSkip}
            style={styles.skipBtn}
          >
            <Body size="sm" tone="muted">
              {t ? 'Omitir por ahora' : 'Skip for now'}
            </Body>
          </Pressy>
        </View>

        {/* Date picker */}
        {Platform.OS === 'ios' ? (
          <Modal visible={pickerOpen} animationType="slide" transparent>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Pressable
                    onPress={() => setPickerOpen(false)}
                    hitSlop={HitSlop.expand}
                    accessibilityRole="button"
                    accessibilityLabel={t ? 'Cancelar' : 'Cancel'}
                  >
                    <Body size="sm" tone="muted">
                      {t ? 'Cancelar' : 'Cancel'}
                    </Body>
                  </Pressable>
                  <Label tone="primary">{t ? 'CUMPLEAÑOS' : 'BIRTHDAY'}</Label>
                  <Pressable
                    onPress={confirmDate}
                    hitSlop={HitSlop.expand}
                    accessibilityRole="button"
                    accessibilityLabel={t ? 'Confirmar' : 'Done'}
                  >
                    <Body size="sm" tone="accent" weight="semiBold">
                      {t ? 'Listo' : 'Done'}
                    </Body>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  maximumDate={today}
                  minimumDate={minDate}
                  onChange={onPickerChange}
                  textColor={Colors.textPrimary}
                  locale={language}
                />
              </View>
            </View>
          </Modal>
        ) : (
          pickerOpen && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="default"
              maximumDate={today}
              minimumDate={minDate}
              onChange={onPickerChange}
            />
          )
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.85 },

  stepRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[5],
    paddingBottom: Spacing[3],
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[8],
  },

  form: {
    marginTop: Spacing[8],
    gap: Spacing[4],
  },

  fieldCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    minHeight: 64,
  },
  fieldCardOpen: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  groupBlock: {
    gap: Spacing[3],
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },

  bioInput: {
    ...TypePresets.body,
    color: Colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
    padding: 0,
  },

  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  skipBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing[5],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
