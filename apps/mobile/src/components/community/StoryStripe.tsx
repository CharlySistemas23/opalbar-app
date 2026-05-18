// ─────────────────────────────────────────────
//  StoryStripe — Editorial Premium stories carousel
//
//  Horizontal stories ring above the feed. Editorial detail: unseen
//  stories use a soft champagne ring (no rainbow gradient), seen stories
//  drop to a hairline border. Avatar uses Radius.full but lives inside
//  a square frame's inner padding — same vocabulary as the rest of the
//  Editorial system.
// ─────────────────────────────────────────────
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ui/Typography';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';

export interface StoryItem {
  id: string;
  kind: 'venue' | 'personal';
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  color?: string;
  hasUnseen?: boolean;
}

interface Props {
  stories: StoryItem[];
  onPressStory: (story: StoryItem) => void;
}

export function StoryStripe({ stories, onPressStory }: Props) {
  if (stories.length === 0) return null;

  return (
    <FlatList
      horizontal
      data={stories}
      keyExtractor={(s, idx) => `story-${s.id || idx}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole={Roles.button}
          accessibilityLabel={item.name}
          accessibilityHint={item.hasUnseen ? 'Historia sin ver' : 'Historia vista'}
          onPress={() => onPressStory(item)}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
        >
          <View
            style={[
              styles.ring,
              item.hasUnseen ? styles.ringUnseen : styles.ringSeen,
            ]}
          >
            <View style={styles.ringInner}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { backgroundColor: item.color || Colors.bgElevated },
                  ]}
                >
                  <Caption tone="inverse" style={styles.avatarInitials}>
                    {item.initials || 'U'}
                  </Caption>
                </View>
              )}
            </View>
          </View>
          <Caption
            tone="secondary"
            align="center"
            numberOfLines={1}
            style={styles.name}
          >
            {item.name.split(' ')[0]}
          </Caption>
        </Pressable>
      )}
    />
  );
}

const RING_SIZE = 64;
const GAP = 3;
const AVATAR_SIZE = RING_SIZE - GAP * 2 - 2; // -2 for ring border width

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: Spacing[1],
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    padding: GAP,
    borderWidth: 1,
  },
  ringUnseen: {
    borderColor: Colors.accentChampagne,
  },
  ringSeen: {
    borderColor: Colors.borderStrong,
  },
  ringInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.full,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    marginTop: Spacing[1],
    maxWidth: 70,
  },
});
