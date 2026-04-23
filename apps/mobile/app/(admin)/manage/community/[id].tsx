import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { adminApi, communityApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

export default function PostModerationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      router.back();
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setBusy(false); }
  }
  async function reject(reason: string) {
    setBusy(true);
    try {
      await adminApi.rejectPost(id, reason);
      router.back();
    } catch (err) { Alert.alert('Error', apiError(err)); }
    finally { setBusy(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>;
  if (!post) return <View style={styles.center}><Text style={{ color: Colors.textMuted }}>Post no encontrado</Text></View>;

  const user = post.user;
  const fullName = `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim() || 'Usuario';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Revisar post</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => id && router.push(`/(app)/community/posts/${id}` as never)}
          hitSlop={8}
        >
          <Feather name="eye" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 14 }}>
        <View style={styles.card}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{fullName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{fullName}</Text>
              <Text style={styles.authorMeta}>{user?.email}</Text>
            </View>
          </View>

          {post.content ? <Text style={styles.body}>{post.content}</Text> : null}
          {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.image} /> : null}

          <View style={styles.metaRow}>
            <MetaChip icon="clock" label={new Date(post.createdAt).toLocaleString('es')} />
            {typeof post.moderationScore === 'number' && (
              <MetaChip
                icon="shield"
                label={`Score: ${post.moderationScore.toFixed(2)}`}
                color={post.moderationScore > 0.5 ? Colors.accentDanger : Colors.accentSuccess}
              />
            )}
            <MetaChip icon="message-circle" label={`${post._count?.comments ?? 0} coms`} />
            <MetaChip icon="heart" label={`${post._count?.reactions ?? 0} likes`} />
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsLabel}>ACCIONES</Text>
          <TouchableOpacity style={styles.approveBtn} onPress={approve} disabled={busy} activeOpacity={0.85}>
            {busy
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <><Feather name="check" size={16} color={Colors.textInverse} />
                  <Text style={styles.approveLbl}>Aprobar y publicar</Text></>}
          </TouchableOpacity>
          <View style={styles.rejectRow}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => reject('Spam')} disabled={busy}>
              <Text style={styles.rejectLbl}>Spam</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => reject('Lenguaje ofensivo')} disabled={busy}>
              <Text style={styles.rejectLbl}>Ofensivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => reject('Fuera de tema')} disabled={busy}>
              <Text style={styles.rejectLbl}>Fuera tema</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaChip({ icon, label, color }: any) {
  return (
    <View style={[styles.metaChip, color && { borderColor: color + '40' }]}>
      <Feather name={icon} size={12} color={color ?? Colors.textMuted} />
      <Text style={[styles.metaChipText, color && { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  authorRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '800', fontSize: 15 },
  authorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  authorMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  body: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },
  image: { width: '100%', height: 220, borderRadius: 12 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  metaChipText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  actionsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionsLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 12,
    backgroundColor: Colors.accentSuccess,
  },
  approveLbl: { color: Colors.textInverse, fontSize: 14, fontWeight: '800' },
  rejectRow: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 40, borderRadius: 10,
    backgroundColor: 'rgba(228,88,88,0.1)',
    borderWidth: 1, borderColor: 'rgba(228,88,88,0.3)',
  },
  rejectLbl: { color: Colors.accentDanger, fontSize: 12, fontWeight: '700' },
});
