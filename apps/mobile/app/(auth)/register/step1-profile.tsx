import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usersApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

// ─────────────────────────────────────────────
//  Onboarding step 1 — Profile data (elegant)
//  · Native date picker (iOS inline wheel / Android dialog)
//  · Visual section cards with colored icons
//  · Personalized greeting with initials
// ─────────────────────────────────────────────

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
    d.setFullYear(d.getFullYear() - 18); // 18+ by default
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

  const firstName = user?.profile?.firstName ?? '';
  const initials =
    (firstName[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

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
      // Non-blocking, user can edit later from Profile
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          {/* Avatar + greeting */}
          <View style={styles.hero}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <Text style={styles.kicker}>{t ? 'Paso 1 de 4' : 'Step 1 of 4'}</Text>
            <Text style={styles.title}>
              {firstName
                ? t
                  ? `Un placer,\n${firstName}`
                  : `Nice to meet you,\n${firstName}`
                : t
                  ? 'Un placer'
                  : 'Nice to meet you'}
            </Text>
            <Text style={styles.subtitle}>
              {t
                ? 'Cuéntanos un poco más de ti para que tu experiencia sea a la medida.'
                : 'Tell us a bit more about you so we can tailor your experience.'}
            </Text>
          </View>

          {/* Birthday card */}
          <Pressable
            style={({ pressed }) => [
              styles.card,
              birthDate && styles.cardFilled,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              setTempDate(birthDate || maxDate);
              setPickerOpen(true);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(244,163,64,0.18)' }]}>
              <Feather name="gift" size={18} color={Colors.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t ? 'Tu cumpleaños' : 'Your birthday'}</Text>
              {birthDate ? (
                <Text style={styles.cardValue}>{formatBirth(birthDate, language)}</Text>
              ) : (
                <Text style={styles.cardHint}>
                  {t ? 'Te regalamos algo especial ese día' : 'We send a gift on that day'}
                </Text>
              )}
            </View>
            <Feather
              name={birthDate ? 'edit-2' : 'chevron-right'}
              size={16}
              color={Colors.textMuted}
            />
          </Pressable>

          {/* City card */}
          <View style={[styles.card, styles.cardFilled]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(96,165,250,0.18)' }]}>
              <Feather name="map-pin" size={18} color={Colors.accentInfo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t ? 'Tu ciudad' : 'Your city'}</Text>
              <TextInput
                style={styles.cardInput}
                value={city}
                onChangeText={setCity}
                placeholder={t ? 'Puerto Vallarta' : 'Puerto Vallarta'}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Gender card */}
          <View style={[styles.card, styles.cardFilled, { alignItems: 'flex-start' }]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(236,72,153,0.18)' }]}>
              <Feather name="user" size={18} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {t ? 'Género' : 'Gender'}
                <Text style={styles.optional}>{t ? '  ·  opcional' : '  ·  optional'}</Text>
              </Text>
              <View style={styles.pillRow}>
                {genderOptions.map((opt) => {
                  const active = gender === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        fb.select();
                        setGender(active ? null : opt.key);
                      }}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Occupation card */}
          <View style={[styles.card, styles.cardFilled]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(168,85,247,0.18)' }]}>
              <Feather name="briefcase" size={18} color="#A855F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {t ? '¿A qué te dedicas?' : 'What do you do?'}
                <Text style={styles.optional}>{t ? '  ·  opcional' : '  ·  optional'}</Text>
              </Text>
              <TextInput
                style={styles.cardInput}
                value={occupation}
                onChangeText={(v) => setOccupation(v.slice(0, 120))}
                placeholder={t ? 'Ej. Diseñadora, chef, estudiante' : 'Ex. Designer, chef, student'}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="sentences"
              />
            </View>
          </View>

          {/* Discovery source card */}
          <View style={[styles.card, styles.cardFilled, { alignItems: 'flex-start' }]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(251,191,36,0.18)' }]}>
              <Feather name="compass" size={18} color="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {t ? '¿Cómo nos conociste?' : 'How did you find us?'}
                <Text style={styles.optional}>{t ? '  ·  opcional' : '  ·  optional'}</Text>
              </Text>
              <View style={styles.pillRow}>
                {discoveryOptions.map((opt) => {
                  const active = discoverySource === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        fb.select();
                        setDiscoverySource(active ? null : opt.key);
                      }}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Feather
                        name={opt.icon as any}
                        size={12}
                        color={active ? Colors.textInverse : Colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Bio card */}
          <View style={[styles.card, styles.cardFilled, { alignItems: 'flex-start' }]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(56,199,147,0.18)' }]}>
              <Feather name="edit-3" size={18} color={Colors.accentSuccess} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {t ? 'Una bio corta' : 'A short bio'}
                <Text style={styles.optional}>{t ? '  ·  opcional' : '  ·  optional'}</Text>
              </Text>
              <TextInput
                style={[styles.cardInput, { minHeight: 60, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, MAX_BIO))}
                placeholder={
                  t
                    ? 'Ej. Me gustan los cocteles de autor y las noches de jazz'
                    : 'Ex. Love craft cocktails and jazz nights'
                }
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <Text style={styles.charCount}>
                {bio.length} / {MAX_BIO}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              loading && { opacity: 0.6 },
              pressed && styles.pressed,
            ]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <Text style={styles.primaryBtnLabel}>{t ? 'Continuar' : 'Continue'}</Text>
                <Feather name="arrow-right" size={18} color={Colors.textInverse} />
              </>
            )}
          </Pressable>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
          >
            <Text style={styles.skipLabel}>{t ? 'Omitir por ahora' : 'Skip for now'}</Text>
          </Pressable>
        </View>

        {/* Date picker */}
        {Platform.OS === 'ios' ? (
          <Modal visible={pickerOpen} animationType="slide" transparent>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                    <Text style={styles.modalCancel}>{t ? 'Cancelar' : 'Cancel'}</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>
                    {t ? 'Tu cumpleaños' : 'Your birthday'}
                  </Text>
                  <Pressable onPress={confirmDate} hitSlop={10}>
                    <Text style={styles.modalConfirm}>{t ? 'Listo' : 'Done'}</Text>
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

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.85 },

  stepRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
  },
  stepDotActive: { backgroundColor: Colors.accentPrimary },

  scroll: { paddingHorizontal: 24, paddingBottom: 24 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.accentPrimary,
    fontSize: 34,
    fontWeight: '800',
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
    lineHeight: 34,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardFilled: {},
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  cardValue: {
    color: Colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  cardInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    padding: 0,
    marginTop: 3,
    fontWeight: '600',
  },
  optional: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  pillLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pillLabelActive: {
    color: Colors.textInverse,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 10,
    gap: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },

  // Date picker modal (iOS)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalCancel: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  modalConfirm: { color: Colors.accentPrimary, fontSize: 14, fontWeight: '800' },
  modalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
