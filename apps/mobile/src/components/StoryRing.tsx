import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';
import { communityApi } from '@/api/client';
import { useRealtime } from '@/hooks/useRealtime';

// ─────────────────────────────────────────────
//  StoryRing — wraps an avatar with Instagram-style ring
//  · Renders nothing extra when user has no active stories
//  · Gradient-like accent ring when unseen stories exist
//  · Grey ring when all stories seen
//  · Tapping opens the viewer filtered to that user
// ─────────────────────────────────────────────

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<Size, { ring: number; gap: number; avatar: number; text: number }> = {
  sm: { ring: 48, gap: 2, avatar: 42, text: 14 },
  md: { ring: 64, gap: 2, avatar: 58, text: 18 },
  lg: { ring: 96, gap: 3, avatar: 86, text: 28 },
  xl: { ring: 120, gap: 3, avatar: 108, text: 34 },
};

export interface StoryRingState {
  hasStories: boolean;
  hasUnseen: boolean;
}

/**
 * Fetches active stories for a user and exposes the ring state.
 * Skip the network call by passing a preloaded `state`.
 */
export function useUserStoryState(userId?: string | null, preload?: StoryRingState) {
  const [state, setState] = useState<StoryRingState>(
    preload ?? { hasStories: false, hasUnseen: false },
  );

  const fetchState = useCallback(() => {
    if (preload || !userId) return () => {};
    let alive = true;
    communityApi
      .userStories(userId)
      .then((r) => {
        if (!alive) return;
        const payload = r.data?.data ?? r.data ?? {};
        const stories = payload.stories ?? [];
        setState({
          hasStories: stories.length > 0,
          hasUnseen: !!payload.hasUnseen,
        });
      })
      .catch(() => {
        if (!alive) return;
        setState({ hasStories: false, hasUnseen: false });
      });
    return () => {
      alive = false;
    };
  }, [userId, preload]);

  useEffect(() => fetchState(), [fetchState]);

  // Tab screens stay mounted, so a story uploaded from the new-story screen
  // wouldn't refresh the ring on its own. Refetch when the host screen
  // regains focus and on any 'story' realtime event.
  useFocusEffect(useCallback(() => {
    const cleanup = fetchState();
    return cleanup;
  }, [fetchState]));

  useRealtime('story', () => { fetchState(); });

  return state;
}

interface Props {
  userId?: string | null;
  avatarUrl?: string | null;
  initials?: string;
  fallbackColor?: string;
  size?: Size;
  /** Skip the network call by supplying ring state from parent. */
  state?: StoryRingState;
  /** Disable ring + tap-to-view even if the user has stories. */
  disableStories?: boolean;
  /** Called in addition to (or instead of, via returning false) opening the viewer. */
  onPress?: () => void;
  /** Override: navigate somewhere else when there are no stories. */
  onPressNoStories?: () => void;
  /** Keep a subtle decorative ring even when the user has no stories. */
  showIdleRing?: boolean;
  /** When true, always use the bright accent ring if the user has stories
   *  (skip the "seen → grey" state). Useful on the user's own profile so
   *  they can tell at a glance that they have an active story up. */
  isSelf?: boolean;
}

export function StoryRing({
  userId,
  avatarUrl,
  initials,
  fallbackColor,
  size = 'md',
  state,
  disableStories,
  onPress,
  onPressNoStories,
  showIdleRing,
  isSelf,
}: Props) {
  const router = useRouter();
  const dims = SIZE_MAP[size];
  const ringState = useUserStoryState(disableStories ? null : userId, state);
  const showRing = (!disableStories && ringState.hasStories) || !!showIdleRing;

  function handlePress() {
    onPress?.();
    if (!userId) return;
    if (showRing) {
      router.push(`/(app)/community/story-viewer?userId=${userId}&single=1` as never);
    } else {
      onPressNoStories?.();
    }
  }

  const avatar = (
    <View
      style={[
        styles.avatar,
        {
          width: dims.avatar,
          height: dims.avatar,
          borderRadius: dims.avatar / 2,
          backgroundColor: fallbackColor ?? Colors.bgElevated,
        },
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: dims.avatar, height: dims.avatar, borderRadius: dims.avatar / 2 }}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: dims.text }]}>{initials ?? 'U'}</Text>
      )}
    </View>
  );

  const ringBg = !showRing
    ? 'transparent'
    : ringState.hasStories && (ringState.hasUnseen || isSelf)
      ? Colors.accentPrimary
      : ringState.hasStories
        ? Colors.border
        : 'rgba(244, 163, 64, 0.3)';

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={4}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View
        style={[
          styles.ring,
          {
            width: dims.ring,
            height: dims.ring,
            borderRadius: dims.ring / 2,
            backgroundColor: ringBg,
            padding: showRing ? dims.gap : 0,
          },
        ]}
      >
        {showRing ? (
          <View
            style={[
              styles.gap,
              {
                width: dims.ring - dims.gap * 2,
                height: dims.ring - dims.gap * 2,
                borderRadius: (dims.ring - dims.gap * 2) / 2,
              },
            ]}
          >
            {avatar}
          </View>
        ) : (
          avatar
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgPrimary,
    padding: 2,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: Colors.white, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
