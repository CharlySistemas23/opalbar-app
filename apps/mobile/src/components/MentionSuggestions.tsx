import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/tokens';
import type { MentionSuggestion } from '@/hooks/useMentionAutocomplete';

// ─────────────────────────────────────────────
//  MentionSuggestions — IG-style horizontal/vertical popover
//  · Renders above the keyboard inside the parent layout
//  · Caller controls position; component is purely presentational
// ─────────────────────────────────────────────

type Props = {
  suggestions: MentionSuggestion[];
  loading?: boolean;
  onPick: (s: MentionSuggestion) => void;
  emptyHint?: string;
};

export function MentionSuggestions({ suggestions, loading, onPick, emptyHint }: Props) {
  if (!loading && suggestions.length === 0 && !emptyHint) return null;

  return (
    <View style={styles.wrap}>
      {loading && suggestions.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.accentPrimary} />
          <Text style={styles.loadingText}>Buscando…</Text>
        </View>
      ) : suggestions.length === 0 && emptyHint ? (
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      ) : (
        suggestions.map((s) => {
          const name =
            `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.username || 'Usuario';
          const initials =
            ((s.firstName?.[0] ?? '') + (s.lastName?.[0] ?? '')).toUpperCase() ||
            name[0]?.toUpperCase() ||
            '?';
          return (
            <Pressable
              key={s.id}
              onPress={() => onPick(s)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              {s.avatarUrl ? (
                <Image source={{ uri: s.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name}</Text>
                {s.username ? (
                  <Text style={styles.handle}>@{s.username}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    maxHeight: 240,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  handle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
