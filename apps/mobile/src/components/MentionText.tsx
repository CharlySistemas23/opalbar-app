import React, { useMemo } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';

export type ResolvedMention = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
};

function buildHandle(m: ResolvedMention): string {
  const fn = (m.firstName ?? '').trim();
  const ln = (m.lastName ?? '').trim();
  return `${fn}${ln}`.replace(/\s+/g, '').toLowerCase() || m.userId.slice(0, 8);
}

export function MentionText({
  content,
  mentions,
  style,
  highlightStyle,
}: {
  content: string;
  mentions?: ResolvedMention[] | null;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
}) {
  const router = useRouter();
  const handleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of mentions ?? []) m.set(buildHandle(x), x.userId);
    return m;
  }, [mentions]);

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
    <Text style={style}>
      {parts.map((p, i) =>
        p.userId ? (
          <Text
            key={i}
            style={[{ color: Colors.accentPrimary, fontWeight: '600' }, highlightStyle]}
            onPress={() => router.push(`/(app)/users/${p.userId}` as never)}
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
