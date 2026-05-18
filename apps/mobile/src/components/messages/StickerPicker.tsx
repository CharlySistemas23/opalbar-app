// ─────────────────────────────────────────────
//  StickerPicker — Editorial Premium emoji-sticker grid
//
//  Renders inside a <Sheet>. 26 curated emoji glyphs at large size; tap
//  sends as a sticker message. No bgCard cells — just generous whitespace
//  so each glyph reads as a deliberate stamp.
// ─────────────────────────────────────────────
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/tokens';
import { Body, Pressy } from '@/components/ui';

const STICKER_PACK = [
  '🔥', '💖', '😂', '🥳', '😍', '😎',
  '🍻', '🥂', '🍷', '🎉', '✨', '⭐',
  '👀', '👋', '🙌', '👏', '💯', '💃',
  '🕺', '🎶', '🎵', '🎁', '💋', '😘',
  '😭', '🤣', '😅', '🫶', '❤️‍🔥', '💕',
] as const;

interface Props {
  onSelect: (emoji: string) => void;
}

export function StickerPicker({ onSelect }: Props) {
  return (
    <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.scroll}>
      <View style={styles.grid}>
        {STICKER_PACK.map((s) => (
          <Pressy
            key={s}
            onPress={() => onSelect(s)}
            haptic="select"
            accessibilityLabel={`Sticker ${s}`}
            style={styles.cell}
          >
            <Body size="lg" style={styles.glyph}>{s}</Body>
          </Pressy>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing[2],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing[2],
  },
  cell: {
    width: '16.66%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 36,
    lineHeight: 44,
  },
});
