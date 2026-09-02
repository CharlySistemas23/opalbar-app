// ─────────────────────────────────────────────
//  New Story — Editorial Premium
//
//  Vertical 9:16 capture/pick with editorial chrome.
//   · Header: close + Kicker overline + Primary Button "Publicar"
//   · Canvas: full-bleed 9:16 photo OR empty editorial frame with hint
//   · Caption bar pinned above bottom action row
//   · Bottom action row: Cámara + Galería (hairline buttons)
// ─────────────────────────────────────────────
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  Display,
  Hairline,
  Kicker,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { useFeedback } from '@/hooks/useFeedback';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { MentionSuggestions } from '@/components/MentionSuggestions';
import { PhotoTagger, type PhotoTag } from '@/components/PhotoTagger';

const MAX_CAPTION = 200;

export default function NewStory() {
  const router = useRouter();
  const fb = useFeedback();
  const { language } = useAppStore();
  const t = language === 'es';

  const mention = useMentionAutocomplete();
  const caption = mention.text;
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [taggerOpen, setTaggerOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function pickFromCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast(t ? 'Necesitamos acceso a la cámara.' : 'We need camera access.', 'warning');
        return;
      }
      setPicking(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } catch (err) {
      fb.error();
      toast(t ? 'No se pudo abrir la cámara.' : 'Could not open the camera.', 'danger');
    } finally {
      setPicking(false);
    }
  }

  async function pickFromGallery() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast(t ? 'Necesitamos acceso a tu galería.' : 'We need photo library access.', 'warning');
        return;
      }
      setPicking(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setLocalImage(result.assets[0].uri);
      }
    } catch (err) {
      fb.error();
      toast(t ? 'No se pudo abrir la galería.' : 'Could not open the photo library.', 'danger');
    } finally {
      setPicking(false);
    }
  }

  async function publish() {
    if (!localImage) {
      toast(t ? 'Selecciona una imagen primero.' : 'Pick an image first.', 'warning');
      return;
    }
    setPublishing(true);
    try {
      let mediaUrl: string;
      try {
        mediaUrl = await uploadImage(localImage, { kind: 'story' });
      } catch (err) {
        fb.error();
        const msg = err instanceof UploadError ? err.message : 'upload failed';
        toast(
          t ? `No se pudo subir la imagen: ${msg}` : `Could not upload image: ${msg}`,
          'danger',
        );
        return;
      }
      const coordsByUserId = new Map(
        photoTags.map((tag) => [tag.userId, { x: tag.x, y: tag.y }] as const),
      );
      const mentions = mention.buildMentions(coordsByUserId);
      for (const pt of photoTags) {
        if (!mentions.find((m) => m.userId === pt.userId)) {
          mentions.push({ userId: pt.userId, x: pt.x, y: pt.y });
        }
      }
      await communityApi.createStory({
        mediaUrl,
        caption: caption.trim() || undefined,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      fb.success();
      toast(t ? 'Historia publicada.' : 'Story published.', 'success');
      router.back();
    } catch (err: any) {
      fb.error();
      toast(apiError(err, t ? 'No se pudo publicar.' : 'Could not publish.'), 'danger');
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
        {/* ── Header ──────────────────────── */}
        <View style={styles.header}>
          <Pressy
            onPress={() => router.back()}
            haptic="select"
            hitSlop={HitSlop.expand}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Cerrar' : 'Close'}
            style={styles.iconBtn}
          >
            <Feather name="x" size={22} color={Colors.textPrimary} />
          </Pressy>
          <View style={{ flex: 1 }}>
            <Kicker tone="muted" align="center">
              {t ? 'NUEVA HISTORIA' : 'NEW STORY'}
            </Kicker>
          </View>
          <View style={styles.publishSlot}>
            <Button
              label={t ? 'Publicar' : 'Share'}
              onPress={publish}
              variant="primary"
              size="sm"
              loading={publishing}
              disabled={!canPublish}
              fullWidth
            />
          </View>
        </View>
        <Hairline variant="subtle" />

        {/* ── Canvas ──────────────────────── */}
        <View style={styles.canvas}>
          {localImage ? (
            <>
              <Image source={{ uri: localImage }} style={styles.preview} resizeMode="cover" />
              {caption.length > 0 ? (
                <View style={styles.captionOverlay} pointerEvents="none">
                  <Text style={styles.captionOverlayText}>{caption}</Text>
                </View>
              ) : null}
              <Pressy
                onPress={() => {
                  setLocalImage(null);
                  setPhotoTags([]);
                }}
                haptic="tap"
                hitSlop={HitSlop.expand}
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Cambiar foto' : 'Change photo'}
                style={styles.canvasChip}
              >
                <Feather name="refresh-cw" size={14} color="#fff" />
                <Text style={styles.canvasChipText}>
                  {t ? 'Cambiar' : 'Retake'}
                </Text>
              </Pressy>
              <Pressy
                onPress={() => setTaggerOpen(true)}
                haptic="select"
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Etiquetar' : 'Tag'}
                style={[styles.canvasChip, styles.canvasChipLeft]}
              >
                <Feather name="user-plus" size={14} color="#fff" />
                <Text style={styles.canvasChipText}>
                  {photoTags.length > 0
                    ? t
                      ? `${photoTags.length} etiquetad${photoTags.length === 1 ? 'o' : 'os'}`
                      : `${photoTags.length} tagged`
                    : t
                      ? 'Etiquetar'
                      : 'Tag'}
                </Text>
              </Pressy>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyFrame}>
                <Feather name="image" size={28} color={Colors.textMuted} />
              </View>
              <Kicker tone="champagne" align="center" style={{ marginTop: Spacing[5] }}>
                {t ? '24 HORAS' : '24 HOURS'}
              </Kicker>
              <Display align="center" style={{ marginTop: Spacing[2] }}>
                {t ? 'Captura el momento' : 'Capture the moment'}
              </Display>
              <Caption tone="muted" align="center" style={styles.emptySub}>
                {t
                  ? 'Tu historia desaparece en 24 horas. Elige una foto vertical para destacar.'
                  : 'Your story disappears in 24 hours. Pick a vertical photo to stand out.'}
              </Caption>
            </View>
          )}
        </View>

        {/* ── Caption bar ─────────────────── */}
        {localImage ? (
          <View style={styles.captionBar}>
            {mention.activeQuery !== null ? (
              <View style={{ marginBottom: Spacing[2] }}>
                <MentionSuggestions
                  suggestions={mention.suggestions}
                  loading={mention.loading}
                  onPick={mention.pickSuggestion}
                />
              </View>
            ) : null}
            <TextInput
              style={styles.captionInput}
              placeholder={
                t
                  ? 'Añade un texto. Usa @ para etiquetar…'
                  : 'Add a caption. Use @ to tag…'
              }
              placeholderTextColor={Colors.textMuted}
              value={caption}
              onChangeText={mention.onChangeText}
              onSelectionChange={mention.onSelectionChange}
              maxLength={MAX_CAPTION}
              multiline
              accessibilityLabel={t ? 'Texto de la historia' : 'Story caption'}
            />
            <Caption tone="muted" align="right" style={{ marginTop: Spacing[1] }}>
              {caption.length} / {MAX_CAPTION}
            </Caption>
          </View>
        ) : null}

        {/* ── Action bar ──────────────────── */}
        <Hairline variant="subtle" />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.actionBar}>
          <View style={styles.actionRow}>
            <Pressy
              onPress={pickFromCamera}
              disabled={picking}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Cámara' : 'Camera'}
              style={[styles.actionBtn, picking && { opacity: 0.5 }]}
            >
              <Feather name="camera" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressy>
            <Pressy
              onPress={pickFromGallery}
              disabled={picking}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Galería' : 'Gallery'}
              style={[styles.actionBtn, picking && { opacity: 0.5 }]}
            >
              <Feather name="image" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Galería' : 'Gallery'}</Text>
            </Pressy>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoTagger
        visible={taggerOpen}
        imageUri={localImage}
        initialTags={photoTags}
        onClose={() => setTaggerOpen(false)}
        onSubmit={setPhotoTags}
        t={t}
      />
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
    gap: Spacing[3],
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  publishSlot: { minWidth: 100 },

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
    left: Spacing[5],
    right: Spacing[5],
    bottom: Spacing[8],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionOverlayText: {
    ...TypePresets.bodyEmphasis,
    color: '#fff',
  },

  canvasChip: {
    position: 'absolute',
    top: Spacing[4],
    right: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  canvasChipLeft: {
    right: undefined,
    left: Spacing[4],
  },
  canvasChipText: {
    ...TypePresets.label,
    color: '#fff',
    fontSize: 11,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[10],
  },
  emptyFrame: {
    width: 100,
    height: 100,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySub: {
    maxWidth: 320,
    marginTop: Spacing[4],
  },

  captionBar: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgPrimary,
  },
  captionInput: {
    color: Colors.textPrimary,
    ...TypePresets.body,
    minHeight: 40,
    maxHeight: 110,
    padding: 0,
  },

  actionBar: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    minHeight: 44,
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
  },
  actionLabel: {
    ...TypePresets.subhead,
    color: Colors.textPrimary,
  },
});
