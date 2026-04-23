import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { adminApi, communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { toast } from '@/components/Toast';
import { uploadImage, UploadError } from '@/utils/uploadImage';

// ─────────────────────────────────────────────
//  Admin — Venue Stories (OPAL BAR PV)
//  · Lists active 24h venue stories
//  · Create new one via camera / gallery
//  · Delete any active story
// ─────────────────────────────────────────────

interface VenueStory {
  id: string;
  mediaUrl: string;
  caption?: string | null;
  viewsCount: number;
  createdAt: string;
  expiresAt: string;
}

function hoursLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (60 * 60 * 1000)));
}

export default function AdminVenueStories() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<VenueStory[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [picking, setPicking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.venueStories.list();
      const payload = r.data?.data ?? r.data ?? {};
      setStories(payload.data ?? []);
    } catch (err) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function resetComposer() {
    setLocalImage(null);
    setCaption('');
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t ? 'Permiso requerido' : 'Permission required',
        t ? 'Necesitamos acceso a tu galería.' : 'We need gallery access.',
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
      await adminApi.venueStories.create({
        mediaUrl,
        caption: caption.trim() || undefined,
      });
      toast(t ? 'Historia publicada' : 'Story published', 'success');
      setComposerOpen(false);
      resetComposer();
      load();
    } catch (err) {
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setPublishing(false);
    }
  }

  function confirmDelete(story: VenueStory) {
    Alert.alert(
      t ? 'Eliminar historia' : 'Delete story',
      t
        ? '¿Seguro que quieres eliminarla? Esta acción no se puede deshacer.'
        : 'Are you sure? This cannot be undone.',
      [
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: t ? 'Eliminar' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityApi.deleteStory(story.id);
              toast(t ? 'Historia eliminada' : 'Story deleted', 'success');
              setStories((prev) => prev.filter((s) => s.id !== story.id));
            } catch (err) {
              Alert.alert(t ? 'Error' : 'Error', apiError(err));
            }
          },
        },
      ],
    );
  }

  const canPublish = !!localImage && !publishing;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
          <Feather name="chevron-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t ? 'Historias del bar' : 'Venue stories'}</Text>
        <Pressable
          onPress={() => {
            resetComposer();
            setComposerOpen(true);
          }}
          style={styles.headerBtnPrimary}
          hitSlop={10}
        >
          <Feather name="plus" size={18} color={Colors.textInverse} />
        </Pressable>
      </View>

      <View style={styles.subheader}>
        <Feather name="info" size={13} color={Colors.textMuted} />
        <Text style={styles.subheaderText}>
          {t
            ? 'Estas historias aparecen como OPAL BAR PV en la comunidad.'
            : 'These stories show as OPAL BAR PV in the community.'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: 40 }} />
      ) : stories.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="image" size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>
            {t ? 'Sin historias activas' : 'No active stories'}
          </Text>
          <Text style={styles.emptyText}>
            {t
              ? 'Publica una historia del bar. Dura 24 horas y la verán todos.'
              : 'Post a venue story. Lasts 24h and visible to everyone.'}
          </Text>
          <Pressable
            onPress={() => {
              resetComposer();
              setComposerOpen(true);
            }}
            style={styles.emptyCta}
          >
            <Feather name="plus" size={16} color={Colors.textInverse} />
            <Text style={styles.emptyCtaText}>
              {t ? 'Nueva historia' : 'New story'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {stories.map((story) => (
            <View key={story.id} style={styles.card}>
              <Image source={{ uri: story.mediaUrl }} style={styles.cardImg} resizeMode="cover" />
              <View style={styles.cardInfo}>
                {story.caption ? (
                  <Text style={styles.cardCaption} numberOfLines={2}>
                    {story.caption}
                  </Text>
                ) : null}
                <View style={styles.cardMeta}>
                  <View style={styles.metaItem}>
                    <Feather name="eye" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{story.viewsCount}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>
                      {hoursLeft(story.expiresAt)}h {t ? 'restantes' : 'left'}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => confirmDelete(story)} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={14} color={Colors.accentDanger} />
                  <Text style={styles.deleteBtnText}>{t ? 'Eliminar' : 'Delete'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Composer modal */}
      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.header}>
              <Pressable
                onPress={() => {
                  setComposerOpen(false);
                  resetComposer();
                }}
                style={styles.headerBtn}
                hitSlop={10}
              >
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.headerTitle}>
                {t ? 'Nueva historia del bar' : 'New venue story'}
              </Text>
              <Pressable
                onPress={publish}
                disabled={!canPublish}
                style={[styles.headerBtnPrimary, !canPublish && { opacity: 0.4 }]}
              >
                {publishing ? (
                  <ActivityIndicator color={Colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.publishText}>{t ? 'Publicar' : 'Share'}</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.canvas}>
              {localImage ? (
                <>
                  <Image source={{ uri: localImage }} style={styles.preview} resizeMode="cover" />
                  <Pressable
                    onPress={() => {
                      setLocalImage(null);
                    }}
                    style={styles.retakeBtn}
                  >
                    <Feather name="refresh-cw" size={14} color="#fff" />
                    <Text style={styles.retakeText}>{t ? 'Cambiar' : 'Retake'}</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.emptyCanvas}>
                  <View style={styles.emptyIcon}>
                    <Feather name="image" size={32} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {t ? 'Selecciona una foto' : 'Pick a photo'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {t ? 'Formato vertical 9:16 recomendado' : '9:16 vertical format recommended'}
                  </Text>
                </View>
              )}
            </View>

            {localImage && (
              <View style={styles.captionBar}>
                <TextInput
                  style={styles.captionInput}
                  placeholder={t ? 'Leyenda opcional…' : 'Optional caption…'}
                  placeholderTextColor={Colors.textMuted}
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={200}
                  multiline
                />
                <Text style={styles.captionCount}>{caption.length} / 200</Text>
              </View>
            )}

            <View style={styles.actionBar}>
              <Pressable
                onPress={pickFromCamera}
                disabled={picking}
                style={[styles.actionBtn, picking && { opacity: 0.5 }]}
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
                style={[styles.actionBtn, picking && { opacity: 0.5 }]}
              >
                {picking ? (
                  <ActivityIndicator color={Colors.accentPrimary} size="small" />
                ) : (
                  <Feather name="image" size={20} color={Colors.accentPrimary} />
                )}
                <Text style={styles.actionBtnLabel}>{t ? 'Galería' : 'Gallery'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPrimary: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  publishText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.bgCard,
  },
  subheaderText: { color: Colors.textMuted, fontSize: 12, flex: 1 },

  list: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cardImg: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
  },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  cardCaption: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: 14, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 8,
  },
  deleteBtnText: { color: Colors.accentDanger, fontSize: 12, fontWeight: '700' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyCanvas: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accentPrimary,
  },
  emptyCtaText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  canvas: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%' },
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
  retakeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
  captionCount: { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
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
