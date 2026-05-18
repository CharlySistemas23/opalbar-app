// ─────────────────────────────────────────────
//  New Post — Editorial Premium
//
//  Composer for wall + community posts.
//   · Header: close (X) + Kicker "NUEVO" + primary "Publicar" button
//   · Surface toggle: SegmentedControl ("Mi muro" / "Comunidad")
//   · Author row: avatar + name + scope hint
//   · Body: editorial multi-line input (no card)
//   · Image preview with edit chips (Tagger + remove)
//   · Bottom action bar: Camera + Galería buttons + aspect ratio chips
//   · Toast (no Alert) for non-critical info
// ─────────────────────────────────────────────
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Button,
  Caption,
  Hairline,
  Kicker,
  Pressy,
  SegmentedControl,
  type SegmentOption,
} from '@/components/ui';
import { toast } from '@/components/Toast';
import { uploadImage, UploadError } from '@/utils/uploadImage';
import { useFeedback } from '@/hooks/useFeedback';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { MentionSuggestions } from '@/components/MentionSuggestions';
import { PhotoTagger, type PhotoTag } from '@/components/PhotoTagger';

const MAX_LEN = 1000;

type AspectRatioKey = '4:5' | '1:1' | '9:16';
const RATIOS: { key: AspectRatioKey; label: string; aspect: [number, number]; ratio: number }[] = [
  { key: '4:5', label: '4:5', aspect: [4, 5], ratio: 4 / 5 },
  { key: '1:1', label: '1:1', aspect: [1, 1], ratio: 1 },
  { key: '9:16', label: '9:16', aspect: [9, 16], ratio: 9 / 16 },
];

type Surface = 'wall' | 'community';

export default function NewPost() {
  const router = useRouter();
  const fb = useFeedback();
  const { surface: surfaceParam, autoPick: autoPickParam } = useLocalSearchParams<{
    surface?: string;
    autoPick?: string;
  }>();
  const { user, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [surfaceChoice, setSurfaceChoice] = useState<Surface>(
    surfaceParam === 'wall' ? 'wall' : 'community',
  );
  const isWallPost = surfaceChoice === 'wall';
  const canChangeSurface = !surfaceParam;

  const mention = useMentionAutocomplete();
  const content = mention.text;
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [taggerOpen, setTaggerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioKey>('1:1');

  const surfaceOptions: SegmentOption<Surface>[] = [
    { value: 'wall', label: t ? 'Mi muro' : 'My wall' },
    { value: 'community', label: t ? 'Comunidad' : 'Community' },
  ];

  // When launched with ?autoPick=gallery|camera, open the picker once on mount
  const autoPickFired = useRef(false);
  useEffect(() => {
    if (autoPickFired.current || !autoPickParam) return;
    autoPickFired.current = true;
    if (autoPickParam === 'gallery') pickFromGallery();
    else if (autoPickParam === 'camera') takePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPickParam]);

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast(
        t ? 'Necesitamos acceso a tu galería.' : 'We need photo library access.',
        'warning',
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
      toast(
        t ? 'Necesitamos acceso a la cámara.' : 'We need camera access.',
        'warning',
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
          toast(
            t ? `No se pudo subir la imagen: ${msg}` : `Could not upload image: ${msg}`,
            'danger',
          );
          setLoading(false);
          return;
        }
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
      const res = await communityApi.createPost({
        content: content.trim() || '',
        imageUrl: uploadedUrl,
        surface: isWallPost ? 'wall' : 'community',
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      refreshUser();
      const status = res.data?.data?.status;
      fb.success();
      if (status === 'PENDING_REVIEW') {
        toast(
          t
            ? 'Publicación en revisión. Recibirás puntos cuando sea aprobada.'
            : 'Pending review. You will get points when approved.',
          'info',
        );
      }
      router.back();
    } catch (err: any) {
      fb.error();
      toast(apiError(err, t ? 'No se pudo publicar.' : 'Could not publish.'), 'danger');
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
              {isWallPost
                ? t
                  ? 'NUEVO · MURO'
                  : 'NEW · WALL'
                : t
                  ? 'NUEVO · COMUNIDAD'
                  : 'NEW · COMMUNITY'}
            </Kicker>
          </View>
          <View style={styles.publishSlot}>
            <Button
              label={t ? 'Publicar' : 'Share'}
              onPress={handleSubmit}
              variant="primary"
              size="sm"
              loading={loading}
              disabled={!canPublish}
              fullWidth
            />
          </View>
        </View>
        <Hairline variant="subtle" />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Surface toggle ────────────── */}
          {canChangeSurface ? (
            <View style={{ marginBottom: Spacing[6] }}>
              <SegmentedControl
                value={surfaceChoice}
                onChange={setSurfaceChoice}
                options={surfaceOptions}
              />
            </View>
          ) : null}

          {/* ── Author row ────────────────── */}
          <View style={styles.authorRow}>
            {user?.profile?.avatarUrl ? (
              <Image source={{ uri: user.profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>
                {fullName}
              </Text>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {isWallPost
                  ? t
                    ? 'Publicas en tu muro'
                    : 'Posting on your wall'
                  : t
                    ? 'Publicas para la comunidad'
                    : 'Posting to the community'}
              </Caption>
            </View>
          </View>

          {/* ── Textarea ──────────────────── */}
          <TextInput
            style={styles.textarea}
            placeholder={
              isWallPost
                ? t
                  ? '¿Qué quieres compartir en tu muro? Usa @ para etiquetar.'
                  : 'What do you want to share? Use @ to tag.'
                : t
                  ? '¿Qué está pasando en OPAL BAR? Usa @ para etiquetar.'
                  : "What's happening at OPAL BAR? Use @ to tag."
            }
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={mention.onChangeText}
            onSelectionChange={mention.onSelectionChange}
            multiline
            maxLength={MAX_LEN}
            autoFocus={!localImage}
            accessibilityLabel={t ? 'Texto de la publicación' : 'Post text'}
          />

          {mention.activeQuery !== null ? (
            <View style={{ marginTop: Spacing[3] }}>
              <MentionSuggestions
                suggestions={mention.suggestions}
                loading={mention.loading}
                onPick={mention.pickSuggestion}
                emptyHint={
                  mention.activeQuery && mention.activeQuery.length > 0
                    ? t
                      ? 'Sin coincidencias'
                      : 'No matches'
                    : undefined
                }
              />
            </View>
          ) : null}

          {/* ── Image preview ─────────────── */}
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
              <Pressy
                onPress={() => {
                  setLocalImage(null);
                  setPhotoTags([]);
                }}
                haptic="tap"
                hitSlop={HitSlop.expand}
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Quitar imagen' : 'Remove image'}
                style={styles.removeBtn}
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressy>
              <Pressy
                onPress={() => setTaggerOpen(true)}
                haptic="select"
                accessibilityRole={Roles.button}
                accessibilityLabel={t ? 'Etiquetar personas' : 'Tag people'}
                style={styles.tagBtn}
              >
                <Feather name="user-plus" size={14} color="#fff" />
                <Text style={styles.tagBtnText}>
                  {photoTags.length > 0
                    ? t
                      ? `${photoTags.length} etiquetad${photoTags.length === 1 ? 'o' : 'os'}`
                      : `${photoTags.length} tagged`
                    : t
                      ? 'Etiquetar'
                      : 'Tag'}
                </Text>
              </Pressy>
            </View>
          ) : null}

          <Caption tone="muted" align="right" style={{ marginTop: Spacing[4] }}>
            {content.length} / {MAX_LEN}
          </Caption>
        </ScrollView>

        {/* ── Bottom action bar ──────────── */}
        <Hairline variant="subtle" />
        <View style={styles.actionBar}>
          <View style={styles.actionRow}>
            <Pressy
              onPress={takePhoto}
              disabled={pickingImage}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Cámara' : 'Camera'}
              style={[styles.actionBtn, pickingImage && { opacity: 0.5 }]}
            >
              <Feather name="camera" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressy>
            <Pressy
              onPress={pickFromGallery}
              disabled={pickingImage}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Galería' : 'Gallery'}
              style={[styles.actionBtn, pickingImage && { opacity: 0.5 }]}
            >
              <Feather name="image" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Galería' : 'Gallery'}</Text>
            </Pressy>
          </View>

          {!localImage ? (
            <View style={styles.ratioRow}>
              {RATIOS.map((r) => {
                const active = selectedRatio === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setSelectedRatio(r.key)}
                    accessibilityRole={Roles.button}
                    accessibilityLabel={`${t ? 'Proporción' : 'Ratio'} ${r.label}`}
                    accessibilityState={{ selected: active }}
                    hitSlop={HitSlop.expand}
                    style={[styles.ratioBtn, active && styles.ratioBtnActive]}
                  >
                    <Text
                      style={[styles.ratioLabel, active && styles.ratioLabelActive]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <PhotoTagger
        visible={taggerOpen}
        imageUri={localImage}
        initialTags={photoTags}
        onClose={() => setTaggerOpen(false)}
        onSubmit={setPhotoTags}
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
  publishSlot: {
    minWidth: 100,
  },

  scrollContent: {
    padding: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[5],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    ...TypePresets.label,
    color: Colors.textPrimary,
    fontSize: 12,
  },
  authorName: {
    ...TypePresets.subhead,
    color: Colors.textPrimary,
  },

  textarea: {
    minHeight: 160,
    color: Colors.textPrimary,
    ...TypePresets.bodyLg,
    textAlignVertical: 'top',
    padding: 0,
  },

  previewWrap: {
    marginTop: Spacing[5],
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  preview: { width: '100%' },
  removeBtn: {
    position: 'absolute',
    top: Spacing[3],
    right: Spacing[3],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBtn: {
    position: 'absolute',
    bottom: Spacing[3],
    left: Spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tagBtnText: {
    ...TypePresets.label,
    color: '#fff',
    fontSize: 11,
  },

  // Bottom action bar
  actionBar: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
    gap: Spacing[3],
    backgroundColor: Colors.bgPrimary,
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
  ratioRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    justifyContent: 'center',
  },
  ratioBtn: {
    minWidth: 56,
    minHeight: 30,
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  ratioBtnActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  ratioLabel: {
    ...TypePresets.label,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  ratioLabelActive: {
    color: Colors.textInverse,
  },
});
