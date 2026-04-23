import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Modal, Pressable } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { toast } from '@/components/Toast';

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

  function openPicker() {
    setTempDate(birthDate ?? new Date(1995, 0, 1));
    setPickerOpen(true);
  }
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl ?? '');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const initials =
    ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() ||
    (user?.email?.[0] ?? 'U').toUpperCase();

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso denegado' : 'Permission denied',
        t ? 'Necesitamos acceso a tus fotos.' : 'We need access to your photos.',
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
    } catch (err) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'No se pudo abrir la galería.' : 'Could not open gallery.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!firstName.trim()) {
      Alert.alert(t ? 'Falta nombre' : 'Missing first name');
      return;
    }
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
          toast(t ? `No se pudo subir la foto: ${msg}` : `Could not upload photo: ${msg}`, 'danger');
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
      router.back();
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err, t ? 'No se pudo guardar.' : 'Could not save.'));
    } finally {
      setLoading(false);
    }
  }

  const displayAvatar = localAvatar || (avatarUrl && !avatarUrl.startsWith('data:') ? avatarUrl : null);
  const hasAvatar = !!displayAvatar;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t ? 'Editar perfil' : 'Edit profile'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarBox}>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploading}
              activeOpacity={0.85}
              style={styles.avatarPressable}
            >
              {hasAvatar ? (
                <Image
                  source={{ uri: displayAvatar! }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploading
                  ? <ActivityIndicator color={Colors.textInverse} size="small" />
                  : <Feather name="camera" size={16} color={Colors.textInverse} />}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {t ? 'Toca para cambiar' : 'Tap to change'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={t ? 'Nombre' : 'First name'}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Carlos"
                autoCapitalize="words"
                icon="user"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t ? 'Apellido' : 'Last name'}
                value={lastName}
                onChangeText={setLastName}
                placeholder="García"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Field
            label={t ? 'Biografía' : 'Bio'}
            value={bio}
            onChangeText={setBio}
            placeholder={t ? 'Cuéntanos sobre ti…' : 'Tell us about yourself…'}
            multiline
            icon="file-text"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Field
                label={t ? 'Ciudad' : 'City'}
                value={city}
                onChangeText={setCity}
                placeholder="CDMX"
                icon="map-pin"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t ? 'País' : 'Country'}
                value={country}
                onChangeText={setCountry}
                placeholder="MX"
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.fieldLabel}>{t ? 'Cumpleaños' : 'Birthday'}</Text>
            <Pressable
              onPress={openPicker}
              style={({ pressed }) => [
                styles.fieldBox,
                birthDate && styles.fieldBoxFilled,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather name="gift" size={16} color={birthDate ? Colors.accentPrimary : Colors.textMuted} />
              <Text style={[styles.birthdayValue, !birthDate && { color: Colors.textMuted }]}>
                {birthDate
                  ? birthDate.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })
                  : t ? 'Selecciona una fecha' : 'Pick a date'}
              </Text>
              {birthDate && (
                <Pressable
                  onPress={() => setBirthDate(null)}
                  hitSlop={10}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Feather name="x" size={16} color={Colors.textMuted} />
                </Pressable>
              )}
            </Pressable>
          </View>

          <Field
            label={t ? 'Ocupación' : 'Occupation'}
            value={occupation}
            onChangeText={setOccupation}
            placeholder={t ? 'Diseñador, estudiante…' : 'Designer, student…'}
            icon="briefcase"
          />

          <View style={{ gap: 6 }}>
            <Text style={styles.fieldLabel}>{t ? 'Género' : 'Gender'}</Text>
            <View style={styles.genderRow}>
              {[
                { v: 'FEMALE', es: 'Mujer', en: 'Woman' },
                { v: 'MALE', es: 'Hombre', en: 'Man' },
                { v: 'NON_BINARY', es: 'No binario', en: 'Non-binary' },
                { v: 'OTHER', es: 'Otro', en: 'Other' },
                { v: 'PREFER_NOT_TO_SAY', es: 'Prefiero no decir', en: 'Prefer not to say' },
              ].map((opt) => {
                const active = gender === opt.v;
                return (
                  <TouchableOpacity
                    key={opt.v}
                    onPress={() => setGender(active ? '' : opt.v)}
                    activeOpacity={0.75}
                    style={[styles.genderChip, active && styles.genderChipActive]}
                  >
                    <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                      {t ? opt.es : opt.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.emailInfo}>
            <Feather name="mail" size={14} color={Colors.textMuted} />
            <Text style={styles.emailInfoText}>{user?.email || user?.phone}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <>
                  <Feather name="check" size={18} color={Colors.textInverse} />
                  <Text style={styles.saveLabel}>{t ? 'Guardar cambios' : 'Save changes'}</Text>
                </>}
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' ? (
          <Modal visible={pickerOpen} animationType="slide" transparent>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                    <Text style={styles.modalCancel}>{t ? 'Cancelar' : 'Cancel'}</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>{t ? 'Cumpleaños' : 'Birthday'}</Text>
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

function Field({
  label, icon, multiline, ...props
}: React.ComponentProps<typeof TextInput> & { label: string; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, multiline && { height: 96, alignItems: 'flex-start', paddingTop: 12 }]}>
        {icon && <Feather name={icon} size={16} color={Colors.textMuted} />}
        <TextInput
          {...props}
          multiline={multiline}
          style={[styles.fieldInput, multiline && { textAlignVertical: 'top', height: 80 }]}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 16 },

  avatarBox: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarPressable: { position: 'relative' },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(244, 163, 64, 0.4)',
  },
  avatarImg: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(244, 163, 64, 0.4)',
  },
  avatarText: { color: Colors.textInverse, fontSize: 36, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute', right: 2, bottom: 2,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.bgPrimary,
  },
  avatarHint: { color: Colors.textMuted, fontSize: 12 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  fieldInput: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },

  // Gender chips
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  genderChipActive: {
    backgroundColor: 'rgba(244,163,64,0.15)',
    borderColor: Colors.accentPrimary,
  },
  genderChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: Colors.accentPrimary,
    fontWeight: '700',
  },

  emailInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  emailInfoText: { color: Colors.textMuted, fontSize: 12 },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  saveLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },

  fieldBoxFilled: {
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(244,163,64,0.08)',
  },
  birthdayValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
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
  modalCancel: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  modalConfirm: { color: Colors.accentPrimary, fontSize: 15, fontWeight: '700' },
  modalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
