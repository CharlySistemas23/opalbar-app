import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { mentionsApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { toast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Spacing, Typography } from '@/constants/tokens';

// ─────────────────────────────────────────────
//  Mention Approvals — pending tag requests
//  · Author wanted to tag me on a post/story
//  · I approve → goes public; reject → hidden permanently
// ─────────────────────────────────────────────

const AVATAR_COLORS = ['#F4A340', '#60A5FA', '#A855F7', '#38C793', '#E45858', '#EC4899'];

function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type Row = {
  id: string;
  targetType: 'POST' | 'STORY';
  targetId: string;
  createdAt: string;
  author: {
    id: string;
    profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
  };
};

export default function MentionRequests() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    mentionsApi
      .pending(50)
      .then((r) => setItems(r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function approve(row: Row) {
    setBusy(row.id, true);
    const prev = items;
    setItems((p) => p.filter((r) => r.id !== row.id));
    try {
      await mentionsApi.approve(row.id);
      fb.success();
      toast(t ? 'Etiqueta aprobada.' : 'Tag approved.', 'success');
    } catch (err: any) {
      setItems(prev);
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setBusy(row.id, false);
    }
  }

  async function reject(row: Row) {
    setBusy(row.id, true);
    const prev = items;
    setItems((p) => p.filter((r) => r.id !== row.id));
    try {
      await mentionsApi.reject(row.id);
      fb.tap();
    } catch (err: any) {
      setItems(prev);
      fb.error();
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    } finally {
      setBusy(row.id, false);
    }
  }

  function openTarget(row: Row) {
    if (row.targetType === 'POST') {
      router.push(`/(app)/community/posts/${row.targetId}` as never);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Etiquetas' : 'Tag requests'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={load}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Row
              row={item}
              t={t}
              busy={busyIds.has(item.id)}
              onPress={() => openTarget(item)}
              onApprove={() => approve(item)}
              onReject={() => reject(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="user-check"
              title={t ? 'Sin etiquetas pendientes' : 'No pending tags'}
              message={
                t
                  ? 'Cuando alguien intente etiquetarte y necesite tu aprobación, aparecerá aquí.'
                  : 'When someone tries to tag you and needs your approval, it will appear here.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  row,
  t,
  busy,
  onPress,
  onApprove,
  onReject,
}: {
  row: Row;
  t: boolean;
  busy: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const a = row.author;
  const fn = a.profile?.firstName ?? '';
  const ln = a.profile?.lastName ?? '';
  const name = `${fn} ${ln}`.trim() || 'Usuario';
  const initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'U';
  const isStory = row.targetType === 'STORY';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.requestRow, pressed && { opacity: 0.85 }]}
    >
      {a.profile?.avatarUrl ? (
        <Image source={{ uri: a.profile.avatarUrl }} style={styles.rowAvatar} />
      ) : (
        <View style={[styles.rowAvatar, { backgroundColor: colorFor(a.id) }]}>
          <Text style={styles.rowAvatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {t
            ? isStory
              ? 'Quiere etiquetarte en una historia'
              : 'Quiere etiquetarte en una publicación'
            : isStory
              ? 'Wants to tag you in a story'
              : 'Wants to tag you in a post'}
        </Text>
        <View style={styles.rowActions}>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={({ pressed }) => [
              styles.confirmBtn,
              (busy || pressed) && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.confirmLabel}>{t ? 'Aprobar' : 'Approve'}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={busy}
            style={({ pressed }) => [
              styles.declineBtn,
              (busy || pressed) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.declineLabel}>{t ? 'Rechazar' : 'Reject'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },

  requestRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: Colors.textInverse, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, gap: 6, justifyContent: 'center' },
  rowName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textMuted, fontSize: 12 },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  confirmBtn: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.bgElevated,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
