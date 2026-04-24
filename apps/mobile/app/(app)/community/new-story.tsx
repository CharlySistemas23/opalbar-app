import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors } from '@/constants/tokens';
import { toast } from '@/components/Toast';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { useFeedback } from '@/hooks/useFeedback';

// ─────────────────────────────────────────────
//  New Story — IG-style composer (aligned w/ new-post)
//  · Vertical 9:16 capture/pick
//  · Caption overlay (optional, 200 chars)
//  · Same header/button visual system as new-post
// ─────────────────────────────────────────────

const MAX_CAPTION = 200;

export default function NewStory() {
  const router = useRouter();
  const fb = useFeedback();
  const { language } = useAppStore();
  const t = language === 'es';

  const [localImage, setLocalImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [picking, setPicking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso requerido' : 'Permission required',
        t ? 'Necesitamos acceso a la cámara.' : 'We need camera access.',
      );
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso requerido' : 'Permission required',
        t ? 'Necesitamos acceso a tu galería.' : 'We need photo library access.',
      );
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  }

  async function publish() {
    if (!localImage) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'Selecciona una imagen.' : 'Pick an image.');
      return;
    }
    setPublishing(true);
    try {
      let mediaUrl: string;
      try {
        mediaUrl = await uploadImage(localImage, { kind: 'story' });
      } catch (err) {
        const msg = err instanceof UploadError ? err.message : 'upload failed';
        toast(t ? `No se pudo subir la imagen: ${msg}` : `Could not upload image: ${msg}`, 'danger');
        return;
      }
      await communityApi.createStory({
        mediaUrl,
        caption: caption.trim() || undefined,
      });
      fb.success();
      toast(t ? 'Historia publicada' : 'Story published', 'success');
      router.back();
    } catch (err: any) {
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setPublishing(false);
    }
  }

  const canPublish = !!localImage && !publishing;

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
          <Text style={styles.title}>{t ? 'Nueva historia' : 'New story'}</Text>
          <Pressable
            onPress={publish}
            disabled={!canPublish}
            style={({ pressed }) => [
              styles.publishBtn,
              !canPublish && { opacity: 0.4 },
              pressed && styles.pressed,
            ]}
          >
            {publishing ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Text style={styles.publishLabel}>{t ? 'Publicar' : 'Share'}</Text>
            )}
          </Pressable>
        </View>

        {/* ── Canvas ──────────────────────────── */}
        <View style={styles.canvas}>
          {localImage ? (
            <>
              <Image source={{ uri: localImage }} style={styles.preview} resizeMode="cover" />
              {caption.length > 0 && (
                <View style={styles.captionOverlay} pointerEvents="none">
                  <Text style={styles.captionOverlayText}>{caption}</Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  setLocalImage(null);
                }}
                style={({ pressed }) => [styles.retakeBtn, pressed && styles.pressed]}
              >
                <Feather name="refresh-cw" size={14} color="#fff" />
                <Text style={styles.retakeBtnText}>{t ? 'Cambiar foto' : 'Retake'}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Feather name="image" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {t ? 'Selecciona una foto' : 'Pick a photo'}
              </Text>
              <Text style={styles.emptySub}>
                {t
                  ? 'Tu historia se oculta en 24 horas'
                  : 'Your story disappears in 24 hours'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Caption input (bottom, above action bar) ── */}
        {localImage && (
          <View style={styles.captionBar}>
            <TextInput
              style={styles.captionInput}
              placeholder={t ? 'Añade un texto a tu historia…' : 'Add a caption…'}
              placeholderTextColor={Colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              maxLength={MAX_CAPTION}
              multiline
            />
            <Text style={styles.captionCount}>
              {caption.length} / {MAX_CAPTION}
            </Text>
          </View>
        )}

        {/* ── Bottom action bar ─────────────────── */}
        <View style={styles.actionBar}>
          <View style={styles.actionBtnsRow}>
            <Pressable
              onPress={pickFromCamera}
              disabled={picking}
              style={({ pressed }) => [
                styles.actionBtn,
                picking && { opacity: 0.5 },
                pressed && styles.pressed,
              ]}
            >
              {picking ? (
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              ) : (
                <Feather name="camera" size={20} color={Colors.accentPrimary} />
              )}
              <Text style={styles.actionBtnLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressable>

            <Pressable
              onPress={pickFromGallery}
              disabled={picking}
              style={({ pressed }) => [
                styles.actionBtn,
                picking && { opacity: 0.5 },
                pressed && styles.pressed,
              ]}
            >
              {picking ? (
                <ActivityIndicator color={Colors.accentPrimary} size="small" />
              ) : (
                <Feather name="image" size={20} color={Colors.accentPrimary} />
              )}
              <Text style={styles.actionBtnLabel}>{t ? 'Galería' : 'Gallery'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles (aligned with new-post.tsx)
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

  // Canvas
  canvas: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  preview: { width: '100%', height: '100%' },
  captionOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionOverlayText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  retakeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  retakeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },

  // Caption bar
  captionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  captionInput: {
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 36,
    maxHeight: 90,
    padding: 0,
  },
  captionCount: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  // Bottom action bar (same as new-post)
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
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
});
