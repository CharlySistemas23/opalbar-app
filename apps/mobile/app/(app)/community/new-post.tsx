import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors } from '@/constants/tokens';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { toast } from '@/components/Toast';

// ─────────────────────────────────────────────
//  New Post — Wall or Community
//  · Clean header with Publish button (top-right)
//  · Surface toggle (wall/community) segmented
//  · Inline image pickers in bottom bar
//  · Aligned with new-story.tsx layout
// ─────────────────────────────────────────────

const MAX_LEN = 1000;

type AspectRatioKey = '4:5' | '1:1' | '9:16';
const RATIOS: { key: AspectRatioKey; label: string; aspect: [number, number]; ratio: number }[] = [
  { key: '4:5', label: '4:5', aspect: [4, 5], ratio: 4 / 5 },
  { key: '1:1', label: '1:1', aspect: [1, 1], ratio: 1 },
  { key: '9:16', label: '9:16', aspect: [9, 16], ratio: 9 / 16 },
];

export default function NewPost() {
  const router = useRouter();
  const { surface: surfaceParam, autoPick: autoPickParam } = useLocalSearchParams<{ surface?: string; autoPick?: string }>();
  const { user, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [surfaceChoice, setSurfaceChoice] = useState<'wall' | 'community'>(
    surfaceParam === 'wall' ? 'wall' : 'community',
  );
  const isWallPost = surfaceChoice === 'wall';
  const canChangeSurface = !surfaceParam;

  const [content, setContent] = useState('');
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioKey>('1:1');

  // When launched with ?autoPick=gallery|camera, open the picker once on mount
  // so the user lands directly in the photo flow (Instagram-style "Foto" action).
  const autoPickFired = useRef(false);
  useEffect(() => {
    if (autoPickFired.current || !autoPickParam) return;
    autoPickFired.current = true;
    if (autoPickParam === 'gallery') pickFromGallery();
    else if (autoPickParam === 'camera') takePhoto();
  }, [autoPickParam]);

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso requerido' : 'Permission required',
        t ? 'Necesitamos acceso a tu galería.' : 'We need photo library access.',
      );
      return;
    }
    setPickingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: RATIOS.find((r) => r.key === selectedRatio)!.aspect,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } finally {
      setPickingImage(false);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso requerido' : 'Permission required',
        t ? 'Necesitamos acceso a la cámara.' : 'We need camera access.',
      );
      return;
    }
    setPickingImage(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: RATIOS.find((r) => r.key === selectedRatio)!.aspect,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } finally {
      setPickingImage(false);
    }
  }

  const firstName = user?.profile?.firstName ?? '';
  const lastName = user?.profile?.lastName ?? '';
  const fullName =
    `${firstName} ${lastName}`.trim() || user?.email?.split('@')[0] || 'Usuario';
  const initials =
    ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() ||
    (user?.email?.[0]?.toUpperCase() ?? 'U');

  async function handleSubmit() {
    if (!content.trim() && !localImage) return;
    setLoading(true);
    try {
      let uploadedUrl: string | undefined;
      if (localImage) {
        try {
          uploadedUrl = await uploadImage(localImage, { kind: 'post' });
        } catch (err) {
          const msg = err instanceof UploadError ? err.message : 'upload failed';
          toast(t ? `No se pudo subir la imagen: ${msg}` : `Could not upload image: ${msg}`, 'danger');
          setLoading(false);
          return;
        }
      }
      const res = await communityApi.createPost({
        content: content.trim() || '',
        imageUrl: uploadedUrl,
        surface: isWallPost ? 'wall' : 'community',
      });
      refreshUser();
      const status = res.data?.data?.status;
      if (status === 'PENDING_REVIEW') {
        Alert.alert(
          t ? 'En revisión' : 'Pending review',
          t
            ? isWallPost
              ? 'Tu publicación está en revisión y ya se ve en tu muro.'
              : 'Tu publicación está en revisión. Recibirás puntos cuando sea aprobada.'
            : isWallPost
              ? 'Your wall post is pending review and already visible on your wall.'
              : 'Your post is pending review. You will get points when approved.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        router.back();
      }
    } catch (err: any) {
      Alert.alert(
        t ? 'Error' : 'Error',
        apiError(err, t ? 'No se pudo publicar.' : 'Could not publish.'),
      );
    } finally {
      setLoading(false);
    }
  }

  const canPublish = (content.trim().length > 0 || !!localImage) && !loading;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ──────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
            hitSlop={10}
          >
            <Feather name="x" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>
            {isWallPost
              ? t
                ? 'Nuevo en mi muro'
                : 'New wall post'
              : t
                ? 'Nueva publicación'
                : 'New post'}
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canPublish}
            style={({ pressed }) => [
              styles.publishBtn,
              !canPublish && { opacity: 0.4 },
              pressed && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Text style={styles.publishLabel}>{t ? 'Publicar' : 'Share'}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Surface toggle ─────────────────── */}
          {canChangeSurface && (
            <View style={styles.segRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.segBtn,
                  surfaceChoice === 'wall' && styles.segBtnActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSurfaceChoice('wall')}
              >
                <Feather
                  name="home"
                  size={14}
                  color={surfaceChoice === 'wall' ? Colors.textInverse : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segBtnLabel,
                    surfaceChoice === 'wall' && styles.segBtnLabelActive,
                  ]}
                >
                  {t ? 'Mi muro' : 'My wall'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.segBtn,
                  surfaceChoice === 'community' && styles.segBtnActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSurfaceChoice('community')}
              >
                <Feather
                  name="users"
                  size={14}
                  color={
                    surfaceChoice === 'community' ? Colors.textInverse : Colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.segBtnLabel,
                    surfaceChoice === 'community' && styles.segBtnLabelActive,
                  ]}
                >
                  {t ? 'Comunidad' : 'Community'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Author row ─────────────────────── */}
          <View style={styles.authorRow}>
            {user?.profile?.avatarUrl ? (
              <Image source={{ uri: user.profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{fullName}</Text>
              <Text style={styles.authorSub}>
                {isWallPost
                  ? t
                    ? 'Publicar en mi muro'
                    : 'Posting to my wall'
                  : t
                    ? 'Publicar para todos'
                    : 'Posting to everyone'}
              </Text>
            </View>
          </View>

          {/* ── Textarea ───────────────────────── */}
          <TextInput
            style={styles.textarea}
            placeholder={
              isWallPost
                ? t
                  ? '¿Qué quieres compartir en tu muro?'
                  : 'What do you want to share?'
                : t
                  ? '¿Qué está pasando en OPAL BAR?'
                  : "What's happening at OPAL BAR?"
            }
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={MAX_LEN}
            autoFocus={!localImage}
          />

          {/* ── Image preview ──────────────────── */}
          {localImage ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: localImage }}
                style={[
                  styles.preview,
                  { aspectRatio: RATIOS.find((r) => r.key === selectedRatio)!.ratio },
                ]}
                resizeMode="cover"
              />
              <Pressable
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                onPress={() => {
                  setLocalImage(null);
                }}
                hitSlop={10}
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.charCount}>
            {content.length} / {MAX_LEN}
          </Text>
        </ScrollView>

        {/* ── Bottom action bar ────────────────── */}
        <View style={styles.actionBar}>
          <View style={styles.actionBtnsRow}>
            <Pressable
              onPress={takePhoto}
              disabled={pickingImage}
              style={({ pressed }) => [
                styles.actionBtn,
                pickingImage && { opacity: 0.5 },
                pressed && styles.pressed,
              ]}
            >
              {pickingImage ? (
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              ) : (
                <Feather name="camera" size={20} color={Colors.accentPrimary} />
              )}
              <Text style={styles.actionBtnLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressable>

            <Pressable
              onPress={pickFromGallery}
              disabled={pickingImage}
              style={({ pressed }) => [
                styles.actionBtn,
                pickingImage && { opacity: 0.5 },
                pressed && styles.pressed,
              ]}
            >
              {pickingImage ? (
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              ) : (
                <Feather name="image" size={20} color={Colors.accentPrimary} />
              )}
              <Text style={styles.actionBtnLabel}>{t ? 'Galería' : 'Gallery'}</Text>
            </Pressable>
          </View>

          {/* Aspect ratio selector — only when no image picked */}
          {!localImage && (
            <View style={styles.ratioRow}>
              {RATIOS.map((r) => {
                const active = selectedRatio === r.key;
                return (
                  <Pressable
                    key={r.key}
                    style={({ pressed }) => [
                      styles.ratioBtn,
                      active && styles.ratioBtnActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setSelectedRatio(r.key)}
                  >
                    <Text
                      style={[styles.ratioBtnLabel, active && styles.ratioBtnLabelActive]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles (aligned with new-story.tsx)
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  publishBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  publishLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 32 },

  // Segmented control (surface toggle)
  segRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnActive: { backgroundColor: Colors.textPrimary },
  segBtnLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segBtnLabelActive: { color: Colors.textInverse, fontWeight: '700' },

  // Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '700', fontSize: 14 },
  authorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  authorSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  // Textarea
  textarea: {
    minHeight: 140,
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
    padding: 0,
  },

  // Image preview
  previewWrap: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  preview: { width: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  charCount: {
    alignSelf: 'flex-end',
    marginTop: 12,
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Bottom action bar
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
  },
  actionBtnLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },

  ratioRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  ratioBtn: {
    minWidth: 58,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  ratioBtnActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  ratioBtnLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  ratioBtnLabelActive: { color: Colors.textInverse },
});
