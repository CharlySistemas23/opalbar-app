// ─────────────────────────────────────────────
//  ReactionPicker — premium WhatsApp/Facebook-style reaction bar
//  · Floating horizontal pill with stagger entrance + spring bounce
//  · Long-press + drag UX: emoji under finger grows + tooltip
//  · Haptic on each emoji change (subtle) + success on release
//  · Single shared component → posts, comments, stories, messages
//
//  Usage:
//    <ReactionPicker
//      visible={picker.visible}
//      anchorY={picker.y}                         // y of the item being reacted to
//      onSelect={(emoji) => apply(emoji)}
//      onClose={() => setPicker({visible:false})}
//      onMore={() => openFullPicker()}            // optional "+" button
//      activeEmoji={'❤️'}                          // optional highlight
//    />
//
//  The picker auto-centers horizontally and clamps within screen edges.
// ─────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Feather from '@expo/vector-icons/Feather';
import { Colors } from '@/constants/tokens';
import { useFeedback } from '@/hooks/useFeedback';

// ── Canonical emoji set (matches Facebook, ordered by frequency of use) ──
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number] | string;

// Tooltip names ES — premium short labels (no "muy enfadado" verbose)
const EMOJI_NAME: Record<string, string> = {
  '❤️': 'Me encanta',
  '😂': 'Jaja',
  '😮': 'Wow',
  '😢': 'Triste',
  '😡': 'Enojado',
  '👍': 'Me gusta',
};

const EMOJI_SIZE = 36;
const EMOJI_GAP = 6;
const PADDING_H = 12;
const BAR_HEIGHT = 56;
const SCREEN_W = Dimensions.get('window').width;

interface ReactionPickerProps {
  visible: boolean;
  /** Y coordinate (screen-absolute) of the item the picker should sit above. */
  anchorY: number;
  /** Center X of the trigger; if omitted, bar auto-centers in screen. */
  anchorX?: number;
  emojis?: readonly string[];
  activeEmoji?: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Optional "+" button → caller opens full emoji picker. */
  onMore?: () => void;
}

export function ReactionPicker({
  visible,
  anchorY,
  anchorX,
  emojis = REACTION_EMOJIS,
  activeEmoji,
  onSelect,
  onClose,
  onMore,
}: ReactionPickerProps) {
  const fb = useFeedback();
  const items = useMemo(() => (onMore ? [...emojis, '__more__'] : [...emojis]), [emojis, onMore]);

  // bar geometry
  const barWidth = items.length * EMOJI_SIZE + (items.length - 1) * EMOJI_GAP + PADDING_H * 2;
  const barLeft = useMemo(() => {
    if (anchorX == null) return Math.max(8, (SCREEN_W - barWidth) / 2);
    return Math.min(SCREEN_W - barWidth - 8, Math.max(8, anchorX - barWidth / 2));
  }, [anchorX, barWidth]);

  // Place above the anchor with a comfy gap; clamp to top.
  const barTop = Math.max(60, anchorY - BAR_HEIGHT - 16);

  // shared values
  const enter = useSharedValue(0);            // 0 → 1 entrance
  const focusedIdx = useSharedValue(-1);      // which emoji is under finger
  const lastFiredIdx = useRef(-1);
  const [showTip, setShowTip] = useState<number>(-1);

  useEffect(() => {
    if (visible) {
      enter.value = 0;
      focusedIdx.value = -1;
      lastFiredIdx.current = -1;
      setShowTip(-1);
      enter.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
      fb.tap();
    } else {
      enter.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.cubic) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fireFocusHaptic = () => fb.select();
  const fireSelectHaptic = (e: string) => {
    if (e === '__more__') fb.tap();
    else fb.like();
  };

  const handleSelectFromJS = (emoji: string) => {
    if (emoji === '__more__') {
      onClose();
      requestAnimationFrame(() => onMore?.());
      return;
    }
    fireSelectHaptic(emoji);
    onSelect(emoji);
    onClose();
  };

  // Pan gesture: figure out which emoji index is under the finger.
  const pan = Gesture.Pan()
    .activateAfterLongPress(0)
    .onUpdate((e) => {
      'worklet';
      const localX = e.absoluteX - barLeft - PADDING_H;
      const cell = EMOJI_SIZE + EMOJI_GAP;
      const idx = Math.floor(localX / cell);
      const clamped = Math.max(-1, Math.min(items.length - 1, idx));
      // Only react when finger is roughly inside the bar's vertical band
      const insideY = e.absoluteY > barTop - 28 && e.absoluteY < barTop + BAR_HEIGHT + 28;
      const next = insideY ? clamped : -1;
      if (next !== focusedIdx.value) {
        focusedIdx.value = next;
        runOnJS(setShowTip)(next);
        if (next >= 0) runOnJS(fireFocusHaptic)();
      }
    })
    .onEnd(() => {
      'worklet';
      const idx = focusedIdx.value;
      if (idx >= 0) {
        runOnJS(handleSelectFromJS)(items[idx]);
      }
    });

  // Tap gesture (single quick tap on emoji): also selects.
  const tap = Gesture.Tap()
    .maxDuration(280)
    .onEnd((e) => {
      'worklet';
      const localX = e.absoluteX - barLeft - PADDING_H;
      const cell = EMOJI_SIZE + EMOJI_GAP;
      const idx = Math.floor(localX / cell);
      const insideY = e.absoluteY > barTop - 28 && e.absoluteY < barTop + BAR_HEIGHT + 28;
      if (insideY && idx >= 0 && idx < items.length) {
        runOnJS(handleSelectFromJS)(items[idx]);
      }
    });

  const composed = Gesture.Simultaneous(pan, tap);

  // Container style — bar fades in fast, emojis cascade from below
  const barStyle = useAnimatedStyle(() => {
    const opacity = enter.value;
    const translateY = interpolate(enter.value, [0, 1], [8, 0]);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.bar,
            {
              top: barTop,
              left: barLeft,
              width: barWidth,
              height: BAR_HEIGHT,
            },
            barStyle,
          ]}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={composed}>
            <View style={styles.inner}>
              {items.map((emoji, i) => (
                <EmojiCell
                  key={emoji + i}
                  emoji={emoji}
                  index={i}
                  visible={visible}
                  focusedIdx={focusedIdx}
                  isActive={emoji === activeEmoji}
                />
              ))}
            </View>
          </GestureDetector>

          {/* Tooltip */}
          {showTip >= 0 && items[showTip] !== '__more__' && (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                {
                  left: PADDING_H + showTip * (EMOJI_SIZE + EMOJI_GAP) + EMOJI_SIZE / 2 - 50,
                },
              ]}
            >
              <Text style={styles.tooltipText}>
                {EMOJI_NAME[items[showTip]] ?? items[showTip]}
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

interface EmojiCellProps {
  emoji: string;
  index: number;
  visible: boolean;
  focusedIdx: SharedValue<number>;
  isActive?: boolean;
}

function EmojiCell({ emoji, index, visible, focusedIdx, isActive }: EmojiCellProps) {
  // Each cell has its own spring → true FB-style cascade with overshoot landing
  const cellEnter = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cellEnter.value = 0;
      cellEnter.value = withDelay(
        index * 45,
        withSpring(1, { damping: 11, stiffness: 220, mass: 0.6 }),
      );
    } else {
      cellEnter.value = withTiming(0, { duration: 120 });
    }
  }, [visible, index, cellEnter]);

  const cellStyle = useAnimatedStyle(() => {
    // Slide UP from below the bar + scale up (FB style)
    const t = cellEnter.value;
    const baseScale = interpolate(t, [0, 1], [0.3, 1]);
    const baseLift = interpolate(t, [0, 1], [28, 0]);
    const opacity = interpolate(t, [0, 0.6, 1], [0, 1, 1]);

    // Focus scale (when finger hovers) — adds on top of base
    const focused = focusedIdx.value === index ? 1 : 0;
    const focusScale = focused === 1 ? 1.55 : 1;
    const focusLift = focused === 1 ? -14 : 0;

    return {
      opacity,
      transform: [
        { translateY: baseLift + focusLift },
        { scale: baseScale * focusScale },
      ],
    };
  });

  if (emoji === '__more__') {
    return (
      <Animated.View style={[styles.cell, styles.moreCell, cellStyle]}>
        <Feather name="plus" size={20} color={Colors.textPrimary} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.cell, isActive && styles.cellActive, cellStyle]}>
      <Text style={styles.emoji} allowFontScaling={false}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  bar: {
    position: 'absolute',
    backgroundColor: Colors.bgElevated,
    borderRadius: BAR_HEIGHT / 2,
    paddingHorizontal: PADDING_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  cell: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    marginRight: EMOJI_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    backgroundColor: Colors.accentPrimary + '22',
    borderRadius: EMOJI_SIZE / 2,
  },
  moreCell: {
    backgroundColor: Colors.bgCard,
    borderRadius: EMOJI_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  tooltip: {
    position: 'absolute',
    top: -34,
    width: 100,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.black,
    borderRadius: 8,
  },
  tooltipText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
