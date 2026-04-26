import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { usersApi } from '@/api/client';

// ─────────────────────────────────────────────
//  PhotoTagger — IG-style "tap to tag" overlay
//  · User taps a face → coords [0,1] captured → search a user → tag.
//  · Existing tags rendered as removable chips at their coord.
//  · Returns the full tag array on submit.
// ─────────────────────────────────────────────

export type PhotoTag = {
  userId: string;
  x: number; // 0..1
  y: number; // 0..1
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  visible: boolean;
  imageUri: string | null;
  initialTags?: PhotoTag[];
  onClose: () => void;
  onSubmit: (tags: PhotoTag[]) => void;
};

export function PhotoTagger({ visible, imageUri, initialTags, onClose, onSubmit }: Props) {
  const [tags, setTags] = useState<PhotoTag[]>(initialTags ?? []);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [imageLayout, setImageLayout] = useState({ width: 1, height: 1 });

  const handleImagePress = (e: any) => {
    if (!imageLayout.width) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0, Math.min(1, locationX / imageLayout.width));
    const y = Math.max(0, Math.min(1, locationY / imageLayout.height));
    setPending({ x, y });
    setQuery('');
    setResults([]);
  };

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await usersApi.search(q.trim(), 10);
      const list = res.data?.data ?? res.data ?? [];
      setResults(Array.isArray(list) ? list : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const confirmTag = (user: any) => {
    if (!pending) return;
    const fn = (user.firstName ?? user.profile?.firstName ?? '').trim();
    const ln = (user.lastName ?? user.profile?.lastName ?? '').trim();
    const displayName = `${fn} ${ln}`.trim() || user.username || 'Usuario';
    const next: PhotoTag = {
      userId: user.id,
      x: pending.x,
      y: pending.y,
      displayName,
      username: user.username,
      avatarUrl: user.avatarUrl ?? user.profile?.avatarUrl ?? null,
    };
    // Replace if same user already tagged.
    setTags((prev) => [...prev.filter((t) => t.userId !== user.id), next]);
    setPending(null);
    setQuery('');
    setResults([]);
  };

  const removeTag = (userId: string) => {
    setTags((prev) => prev.filter((t) => t.userId !== userId));
  };

  const handleDone = () => {
    onSubmit(tags);
    onClose();
  };

  const overlayChips = useMemo(
    () =>
      tags.map((t) => (
        <Pressable
          key={t.userId}
          onPress={() => removeTag(t.userId)}
          style={[
            styles.chip,
            {
              left: Math.max(0, t.x * imageLayout.width - 60),
              top: Math.max(0, t.y * imageLayout.height - 14),
            },
          ]}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {t.displayName}
          </Text>
          <Feather name="x" size={12} color="#fff" />
        </Pressable>
      )),
    [tags, imageLayout],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={10}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Etiquetar personas</Text>
            <Pressable onPress={handleDone} style={[styles.headerBtn, styles.doneBtn]}>
              <Text style={styles.doneLabel}>Listo</Text>
            </Pressable>
          </View>

          <View style={styles.canvas}>
            {imageUri ? (
              <Pressable onPress={handleImagePress} style={{ width: '100%', height: '100%' }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  onLayout={(e) =>
                    setImageLayout({
                      width: e.nativeEvent.layout.width,
                      height: e.nativeEvent.layout.height,
                    })
                  }
                />
                {overlayChips}
                {pending && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.pendingDot,
                      {
                        left: pending.x * imageLayout.width - 8,
                        top: pending.y * imageLayout.height - 8,
                      },
                    ]}
                  />
                )}
              </Pressable>
            ) : (
              <Text style={{ color: Colors.textMuted }}>Sin imagen.</Text>
            )}
          </View>

          {pending ? (
            <View style={styles.searchPanel}>
              <View style={styles.searchInputRow}>
                <Feather name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar persona…"
                  placeholderTextColor={Colors.textMuted}
                  value={query}
                  onChangeText={search}
                  autoFocus
                />
                <Pressable onPress={() => setPending(null)} hitSlop={10}>
                  <Feather name="x" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
                {searching && (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator size="small" color={Colors.accentPrimary} />
                  </View>
                )}
                {!searching && results.length === 0 && query.length > 0 && (
                  <Text style={styles.searchEmpty}>Sin resultados.</Text>
                )}
                {results.map((u) => {
                  const fn = (u.firstName ?? u.profile?.firstName ?? '').trim();
                  const ln = (u.lastName ?? u.profile?.lastName ?? '').trim();
                  const name = `${fn} ${ln}`.trim() || u.username || 'Usuario';
                  const avatar = u.avatarUrl ?? u.profile?.avatarUrl ?? null;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => confirmTag(u)}
                      style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.7 }]}
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.resultAvatar} />
                      ) : (
                        <View style={[styles.resultAvatar, styles.resultAvatarFallback]}>
                          <Text style={styles.resultAvatarText}>
                            {(fn[0] || u.username?.[0] || '?').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{name}</Text>
                        {u.username && <Text style={styles.resultHandle}>@{u.username}</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.hintBar}>
              <Feather name="user-plus" size={14} color={Colors.textMuted} />
              <Text style={styles.hintText}>
                Toca la foto donde quieres etiquetar a alguien.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  doneBtn: {
    backgroundColor: Colors.accentPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  doneLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },

  canvas: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pendingDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accentPrimary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: 140,
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  searchPanel: {
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },
  searchLoading: { paddingVertical: 14, alignItems: 'center' },
  searchEmpty: { color: Colors.textMuted, fontSize: 13, padding: 14 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  resultAvatar: { width: 36, height: 36, borderRadius: 18 },
  resultAvatarFallback: {
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  resultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultHandle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  hintText: { color: Colors.textMuted, fontSize: 13 },
});
