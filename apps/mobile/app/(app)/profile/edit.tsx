// ─────────────────────────────────────────────
//  Edit Profile — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header + intro Lead
//   · Avatar block: large round photo or initials, "tap to change"
//   · Form: First/Last (two Inputs side by side), Bio (multiline Input),
//     City/Country (two-column), Birthday (custom Pressy field opening
//     a sheet-style Modal containing the native picker), Occupation,
//     Gender (chips), email/phone meta
//   · Sticky footer with primary Save Button (loading state).
//   · Replaces Alert.alert for save with toast.
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  FadeIn,
  Heading,
  Input,
  Kicker,
  Lead,
  Modal as UIModal,
  Pressy,
} from '@/components/ui';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { toast } from '@/components/Toast';

const GENDER_OPTIONS: { v: string; es: string; en: string }[] = [
  { v: 'FEMALE', es: 'Mujer', en: 'Woman' },
  { v: 'MALE', es: 'Hombre', en: 'Man' },
  { v: 'NON_BINARY', es: 'No binario', en: 'Non-binary' },
  { v: 'OTHER', es: 'Otro', en: 'Other' },
  { v: 'PREFER_NOT_TO_SAY', es: 'Prefiero no decir', en: 'Prefer not to say' },
];

export default function EditProfile() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? '');
  const [bio, setBio] = useState(user?.profile?.bio ?? '');
  const [city, setCity] = useState((user?.profile as any)?.city ?? '');
  const [country, setCountry] = useState((user?.profile as any)?.country ?? 'MX');
  const [occupation, setOccupation] = useState((user?.profile as any)?.occupation ?? '');
  const [gender, setGender] = useState<string>((user?.profile as any)?.gender ?? '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    (user?.profile as any)?.birthDate ? new Date((user?.profile as any).birthDate) : null,
  );
  const today = useMemo(() => new Date(), []);
  const minDate = useMemo(() => new Date('1920-01-01'), []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(birthDate ?? new Date(1995, 0, 1));

  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl ?? '');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string }>({});

  const initials =
    ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() ||
    (user?.email?.[0] ?? 'U').toUpperCase();

  function openPicker() {
    setTempDate(birthDate ?? new Date(1995, 0, 1));
    setPickerOpen(true);
  }

  function onPickerChange(_: any, d?: Date) {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (d) setBirthDate(d);
    } else if (d) {
      setTempDate(d);
    }
  }

  function confirmDate() {
    setBirthDate(tempDate);
    setPickerOpen(false);
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast(
        t ? 'Necesitamos acceso a tus fotos.' : 'We need access to your photos.',
        'warning',
      );
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalAvatar(result.assets[0].uri);
      }
    } catch {
      toast(t ? 'No se pudo abrir la galería.' : 'Could not open gallery.', 'danger');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!firstName.trim()) {
      setErrors({ firstName: t ? 'Requerido.' : 'Required.' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (localAvatar) {
        try {
          finalAvatarUrl = await uploadImage(localAvatar, { kind: 'avatar' });
          setAvatarUrl(finalAvatarUrl);
          setLocalAvatar(null);
        } catch (err) {
          const msg = err instanceof UploadError ? err.message : 'upload failed';
          toast(
            t ? `No se pudo subir la foto: ${msg}` : `Could not upload photo: ${msg}`,
            'danger',
          );
          setLoading(false);
          return;
        }
      }
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        bio: bio.trim(),
      };
      if (finalAvatarUrl) payload.avatarUrl = finalAvatarUrl;
      if (city.trim()) payload.city = city.trim();
      if (country.trim()) payload.country = country.trim().toUpperCase();
      if (occupation.trim()) payload.occupation = occupation.trim();
      if (gender) payload.gender = gender;
      if (birthDate) payload.birthDate = birthDate.toISOString();
      await usersApi.updateProfile(payload);
      await refreshUser();
      toast(t ? 'Perfil actualizado.' : 'Profile updated.', 'success');
      router.back();
    } catch (err: any) {
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Could not save.'), 'danger');
    } finally {
      setLoading(false);
    }
  }

  const displayAvatar =
    localAvatar || (avatarUrl && !avatarUrl.startsWith('data:') ? avatarUrl : null);
  const hasAvatar = !!displayAvatar;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Kicker tone="muted">{t ? 'PERFIL' : 'PROFILE'}</Kicker>
            <Heading size="md" style={{ marginTop: Spacing[2] }}>
              {t ? 'Editar perfil' : 'Edit profile'}
            </Heading>
            <Lead tone="secondary" style={{ marginTop: Spacing[3] }}>
              {t
                ? 'Tu identidad pública en OPALBAR.'
                : 'Your public identity on OPALBAR.'}
            </Lead>
          </FadeIn>

          {/* ── Avatar ── */}
          <FadeIn delay={80} style={styles.avatarBlock}>
            <Pressy
              onPress={pickImage}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Cambiar foto' : 'Change photo'}
              disabled={uploading}
              style={styles.avatarPress}
            >
              {hasAvatar ? (
                <Image source={{ uri: displayAvatar! }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Heading size="lg" tone="inverse">
                    {initials}
                  </Heading>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Feather name={uploading ? 'loader' : 'camera'} size={14} color={Colors.textInverse} />
              </View>
            </Pressy>
            <Caption tone="muted" align="center" style={{ marginTop: Spacing[3] }}>
              {t ? 'Toca para cambiar' : 'Tap to change'}
            </Caption>
          </FadeIn>

          {/* ── Form ── */}
          <FadeIn delay={140} style={styles.form}>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t ? 'NOMBRE' : 'FIRST NAME'}
                  value={firstName}
                  onChangeText={(v) => {
                    setFirstName(v);
                    if (errors.firstName) setErrors({});
                  }}
                  placeholder="Carlos"
                  autoCapitalize="words"
                  required
                  error={errors.firstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t ? 'APELLIDO' : 'LAST NAME'}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="García"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <Input
              label={t ? 'BIOGRAFÍA' : 'BIO'}
              value={bio}
              onChangeText={setBio}
              placeholder={t ? 'Cuéntanos sobre ti…' : 'Tell us about yourself…'}
              multiline
              numberOfLines={4}
              helper={t ? 'Hasta 240 caracteres.' : 'Up to 240 characters.'}
            />

            <View style={styles.twoCol}>
              <View style={{ flex: 2 }}>
                <Input
                  label={t ? 'CIUDAD' : 'CITY'}
                  value={city}
                  onChangeText={setCity}
                  placeholder="CDMX"
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t ? 'PAÍS' : 'COUNTRY'}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="MX"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            {/* Birthday — custom press field */}
            <View>
              <Caption tone="secondary" style={styles.label}>
                {t ? 'CUMPLEAÑOS' : 'BIRTHDAY'}
              </Caption>
              <Pressy
                onPress={openPicker}
                haptic="select"
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Seleccionar cumpleaños' : 'Pick birthday'}
                style={[styles.dateField, birthDate ? styles.dateFieldFilled : null]}
              >
                <Feather
                  name="calendar"
                  size={16}
                  color={birthDate ? Colors.accentPrimary : Colors.textMuted}
                />
                <Body style={{ flex: 1 }} tone={birthDate ? 'primary' : 'muted'}>
                  {birthDate
                    ? birthDate.toLocaleDateString(language, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : t ? 'Selecciona una fecha' : 'Pick a date'}
                </Body>
                {birthDate ? (
                  <Pressable
                    onPress={() => setBirthDate(null)}
                    hitSlop={HitSlop.expand}
                    accessibilityRole="button"
                    accessibilityLabel={t ? 'Borrar fecha' : 'Clear date'}
                  >
                    <Feather name="x" size={16} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </Pressy>
            </View>

            <Input
              label={t ? 'OCUPACIÓN' : 'OCCUPATION'}
              value={occupation}
              onChangeText={setOccupation}
              placeholder={t ? 'Diseñador, estudiante…' : 'Designer, student…'}
              autoCapitalize="sentences"
            />

            {/* Gender chips */}
            <View>
              <Caption tone="secondary" style={styles.label}>
                {t ? 'GÉNERO' : 'GENDER'}
              </Caption>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.v;
                  return (
                    <Pressy
                      key={opt.v}
                      onPress={() => setGender(active ? '' : opt.v)}
                      haptic="select"
                      accessibilityRole={Roles.button}
                      accessibilityLabel={t ? opt.es : opt.en}
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Caption
                        tone={active ? 'inverse' : 'secondary'}
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                      >
                        {t ? opt.es : opt.en}
                      </Caption>
                    </Pressy>
                  );
                })}
              </View>
            </View>

            <View style={styles.contactBlock}>
              <Feather name="mail" size={14} color={Colors.textMuted} />
              <Caption tone="muted">{user?.email || user?.phone}</Caption>
            </View>
          </FadeIn>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t ? 'Guardar cambios' : 'Save changes'}
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={loading}
            fullWidth
            leftIcon={<Feather name="check" size={16} color={Colors.textInverse} />}
          />
        </View>

        {/* ── Birthday picker ── */}
        {Platform.OS === 'ios' ? (
          <UIModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            title={t ? 'Cumpleaños' : 'Birthday'}
            size="lg"
          >
            <View>
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
              <View style={styles.pickerActions}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t ? 'Cancelar' : 'Cancel'}
                    onPress={() => setPickerOpen(false)}
                    variant="secondary"
                    size="md"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t ? 'Listo' : 'Done'}
                    onPress={confirmDate}
                    variant="primary"
                    size="md"
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </UIModal>
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
    paddingBottom: Spacing[8],
  },
  avatarBlock: {
    alignItems: 'center',
    paddingVertical: Spacing[8],
  },
  avatarPress: {
    position: 'relative',
  },
  avatarImg: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.bgElevated,
  },
  avatarFallback: {
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  form: {
    gap: Spacing[5],
  },
  twoCol: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    minHeight: 52,
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateFieldFilled: {
    borderColor: Colors.accentPrimary,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  chip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  contactBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[4],
  },
  footer: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[4],
  },
});
