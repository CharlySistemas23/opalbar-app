// ─────────────────────────────────────────────
//  New Post — Editorial Premium
//
//  Composer for wall + community posts.
//   · Header: close (X) + Kicker "NUEVO"/"EDITAR" + primary publish button
//   · Surface toggle: SegmentedControl ("Mi muro" / "Comunidad") — hidden
//     when launched with a fixed ?surface= or in edit mode
//   · Author row: avatar + name + scope hint
//   · Body: editorial multi-line input (no card), 2000 char cap
//   · Up to 4 image thumbnails with remove buttons + "add" tile
//   · Bottom action bar: Camera + Galería buttons
//   · Toast (no Alert) for non-critical info
//   · ?editId= loads an existing post and PATCHes instead of creating
//   · ?openPicker=1 auto-opens the gallery picker on mount
// ─────────────────────────────────────────────
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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

const MAX_LEN = 2000;
const MAX_IMAGES = 4;

type Surface = 'wall' | 'community';

export default function NewPost() {
  const router = useRouter();
  const fb = useFeedback();
  const {
    surface: surfaceParam,
    openPicker: openPickerParam,
    editId,
  } = useLocalSearchParams<{
    surface?: string;
    openPicker?: string;
    editId?: string;
  }>();
  const isEditMode = !!editId;
  const { user, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [surfaceChoice, setSurfaceChoice] = useState<Surface>(
    surfaceParam === 'wall' ? 'wall' : 'community',
  );
  const isWallPost = surfaceChoice === 'wall';
  const canChangeSurface = !surfaceParam && !isEditMode;

  const mention = useMentionAutocomplete();
  const content = mention.text;
  const [images, setImages] = useState<string[]>([]);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [taggerOpen, setTaggerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPost, setLoadingPost] = useState(isEditMode);
  const [pickingImage, setPickingImage] = useState(false);

  const surfaceOptions: SegmentOption<Surface>[] = [
    { value: 'wall', label: t ? 'Mi muro' : 'My wall' },
    { value: 'community', label: t ? 'Comunidad' : 'Community' },
  ];

  // ── Edit mode: load the existing post and prefill ─────────
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    (async () => {
      try {
        const r = await communityApi.post(editId);
        const p = r.data?.data;
        if (!alive || !p) return;
        mention.setText(p.content ?? '');
        const media: string[] =
          Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0
            ? p.mediaUrls
            : p.imageUrl
              ? [p.imageUrl]
              : [];
        setImages(media);
        if (p.surface === 'wall') setSurfaceChoice('wall');
      } catch (err) {
        toast(
          apiError(err, t ? 'No se pudo cargar la publicación.' : 'Could not load the post.'),
          'danger',
        );
        router.back();
      } finally {
        if (alive) setLoadingPost(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ── ?openPicker=1 → open the gallery picker once on mount ──
  const openPickerFired = useRef(false);
  useEffect(() => {
    if (openPickerFired.current || openPickerParam !== '1' || isEditMode) return;
    openPickerFired.current = true;
    pickFromGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPickerParam, isEditMode]);

  async function pickFromGallery() {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast(
        t ? `Puedes agregar hasta ${MAX_IMAGES} fotos.` : `You can add up to ${MAX_IMAGES} photos.`,
        'warning',
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast(t ? 'Necesitamos acceso a tu galería.' : 'We need photo library access.', 'warning');
        return;
      }
      setPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
      });
      if (!result.canceled && result.assets.length > 0) {
        setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
      }
    } catch (err) {
      toast(t ? 'No se pudo abrir la galería.' : 'Could not open the photo library.', 'danger');
    } finally {
      setPickingImage(false);
    }
  }

  async function takePhoto() {
    if (images.length >= MAX_IMAGES) {
      toast(
        t ? `Puedes agregar hasta ${MAX_IMAGES} fotos.` : `You can add up to ${MAX_IMAGES} photos.`,
        'warning',
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast(t ? 'Necesitamos acceso a la cámara.' : 'We need camera access.', 'warning');
        return;
      }
      setPickingImage(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
      }
    } catch (err) {
      toast(t ? 'No se pudo abrir la cámara.' : 'Could not open the camera.', 'danger');
    } finally {
      setPickingImage(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (index === 0) setPhotoTags([]);
  }

  const firstName = user?.profile?.firstName ?? '';
  const lastName = user?.profile?.lastName ?? '';
  const fullName =
    `${firstName} ${lastName}`.trim() || user?.email?.split('@')[0] || 'Usuario';
  const initials =
    ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() ||
    (user?.email?.[0]?.toUpperCase() ?? 'U');

  async function handleSubmit() {
    if (!content.trim() && images.length === 0) return;
    setLoading(true);
    try {
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        try {
          uploadedUrls = await Promise.all(
            images.map((uri) => uploadImage(uri, { kind: 'post' })),
          );
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

      if (editId) {
        const editRes = await communityApi.updatePost(editId, {
          content: content.trim() || '',
          mediaUrls: uploadedUrls,
        });
        fb.success();
        if (editRes.data?.data?.status === 'PENDING_REVIEW') {
          toast(
            t
              ? 'Tu publicación está en revisión tras el cambio.'
              : 'Your post is in review after this change.',
            'info',
            3600,
          );
        } else {
          toast(t ? 'Publicación actualizada.' : 'Post updated.', 'success');
        }
        router.back();
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
      const res = await communityApi.createPost({
        content: content.trim() || '',
        mediaUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        surface: isWallPost ? 'wall' : 'community',
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      refreshUser();
      const status = res.data?.data?.status;
      fb.success();
      if (status === 'PENDING_REVIEW') {
        toast(
          t
            ? 'Tu publicación está en revisión. Recibirás tus puntos cuando sea aprobada.'
            : 'Your post is in review. You will get your points once approved.',
          'info',
          3600,
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

  const canPublish = (content.trim().length > 0 || images.length > 0) && !loading && !loadingPost;

  if (loadingPost) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      </SafeAreaView>
    );
  }

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
              {isEditMode
                ? t
                  ? 'EDITAR PUBLICACIÓN'
                  : 'EDIT POST'
                : isWallPost
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
              label={
                isEditMode
                  ? t
                    ? 'Guardar cambios'
                    : 'Save changes'
                  : t
                    ? 'Publicar'
                    : 'Share'
              }
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
            autoFocus={images.length === 0 && !isEditMode}
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

          {/* ── Image thumbnails ──────────── */}
          {images.length > 0 ? (
            <View style={styles.thumbsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbsRow}
              >
                {images.map((uri, i) => (
                  <View key={`${i}-${uri}`} style={styles.thumbBox}>
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    <Pressy
                      onPress={() => removeImage(i)}
                      haptic="tap"
                      hitSlop={HitSlop.expand}
                      accessibilityRole={Roles.button}
                      accessibilityLabel={t ? 'Quitar imagen' : 'Remove image'}
                      style={styles.thumbRemove}
                    >
                      <Feather name="x" size={13} color="#fff" />
                    </Pressy>
                    {i === 0 ? (
                      <Pressy
                        onPress={() => setTaggerOpen(true)}
                        haptic="select"
                        accessibilityRole={Roles.button}
                        accessibilityLabel={t ? 'Etiquetar personas' : 'Tag people'}
                        style={styles.thumbTag}
                      >
                        <Feather name="user-plus" size={11} color="#fff" />
                        {photoTags.length > 0 ? (
                          <Text style={styles.thumbTagText}>{photoTags.length}</Text>
                        ) : null}
                      </Pressy>
                    ) : null}
                  </View>
                ))}
                {images.length < MAX_IMAGES ? (
                  <Pressy
                    onPress={pickFromGallery}
                    disabled={pickingImage}
                    haptic="select"
                    accessibilityRole={Roles.button}
                    accessibilityLabel={t ? 'Agregar foto' : 'Add photo'}
                    style={[styles.thumbAdd, pickingImage && { opacity: 0.5 }]}
                  >
                    <Feather name="plus" size={22} color={Colors.textSecondary} />
                  </Pressy>
                ) : null}
              </ScrollView>
              <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
                {t ? `${images.length}/${MAX_IMAGES} fotos` : `${images.length}/${MAX_IMAGES} photos`}
              </Caption>
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
              disabled={pickingImage || images.length >= MAX_IMAGES}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Cámara' : 'Camera'}
              style={[
                styles.actionBtn,
                (pickingImage || images.length >= MAX_IMAGES) && { opacity: 0.5 },
              ]}
            >
              <Feather name="camera" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Cámara' : 'Camera'}</Text>
            </Pressy>
            <Pressy
              onPress={pickFromGallery}
              disabled={pickingImage || images.length >= MAX_IMAGES}
              haptic="select"
              accessibilityRole={Roles.button}
              accessibilityLabel={t ? 'Galería' : 'Gallery'}
              style={[
                styles.actionBtn,
                (pickingImage || images.length >= MAX_IMAGES) && { opacity: 0.5 },
              ]}
            >
              <Feather name="image" size={18} color={Colors.textPrimary} />
              <Text style={styles.actionLabel}>{t ? 'Galería' : 'Gallery'}</Text>
            </Pressy>
          </View>
        </View>
      </KeyboardAvoidingView>

      <PhotoTagger
        visible={taggerOpen}
        imageUri={images[0] ?? null}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  // Thumbnails
  thumbsWrap: {
    marginTop: Spacing[5],
  },
  thumbsRow: {
    gap: Spacing[3],
  },
  thumbBox: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  thumbTagText: {
    ...TypePresets.label,
    color: '#fff',
    fontSize: 10,
  },
  thumbAdd: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderStyle: 'dashed',
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
});
