import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Dimensions,
  Pressable,
  Share,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usersApi, messagesApi, communityApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { toast } from '@/components/Toast';
import { StoryRing } from '@/components/StoryRing';
import { Heart } from '@/components/Heart';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, Radius } from '@/constants/tokens';
import { sharePost } from '@/utils/share';
import { uploadImage, UploadError } from '@/utils/uploadImage';

// ─────────────────────────────────────────────
//  User Profile — Instagram × Facebook hybrid
//  · FB cover banner + avatar overlapping
//  · IG stats row (flat, no cards)
//  · IG 3-col grid / feed list toggle
//  · Tabs: Muro · Fotos · Comunidad
// ─────────────────────────────────────────────

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - 4) / 3; // 2px gap between tiles

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatRelativeTime(d?: string) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me, refreshUser } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wallPosts, setWallPosts] = useState<any[]>([]);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [tab, setTab] = useState<'grid' | 'feed' | 'community'>('grid');
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    usersApi
      .getPublic(id)
      .then((r) => {
        if (!alive) return;
        setProfile(r.data?.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    Promise.all([
      communityApi.posts({ userId: id, limit: 30, surface: 'wall' }),
      communityApi.posts({ userId: id, limit: 30, surface: 'community' }),
    ])
      .then(([wallRes, communityRes]) => {
        if (!alive) return;
        setWallPosts(wallRes.data?.data?.data ?? []);
        setCommunityPosts(communityRes.data?.data?.data ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setWallPosts([]);
        setCommunityPosts([]);
      })
      .finally(() => {
        if (!alive) return;
        setPostsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.isFollowing) {
        await usersApi.unfollow(id);
        setProfile((p: any) => ({
          ...p,
          isFollowing: false,
          _count: { ...p._count, followers: Math.max(0, (p._count?.followers ?? 1) - 1) },
        }));
        fb.tap();
        toast(t ? 'Dejaste de seguir.' : 'Unfollowed.', 'info');
      } else {
        await usersApi.follow(id);
        setProfile((p: any) => ({
          ...p,
          isFollowing: true,
          _count: { ...p._count, followers: (p._count?.followers ?? 0) + 1 },
        }));
        fb.success();
        toast(t ? 'Ahora sigues a este usuario.' : 'Following.', 'success');
      }
    } catch (err: any) {
      fb.error();
      toast(err?.response?.data?.message || 'Error', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast(
        t ? 'Necesitamos acceso a tus fotos.' : 'We need access to your photos.',
        'danger',
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const localUri = result.assets[0].uri;
      const prevCover = me?.profile?.coverUrl ?? null;
      setCoverUploading(true);
      // Optimistic: show the local URI immediately while the upload runs.
      setProfile((p: any) => ({
        ...p,
        profile: { ...(p?.profile ?? {}), coverUrl: localUri },
      }));
      try {
        const remoteUrl = await uploadImage(localUri, { kind: 'cover' });
        await usersApi.updateProfile({ coverUrl: remoteUrl });
        setProfile((p: any) => ({
          ...p,
          profile: { ...(p?.profile ?? {}), coverUrl: remoteUrl },
        }));
        await refreshUser();
        toast(t ? 'Portada actualizada.' : 'Cover updated.', 'success');
      } catch (err: any) {
        // Revert on failure.
        setProfile((p: any) => ({
          ...p,
          profile: { ...(p?.profile ?? {}), coverUrl: prevCover },
        }));
        const msg = err instanceof UploadError ? err.message : (err?.response?.data?.message || 'Error');
        toast(msg, 'danger');
      } finally {
        setCoverUploading(false);
      }
    } catch {
      setCoverUploading(false);
      toast(t ? 'No se pudo abrir la galería.' : 'Could not open gallery.', 'danger');
    }
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast(
        t ? 'Necesitamos acceso a tus fotos.' : 'We need access to your photos.',
        'danger',
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const localUri = result.assets[0].uri;
      setAvatarUploading(true);
      const prev = profile?.profile?.avatarUrl ?? null;
      setProfile((p: any) => ({
        ...p,
        profile: { ...(p?.profile ?? {}), avatarUrl: localUri },
      }));
      try {
        const remoteUrl = await uploadImage(localUri, { kind: 'avatar' });
        await usersApi.updateProfile({ avatarUrl: remoteUrl });
        setProfile((p: any) => ({
          ...p,
          profile: { ...(p?.profile ?? {}), avatarUrl: remoteUrl },
        }));
        await refreshUser();
        toast(t ? 'Foto actualizada.' : 'Photo updated.', 'success');
      } catch (err: any) {
        setProfile((p: any) => ({
          ...p,
          profile: { ...(p?.profile ?? {}), avatarUrl: prev },
        }));
        const msg = err instanceof UploadError ? err.message : (err?.response?.data?.message || 'Error');
        toast(msg, 'danger');
      } finally {
        setAvatarUploading(false);
      }
    } catch {
      setAvatarUploading(false);
      toast(t ? 'No se pudo abrir la galería.' : 'Could not open gallery.', 'danger');
    }
  }

  // Optimistic like toggle for wall/community posts shown on this profile.
  // Mirrors the community feed's pattern so the UX feels consistent.
  async function toggleReaction(postId: string) {
    const patch = (list: any[]) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              hasReacted: !p.hasReacted,
              _count: {
                ...(p._count ?? {}),
                reactions: (p._count?.reactions ?? 0) + (p.hasReacted ? -1 : 1),
              },
            }
          : p,
      );
    setWallPosts(patch);
    setCommunityPosts(patch);
    // Figure out the next state from the pre-patched list.
    const target =
      wallPosts.find((p) => p.id === postId) ??
      communityPosts.find((p) => p.id === postId);
    const willReact = !target?.hasReacted;
    if (willReact) fb.like(); else fb.tap();
    try {
      if (willReact) await communityApi.react(postId, 'LIKE');
      else await communityApi.removeReaction(postId);
    } catch {
      fb.error();
      // Revert on failure — keep both lists in sync.
      setWallPosts(patch);
      setCommunityPosts(patch);
    }
  }

  async function handleShareProfile() {
    try {
      const handleText = (profile.email || '').split('@')[0];
      const displayName = [profile?.profile?.firstName, profile?.profile?.lastName]
        .filter(Boolean).join(' ').trim() || handleText;
      await Share.share({
        message: t
          ? `Mira el perfil de ${displayName} en OPAL BAR — @${handleText}`
          : `Check out ${displayName} on OPAL BAR — @${handleText}`,
      });
    } catch {}
  }

  function handleReport() {
    Alert.alert(
      t ? 'Reportar perfil' : 'Report profile',
      t
        ? 'Gracias. Nuestro equipo revisará este perfil.'
        : 'Thanks. Our team will review this profile.',
    );
  }

  function handleBlock() {
    Alert.alert(
      t ? 'Bloquear usuario' : 'Block user',
      t
        ? '¿Seguro que quieres bloquear a este usuario?'
        : 'Are you sure you want to block this user?',
      [
        { text: t ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: t ? 'Bloquear' : 'Block',
          style: 'destructive',
          onPress: () => toast(t ? 'Usuario bloqueado.' : 'User blocked.', 'info'),
        },
      ],
    );
  }

  async function handleMessage() {
    try {
      const r = await messagesApi.createThread(id);
      const threadId = r.data?.data?.id;
      if (threadId) router.push(`/(app)/messages/${threadId}` as never);
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', err?.response?.data?.message || 'Error');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t ? 'Usuario no encontrado' : 'User not found'}</Text>
      </View>
    );
  }

  const first = profile?.profile?.firstName ?? '';
  const last = profile?.profile?.lastName ?? '';
  const name = `${first} ${last}`.trim() || profile.email?.split('@')[0] || 'Usuario';
  const initials =
    ((first[0] || '') + (last[0] || '')).toUpperCase() || (profile.email?.[0] ?? 'U').toUpperCase();
  const handle = (profile.email || '').split('@')[0];
  const isMe = me?.id === profile.id;

  // Tile data
  const wallWithMedia = wallPosts.filter((p) => !!p.imageUrl);
  const gridSource = wallWithMedia.length > 0 ? wallWithMedia : wallPosts;
  const feedSource = wallPosts;
  const communitySource = communityPosts;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Top bar (floats above cover) ───── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.topBarBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          @{handle}
        </Text>
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.topBarBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Feather name="more-vertical" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── Cover banner (FB) ───────────────── */}
        <Pressable
          style={styles.cover}
          onPress={isMe ? pickCover : undefined}
          disabled={!isMe || coverUploading}
        >
          {profile?.profile?.coverUrl ? (
            <Image
              source={{ uri: profile.profile.coverUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverGradient} />
          )}
          {isMe && (
            <View style={styles.coverEditBadge}>
              {coverUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="camera" size={13} color="#fff" />
                  <Text style={styles.coverEditLabel}>
                    {profile?.profile?.coverUrl
                      ? t
                        ? 'Cambiar portada'
                        : 'Change cover'
                      : t
                        ? 'Añadir portada'
                        : 'Add cover'}
                  </Text>
                </>
              )}
            </View>
          )}
        </Pressable>

        {/* ── Avatar overlapping cover ───────── */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarInner}>
            <StoryRing
              userId={profile.id}
              avatarUrl={profile?.profile?.avatarUrl ?? null}
              initials={initials}
              fallbackColor={colorFor(profile.id)}
              size="xl"
              showIdleRing
              isSelf={isMe}
            />
            {isMe && (
              <Pressable
                onPress={pickAvatar}
                disabled={avatarUploading}
                style={({ pressed }) => [styles.avatarCameraBadge, pressed && { opacity: 0.85 }]}
                hitSlop={8}
              >
                {avatarUploading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="camera" size={14} color="#fff" />}
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Identity (name + handle, centered) ── */}
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.handle}>@{handle}</Text>

          {profile?.profile?.loyaltyLevel && (
            <View style={styles.levelPill}>
              <Feather
                name={(profile.profile.loyaltyLevel.icon as any) || 'star'}
                size={12}
                color={Colors.accentPrimary}
              />
              <Text style={styles.levelText}>
                {t ? `Nivel ${profile.profile.loyaltyLevel.name}` : `${profile.profile.loyaltyLevel.name} Level`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Bio + About chips ───────────────── */}
        <BioBlock
          bio={profile?.profile?.bio}
          isMe={isMe}
          t={t}
          onEdit={() => router.push('/(app)/profile/edit' as never)}
        />
        <AboutCard
          profile={profile}
          isMe={isMe}
          t={t}
          language={language}
          onEdit={() => router.push('/(app)/profile/edit' as never)}
        />

        {/* ── Stats (IG flat row) ─────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile._count?.posts ?? 0}</Text>
            <Text style={styles.statLabel}>{t ? 'Publicaciones' : 'Posts'}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            onPress={() => router.push(`/(app)/users/${profile.id}/followers` as never)}
          >
            <Text style={styles.statValue}>{profile._count?.followers ?? 0}</Text>
            <Text style={styles.statLabel}>{t ? 'Seguidores' : 'Followers'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            onPress={() => router.push(`/(app)/users/${profile.id}/following` as never)}
          >
            <Text style={styles.statValue}>{profile._count?.following ?? 0}</Text>
            <Text style={styles.statLabel}>{t ? 'Siguiendo' : 'Following'}</Text>
          </Pressable>
        </View>

        {/* ── Actions (IG-style) ──────────────── */}
        {!isMe && (
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.followBtn,
                profile.isFollowing && styles.followingBtn,
                (busy || pressed) && { opacity: 0.85 },
              ]}
              onPress={toggleFollow}
              disabled={busy}
            >
              <Text style={[styles.followLabel, profile.isFollowing && { color: Colors.textPrimary }]}>
                {profile.isFollowing ? (t ? 'Siguiendo' : 'Following') : t ? 'Seguir' : 'Follow'}
              </Text>
              {profile.isFollowing && <Feather name="chevron-down" size={14} color={Colors.textPrimary} />}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.85 }]}
              onPress={handleMessage}
            >
              <Text style={styles.msgLabel}>{t ? 'Mensaje' : 'Message'}</Text>
            </Pressable>
          </View>
        )}
        {isMe && (
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/profile/edit' as never)}
            >
              <Feather name="edit-2" size={14} color={Colors.textPrimary} />
              <Text style={styles.editLabel}>{t ? 'Editar perfil' : 'Edit profile'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/community/new-post?surface=wall' as never)}
            >
              <Feather name="plus" size={14} color={Colors.textPrimary} />
              <Text style={styles.editLabel}>{t ? 'Publicar' : 'Post'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/community/new-story' as never)}
            >
              <Feather name="plus-circle" size={14} color={Colors.textPrimary} />
              <Text style={styles.editLabel}>{t ? 'Historia' : 'Story'}</Text>
            </Pressable>
          </View>
        )}

        {/* ── Tabs (IG icon tabs) ─────────────── */}
        <View style={styles.tabBar}>
          <Pressable
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => setTab('grid')}
          >
            <Feather
              name="grid"
              size={22}
              color={tab === 'grid' ? Colors.textPrimary : Colors.textMuted}
            />
            {tab === 'grid' && <View style={styles.tabMark} />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => setTab('feed')}
          >
            <Feather
              name="align-justify"
              size={22}
              color={tab === 'feed' ? Colors.textPrimary : Colors.textMuted}
            />
            {tab === 'feed' && <View style={styles.tabMark} />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => setTab('community')}
          >
            <Feather
              name="users"
              size={22}
              color={tab === 'community' ? Colors.textPrimary : Colors.textMuted}
            />
            {tab === 'community' && <View style={styles.tabMark} />}
          </Pressable>
        </View>

        {/* ── Content ─────────────────────────── */}
        {postsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.accentPrimary} />
          </View>
        ) : tab === 'grid' ? (
          gridSource.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="camera" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{t ? 'Sin publicaciones' : 'No posts yet'}</Text>
              <Text style={styles.emptySub}>
                {isMe
                  ? t
                    ? 'Cuando publiques algo, aparecerá aquí.'
                    : 'When you share, it will appear here.'
                  : t
                    ? 'Este usuario aún no publica nada.'
                    : 'This user has not posted yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {gridSource.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
                  onPress={() => router.push(`/(app)/community/posts/${p.id}` as never)}
                  onLongPress={() => p.imageUrl && setPreviewImage(p.imageUrl)}
                >
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.tileImg} />
                  ) : (
                    <View style={styles.tileText}>
                      <Feather name="message-square" size={18} color={Colors.textMuted} />
                      <Text style={styles.tileTextContent} numberOfLines={4}>
                        {p.content || ''}
                      </Text>
                    </View>
                  )}
                  {(p._count?.reactions > 0 || p._count?.comments > 0) && (
                    <View style={styles.tileOverlay}>
                      <View style={styles.tileOverlayRow}>
                        <Heart filled size={12} color="#fff" />
                        <Text style={styles.tileOverlayText}>{p._count?.reactions ?? 0}</Text>
                      </View>
                      <View style={styles.tileOverlayRow}>
                        <Feather name="message-circle" size={12} color="#fff" />
                        <Text style={styles.tileOverlayText}>{p._count?.comments ?? 0}</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )
        ) : tab === 'feed' ? (
          <>
            {isMe && (
              <Pressable
                style={({ pressed }) => [styles.wallComposer, pressed && styles.pressed]}
                onPress={() => router.push('/(app)/community/new-post?surface=wall' as never)}
              >
                {profile?.profile?.avatarUrl ? (
                  <Image source={{ uri: profile.profile.avatarUrl }} style={styles.wallComposerAvatar} />
                ) : (
                  <View style={[styles.wallComposerAvatar, { backgroundColor: colorFor(profile.id) }]}>
                    <Text style={styles.wallComposerAvatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.wallComposerInput}>
                  <Text style={styles.wallComposerPlaceholder}>
                    {t ? '¿Qué estás pensando?' : "What's on your mind?"}
                  </Text>
                </View>
                <View style={styles.wallComposerIcon}>
                  <Feather name="image" size={20} color={Colors.accentSuccess} />
                </View>
              </Pressable>
            )}
            <FeedList
              posts={feedSource}
              profile={profile}
              name={name}
              initials={initials}
              t={t}
              onPressPost={(postId) => router.push(`/(app)/community/posts/${postId}` as never)}
              onLongPress={(url) => setPreviewImage(url)}
              onToggleLike={toggleReaction}
            />
          </>
        ) : (
          <FeedList
            posts={communitySource}
            profile={profile}
            name={name}
            initials={initials}
            t={t}
            onPressPost={(postId) => router.push(`/(app)/community/posts/${postId}` as never)}
            onLongPress={(url) => setPreviewImage(url)}
            onToggleLike={toggleReaction}
          />
        )}
      </ScrollView>

      {/* Contextual menu (3-dots) */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            {isMe ? (
              <>
                <MenuItem
                  icon="edit-2"
                  label={t ? 'Editar perfil' : 'Edit profile'}
                  onPress={() => { setMenuOpen(false); router.push('/(app)/profile/edit' as never); }}
                />
                <MenuItem
                  icon="settings"
                  label={t ? 'Configuración' : 'Settings'}
                  onPress={() => { setMenuOpen(false); router.push('/(app)/profile/preferences' as never); }}
                />
                <MenuItem
                  icon="share-2"
                  label={t ? 'Compartir perfil' : 'Share profile'}
                  onPress={() => { setMenuOpen(false); handleShareProfile(); }}
                />
              </>
            ) : (
              <>
                <MenuItem
                  icon="share-2"
                  label={t ? 'Compartir perfil' : 'Share profile'}
                  onPress={() => { setMenuOpen(false); handleShareProfile(); }}
                />
                <MenuItem
                  icon="flag"
                  label={t ? 'Reportar' : 'Report'}
                  onPress={() => { setMenuOpen(false); handleReport(); }}
                />
                <MenuItem
                  icon="slash"
                  label={t ? 'Bloquear' : 'Block'}
                  destructive
                  onPress={() => { setMenuOpen(false); handleBlock(); }}
                />
              </>
            )}
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [styles.menuCancel, pressed && styles.pressed]}
            >
              <Text style={styles.menuCancelLabel}>{t ? 'Cancelar' : 'Cancel'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Image preview modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewImage(null)}
            hitSlop={10}
            activeOpacity={0.7}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuItem({
  icon, label, onPress, destructive,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
    >
      <Feather
        name={icon}
        size={18}
        color={destructive ? Colors.accentDanger : Colors.textPrimary}
      />
      <Text
        style={[
          styles.menuItemLabel,
          destructive && { color: Colors.accentDanger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
//  Bio Block — Instagram-style, left-aligned, prominent
//  · Sits right under identity, full-width, multi-line
//  · When empty + owner → inline prompt linking to edit
//  · When empty + visitor → renders nothing
// ─────────────────────────────────────────────
function BioBlock({
  bio,
  isMe,
  t,
  onEdit,
}: {
  bio?: string | null;
  isMe: boolean;
  t: boolean;
  onEdit: () => void;
}) {
  const trimmed = (bio ?? '').trim();

  if (trimmed) {
    return (
      <View style={styles.bioBlock}>
        <Text style={styles.bioText}>{trimmed}</Text>
      </View>
    );
  }

  if (!isMe) return null;

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.bioPrompt, pressed && styles.pressed]}
    >
      <Feather name="plus-circle" size={14} color={Colors.accentPrimary} />
      <Text style={styles.bioPromptText}>
        {t ? 'Añade una biografía' : 'Add a bio'}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
//  About Card — customizable info shown on every wall
//  · Only non-empty fields render
//  · If owner + all empty → prompt to fill profile
//  · If visitor + all empty → nothing renders
// ─────────────────────────────────────────────
const COUNTRY_NAMES: Record<string, { es: string; en: string }> = {
  MX: { es: 'México', en: 'Mexico' },
  US: { es: 'Estados Unidos', en: 'United States' },
  AR: { es: 'Argentina', en: 'Argentina' },
  CO: { es: 'Colombia', en: 'Colombia' },
  ES: { es: 'España', en: 'Spain' },
  CL: { es: 'Chile', en: 'Chile' },
  PE: { es: 'Perú', en: 'Peru' },
  BR: { es: 'Brasil', en: 'Brazil' },
  FR: { es: 'Francia', en: 'France' },
  GB: { es: 'Reino Unido', en: 'United Kingdom' },
  CA: { es: 'Canadá', en: 'Canada' },
};

const GENDER_LABELS: Record<string, { es: string; en: string }> = {
  FEMALE: { es: 'Mujer', en: 'Woman' },
  MALE: { es: 'Hombre', en: 'Man' },
  NON_BINARY: { es: 'No binario', en: 'Non-binary' },
  OTHER: { es: 'Otro', en: 'Other' },
  PREFER_NOT_TO_SAY: { es: 'Prefiero no decir', en: 'Prefer not to say' },
};

function AboutCard({
  profile,
  isMe,
  t,
  language,
  onEdit,
}: {
  profile: any;
  isMe: boolean;
  t: boolean;
  language: string;
  onEdit: () => void;
}) {
  const p = profile?.profile ?? {};

  const rows: Array<{ icon: React.ComponentProps<typeof Feather>['name']; text: string }> = [];

  if (p.occupation) rows.push({ icon: 'briefcase', text: p.occupation });

  const cityCountry = [
    p.city,
    p.country ? COUNTRY_NAMES[p.country]?.[language as 'es' | 'en'] ?? p.country : null,
  ]
    .filter(Boolean)
    .join(', ');
  if (cityCountry) rows.push({ icon: 'map-pin', text: cityCountry });

  if (p.birthDate) {
    const d = new Date(p.birthDate);
    rows.push({
      icon: 'gift',
      text: d.toLocaleDateString(language, { day: 'numeric', month: 'long' }),
    });
  }

  if (p.gender && GENDER_LABELS[p.gender]) {
    rows.push({ icon: 'user', text: GENDER_LABELS[p.gender][language as 'es' | 'en'] });
  }

  if (profile.createdAt) {
    const year = new Date(profile.createdAt).getFullYear();
    rows.push({ icon: 'clock', text: t ? `Desde ${year}` : `Since ${year}` });
  }

  // Empty state for owner → subtle inline prompt; for visitors → nothing
  if (rows.length === 0) {
    if (!isMe) return null;
    return (
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [styles.aboutEmpty, pressed && styles.pressed]}
      >
        <Feather name="plus" size={13} color={Colors.textMuted} />
        <Text style={styles.aboutEmptyText}>
          {t ? 'Añadir información' : 'Add details'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.aboutWrap}>
      {rows.map((r, i) => (
        <View key={i} style={styles.aboutChip}>
          <Feather name={r.icon} size={12} color={Colors.textMuted} />
          <Text style={styles.aboutChipText} numberOfLines={1}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Feed List — IG/FB hybrid post cards
// ─────────────────────────────────────────────
function FeedList({
  posts,
  profile,
  name,
  initials,
  t,
  onPressPost,
  onLongPress,
  onToggleLike,
}: {
  posts: any[];
  profile: any;
  name: string;
  initials: string;
  t: boolean;
  onPressPost: (id: string) => void;
  onLongPress: (url: string) => void;
  onToggleLike: (postId: string) => void;
}) {
  if (posts.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Feather name="message-square" size={36} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>{t ? 'Sin publicaciones' : 'No posts'}</Text>
      </View>
    );
  }

  async function handleShare(p: any) {
    await sharePost({
      id: p.id,
      content: p.content,
      authorName: name,
      imageUrl: p.imageUrl,
      likes: p._count?.reactions ?? p.likesCount ?? 0,
      comments: p._count?.comments ?? p.commentsCount ?? 0,
      t,
    });
  }

  return (
    <View>
      {posts.map((p) => {
        const likes = p._count?.reactions ?? 0;
        const comments = p._count?.comments ?? 0;
        return (
          <View key={p.id} style={styles.fbCard}>
            <View style={styles.feedHeader}>
              {profile?.profile?.avatarUrl ? (
                <Image source={{ uri: profile.profile.avatarUrl }} style={styles.feedAvatar} />
              ) : (
                <View style={[styles.feedAvatar, { backgroundColor: colorFor(profile.id) }]}>
                  <Text style={styles.feedAvatarText}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.feedName}>{name}</Text>
                <Text style={styles.feedTime}>
                  {formatRelativeTime(p.createdAt)} · <Feather name="globe" size={10} color={Colors.textMuted} />
                </Text>
              </View>
            </View>

            {p.content ? (
              <Pressable onPress={() => onPressPost(p.id)} style={styles.fbTextBox}>
                <Text style={styles.fbText}>{p.content}</Text>
              </Pressable>
            ) : null}

            {p.imageUrl ? (
              <Pressable onPress={() => onPressPost(p.id)} onLongPress={() => onLongPress(p.imageUrl)}>
                <Image source={{ uri: p.imageUrl }} style={styles.fbImage} resizeMode="cover" />
              </Pressable>
            ) : null}

            {(likes > 0 || comments > 0) && (
              <View style={styles.fbStats}>
                {likes > 0 && (
                  <View style={styles.fbStatsLeft}>
                    <View style={styles.fbLikeBubble}>
                      <Heart filled size={10} color="#fff" />
                    </View>
                    <Text style={styles.fbStatsText}>
                      {likes} {likes === 1 ? (t ? 'me gusta' : 'like') : t ? 'me gustan' : 'likes'}
                    </Text>
                  </View>
                )}
                {comments > 0 && (
                  <Pressable onPress={() => onPressPost(p.id)}>
                    <Text style={styles.fbStatsText}>
                      {comments} {comments === 1 ? (t ? 'comentario' : 'comment') : t ? 'comentarios' : 'comments'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.fbActions}>
              <Pressable
                style={({ pressed }) => [styles.fbActionBtn, pressed && styles.pressed]}
                onPress={() => onToggleLike(p.id)}
              >
                <Heart
                  filled={!!p.hasReacted}
                  size={18}
                  color={p.hasReacted ? Colors.accentDanger : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.fbActionLabel,
                    p.hasReacted && { color: Colors.accentDanger, fontWeight: '700' },
                  ]}
                >
                  {t ? 'Me gusta' : 'Like'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.fbActionBtn, pressed && styles.pressed]}
                onPress={() => onPressPost(p.id)}
              >
                <Feather name="message-circle" size={18} color={Colors.textSecondary} />
                <Text style={styles.fbActionLabel}>{t ? 'Comentar' : 'Comment'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.fbActionBtn, pressed && styles.pressed]}
                onPress={() => handleShare(p)}
              >
                <Feather name="share-2" size={18} color={Colors.textSecondary} />
                <Text style={styles.fbActionLabel}>{t ? 'Compartir' : 'Share'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  notFound: { color: Colors.textSecondary },

  pressed: { opacity: 0.7 },

  // Top bar (over cover)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  // Cover banner
  cover: {
    height: 140,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.accentPrimaryDark,
    opacity: 0.35,
  },
  coverEditBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverEditLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Avatar overlapping
  avatarWrap: {
    alignItems: 'center',
    marginTop: -54,
  },
  avatarInner: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
    borderWidth: 3,
    borderColor: Colors.bgPrimary,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGap: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontSize: 32, fontWeight: '800' },

  // Identity
  identity: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
    gap: 4,
  },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  handle: { color: Colors.textMuted, fontSize: 13 },
  bio: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },

  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 163, 64, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  levelText: { color: Colors.accentPrimary, fontSize: 12, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },

  // Stats (flat, IG)
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingHorizontal: 24,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: Colors.textSecondary, fontSize: 12 },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 16,
  },
  followBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 10,
  },
  followingBtn: {
    backgroundColor: Colors.bgElevated,
  },
  followLabel: { color: Colors.textInverse, fontSize: 14, fontWeight: '700' },
  msgBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
  },
  msgLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
  },
  editLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },

  // Bio — subtle, centered under identity
  bioBlock: {
    paddingHorizontal: 28,
    marginTop: 10,
  },
  bioText: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  bioPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
  },
  bioPromptText: {
    color: Colors.accentPrimary,
    fontSize: 13,
    fontWeight: '600',
  },

  // About — subtle inline chip row, centered under identity
  aboutWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 4,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  aboutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  aboutChipText: {
    color: Colors.textMuted,
    fontSize: 12.5,
    fontWeight: '500',
  },
  aboutEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    marginTop: 10,
    paddingVertical: 4,
    opacity: 0.7,
  },
  aboutEmptyText: {
    color: Colors.textMuted,
    fontSize: 12.5,
    fontWeight: '500',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabMark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.textPrimary,
  },

  // Loading / empty
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },

  // Grid (IG 3-col)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingHorizontal: 0,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: Colors.bgCard,
    position: 'relative',
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },
  tileText: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  tileTextContent: {
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  tileOverlay: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tileOverlayRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tileOverlayText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Feed card (list view)
  feedCard: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarText: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  feedName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  feedTime: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  feedText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  feedImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
  },
  feedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  feedStatText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  feedStatsDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted, marginHorizontal: 6 },

  // Wall composer (FB-style)
  wallComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  wallComposerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallComposerAvatarText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  wallComposerInput: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wallComposerPlaceholder: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  wallComposerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FB-style feed card (wall)
  fbCard: {
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 6,
    borderBottomColor: Colors.bgPrimary,
    backgroundColor: Colors.bgCard,
    gap: 10,
  },
  fbTextBox: {
    paddingHorizontal: 14,
  },
  fbText: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  fbImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.bgElevated,
  },
  fbStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  fbStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fbLikeBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbStatsText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  fbActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  fbActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fbActionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '80%' },

  // Contextual 3-dots menu
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  menuItemLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  menuCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  menuCancelLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
