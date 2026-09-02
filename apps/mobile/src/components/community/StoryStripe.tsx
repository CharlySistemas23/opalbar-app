// ─────────────────────────────────────────────
//  StoryStripe — stories carousel (Noir Absolute)
//
//  First ring is always "Tu historia" — the viewer's own avatar with a gold
//  "+" badge; tap → composer (or own viewer when they already have active
//  stories). Then the venue ring and the personal rings. Unseen stories use
//  a champagne ring; seen drop to a hairline border.
// ─────────────────────────────────────────────
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Caption } from '@/components/ui/Typography';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';

export interface StoryItem {
  id: string;
  kind: 'venue' | 'personal' | 'self';
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  color?: string;
  hasUnseen?: boolean;
  /** self only: viewer already has ≥1 active story. */
  hasOwn?: boolean;
}

interface Props {
  stories: StoryItem[];
  onPressStory: (story: StoryItem) => void;
  t: boolean;
}

export function StoryStripe({ stories, onPressStory, t }: Props) {
  if (stories.length === 0) return null;

  return (
    <FlatList
      horizontal
      data={stories}
      keyExtractor={(s) => `story-${s.kind}-${s.id}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => {
        const isSelf = item.kind === 'self';
        const ringStyle = isSelf
          ? item.hasOwn
            ? styles.ringUnseen
            : styles.ringSelf
          : item.hasUnseen
            ? styles.ringUnseen
            : styles.ringSeen;
        const label = isSelf
          ? t ? 'Tu historia' : 'Your story'
          : item.name.split(' ')[0];
        const hint = isSelf
          ? item.hasOwn
            ? t ? 'Ver tu historia' : 'View your story'
            : t ? 'Crear historia' : 'Create story'
          : item.hasUnseen
            ? t ? 'Historia sin ver' : 'Unseen story'
            : t ? 'Historia vista' : 'Seen story';
        return (
          <Pressable
            accessibilityRole={Roles.button}
            accessibilityLabel={isSelf ? label : item.name}
            accessibilityHint={hint}
            onPress={() => onPressStory(item)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.ring, ringStyle]}>
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
              {isSelf ? (
                <View style={styles.plusBadge}>
                  <Feather name="plus" size={12} color={Colors.textInverse} />
                </View>
              ) : null}
            </View>
            <Caption
              tone={isSelf ? 'primary' : 'secondary'}
              align="center"
              numberOfLines={1}
              style={styles.name}
            >
              {label}
            </Caption>
          </Pressable>
        );
      }}
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
  ringUnseen: { borderColor: Colors.accentChampagne },
  ringSeen: { borderColor: Colors.borderStrong },
  ringSelf: { borderColor: Colors.borderSubtle },
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
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 13, fontWeight: '700' },
  plusBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: Spacing[1],
    maxWidth: 70,
  },
});
