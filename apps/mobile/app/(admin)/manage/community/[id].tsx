import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Button, Caption, Kicker, Sheet, Subhead } from '@/components/ui';
import { AdminHeader } from '@/components/admin';

const REJECT_REASONS = ['Spam', 'Lenguaje ofensivo', 'Fuera de tema'];

export default function PostModerationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(admin)/manage/community');
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    communityApi.post(id)
      .then((r) => setPost(r.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function approve() {
    setBusy(true);
    try {
      await adminApi.approvePost(id);
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }
  async function reject(reason: string) {
    setRejectOpen(false);
    setBusy(true);
    try {
      await adminApi.rejectPost(id, reason);
      goBack();
    } catch (err) {
      Alert.alert('Error', apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    try {
      await adminApi.pinPost(id, !post.isPinned);
      Alert.alert('OK', post.isPinned ? 'Post desfijado' : 'Post fijado en el feed');
      setPost({ ...post, isPinned: !post.isPinned });
    } catch (e: any) {
      Alert.alert('Error', apiError(e));
    }
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  if (!post)
    return (
      <View style={styles.center}>
        <Caption tone="muted">Post no encontrado</Caption>
      </View>
    );

  const user = post.user;
  const fullName =
    `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AdminHeader
        title="Revisar post"
        kicker="Moderacion"
        onBack={goBack}
        right={
          <Pressable
            onPress={() => id && router.push(`/(app)/community/posts/${id}` as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver en feed"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Feather name="eye" size={16} color={Colors.textPrimary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: 140, gap: Spacing[3] }}>
        <View style={styles.card}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Body tone="inverse" weight="bold">
                {fullName[0]?.toUpperCase() ?? '?'}
              </Body>
            </View>
            <View style={{ flex: 1 }}>
              <Subhead>{fullName}</Subhead>
              <Caption tone="muted" style={{ marginTop: 2 }}>
                {user?.email}
              </Caption>
            </View>
          </View>

          {post.content ? <Body>{post.content}</Body> : null}
          {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.image} /> : null}

          <View style={styles.metaRow}>
            <MetaChip icon="clock" label={new Date(post.createdAt).toLocaleString('es')} />
            {typeof post.moderationScore === 'number' && (
              <MetaChip
                icon="shield"
                label={`Score: ${post.moderationScore.toFixed(2)}`}
                tone={post.moderationScore > 0.5 ? 'danger' : 'success'}
              />
            )}
            <MetaChip icon="message-circle" label={`${post._count?.comments ?? 0} coms`} />
            <MetaChip icon="heart" label={`${post._count?.reactions ?? 0} likes`} />
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Kicker tone="muted">Acciones</Kicker>
          <Button
            label="Aprobar y publicar"
            variant="primary"
            onPress={approve}
            loading={busy}
            disabled={busy}
            leftIcon={<Feather name="check" size={16} color={Colors.textInverse} />}
          />
          <Button
            label="Rechazar..."
            variant="danger"
            onPress={() => setRejectOpen(true)}
            disabled={busy}
            leftIcon={<Feather name="x" size={16} color={Colors.accentDanger} />}
          />
          <Button
            label={post.isPinned ? 'Desfijar del feed' : 'Fijar en el feed'}
            variant="secondary"
            onPress={togglePin}
            disabled={busy}
            leftIcon={
              <Feather
                name="bookmark"
                size={16}
                color={post.isPinned ? Colors.accentDanger : Colors.textPrimary}
              />
            }
          />
        </View>
      </ScrollView>

      <Sheet open={rejectOpen} onClose={() => setRejectOpen(false)} title="Motivo de rechazo">
        <View style={{ gap: Spacing[2] }}>
          {REJECT_REASONS.map((r) => (
            <Button key={r} label={r} variant="secondary" onPress={() => reject(r)} />
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function MetaChip({
  icon,
  label,
  tone,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone?: 'danger' | 'success';
}) {
  const color =
    tone === 'danger'
      ? Colors.accentDanger
      : tone === 'success'
        ? Colors.accentSuccess
        : Colors.textMuted;
  return (
    <View style={[styles.metaChip, tone && { borderColor: color + '40' }]}>
      <Feather name={icon} size={12} color={color} />
      <Caption style={{ color }} size="sm">{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  pressed: { opacity: 0.7 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    gap: Spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  authorRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: { width: '100%', height: 220, borderRadius: Radius.lg },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },

  actionsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
