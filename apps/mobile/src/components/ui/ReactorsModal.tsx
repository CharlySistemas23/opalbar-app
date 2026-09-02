// ─────────────────────────────────────────────
//  ReactorsModal — FB-style "who reacted" sheet.
//  Tabs by emoji (All / 😂 / ❤️ / ...). Each row: avatar + name + emoji.
//  Tap a user → push to their profile.
// ─────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Colors } from '@/constants/tokens';
import { communityApi } from '@/api/client';
import { apiError } from '@/api/errors';

export interface Reactor {
  userId: string;
  name: string;
  avatarUrl: string | null;
  emoji: string;
  createdAt?: string;
}

interface ReactorsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  /** true = Spanish (app default), false = English. */
  t?: boolean;
}

const AVATAR_COLORS = ['#C9A961', '#7FA0BC', '#9F8DBE', '#6FA88A', '#C46868', '#C48A8A'];
function colorFor(id: string) {
  const idx = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function initialsFor(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export function ReactorsModal({ visible, postId, onClose, t = true }: ReactorsModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Reactor[]>([]);
  const [tab, setTab] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!postId) return () => {};
    let cancelled = false;
    setLoading(true);
    setError(null);
    communityApi
      .getReactors(postId)
      .then((res) => {
        if (cancelled) return;
        const data = (res.data?.data ?? res.data ?? []) as Reactor[];
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    if (!visible || !postId) return;
    setTab('ALL');
    return load();
  }, [visible, postId, load]);

  // Build emoji tabs sorted by count desc
  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([emoji, count]) => ({ emoji, count }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'ALL') return rows;
    return rows.filter((r) => r.emoji === tab);
  }, [rows, tab]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t ? 'Reacciones' : 'Reactions'}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Tabs */}
          {tabs.length > 0 && (
            <FlatList
              data={[{ emoji: 'ALL', count: rows.length }, ...tabs]}
              horizontal
              keyExtractor={(it) => it.emoji}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
              renderItem={({ item }) => {
                const active = tab === item.emoji;
                return (
                  <Pressable
                    onPress={() => setTab(item.emoji)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {item.emoji === 'ALL'
                        ? `${t ? 'Todos' : 'All'} · ${item.count}`
                        : `${item.emoji} ${item.count}`}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}

          {/* Body */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accentPrimary} />
            </View>
          ) : error ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={load} hitSlop={10} style={{ marginTop: 10 }}>
                <Text style={[styles.emptyText, { color: Colors.accentPrimary, fontWeight: '700' }]}>
                  {t ? 'Reintentar' : 'Retry'}
                </Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>
                {t ? 'Aún nadie reaccionó.' : 'No reactions yet.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.userId + it.emoji}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onClose();
                    setTimeout(() => {
                      router.push(`/(app)/users/${item.userId}` as never);
                    }, 100);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colorFor(item.userId) }]}>
                      <Text style={styles.avatarText}>{initialsFor(item.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.emoji} allowFontScaling={false}>
                    {item.emoji}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tabsRow: {
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: Colors.accentPrimary + '22',
    borderColor: Colors.accentPrimary,
  },
  tabText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  tabTextActive: {
    color: Colors.accentPrimary,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  emoji: {
    fontSize: 22,
  },
});
