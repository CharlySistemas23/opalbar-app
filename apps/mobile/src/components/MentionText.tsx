import React, { useMemo } from 'react';
import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';

export type ResolvedMention = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

/**
 * Base handle for a user — must match `buildHandle` in useMentionAutocomplete
 * so the @token the composer inserted resolves back to the same user here.
 */
export function buildBaseHandle(m: ResolvedMention): string {
  if (m.username && m.username.trim()) return m.username.replace(/\s+/g, '').toLowerCase();
  const fn = (m.firstName ?? '').trim();
  const ln = (m.lastName ?? '').trim();
  return `${fn}${ln}`.replace(/\s+/g, '').toLowerCase() || m.userId.slice(0, 8);
}

/**
 * Handle → userId map. When two mentioned users share a base handle (two
 * "Ana García"), every colliding one also gets a `handle.xxxx` variant with
 * a short id suffix — the same variant the composer emits on collision —
 * and the bare handle resolves to the first one so old posts keep working.
 */
export function buildHandleMap(mentions?: ResolvedMention[] | null): Map<string, string> {
  const map = new Map<string, string>();
  const byBase = new Map<string, ResolvedMention[]>();
  for (const m of mentions ?? []) {
    const base = buildBaseHandle(m);
    const list = byBase.get(base) ?? [];
    list.push(m);
    byBase.set(base, list);
  }
  for (const [base, list] of byBase) {
    map.set(base, list[0].userId);
    if (list.length > 1) {
      for (const m of list) map.set(`${base}.${m.userId.slice(0, 4).toLowerCase()}`, m.userId);
    }
  }
  return map;
}

export function MentionText({
  content,
  mentions,
  style,
  highlightStyle,
  numberOfLines,
  ...rest
}: {
  content: string;
  mentions?: ResolvedMention[] | null;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
} & Omit<TextProps, 'style' | 'children'>) {
  const router = useRouter();
  const handleMap = useMemo(() => buildHandleMap(mentions), [mentions]);

  const parts = useMemo(() => {
    const out: Array<{ text: string; userId?: string }> = [];
    const re = /@([\w.]{1,30})/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      if (m.index > lastIndex) out.push({ text: content.slice(lastIndex, m.index) });
      const handle = m[1].toLowerCase();
      out.push({ text: `@${m[1]}`, userId: handleMap.get(handle) });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < content.length) out.push({ text: content.slice(lastIndex) });
    return out;
  }, [content, handleMap]);

  return (
    <Text style={style} numberOfLines={numberOfLines} {...rest}>
      {parts.map((p, i) =>
        p.userId ? (
          <Text
            key={i}
            style={[{ color: Colors.accentPrimary, fontWeight: '600' }, highlightStyle]}
            onPress={() => router.push(`/(app)/users/${p.userId}` as never)}
            accessibilityRole="link"
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}
