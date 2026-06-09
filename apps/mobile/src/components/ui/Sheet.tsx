// ─────────────────────────────────────────────
//  Sheet — Editorial Premium bottom sheet
//
//  No native deps (no @gorhom/bottom-sheet) — built with Reanimated +
//  gesture-handler that are already installed. Stays OTA-eligible.
//
//  Behavior:
//   · Slides up from the bottom with Springs.sheet
//   · Pan down anywhere on the sheet to dismiss (threshold: 100px or
//     velocity > 600)
//   · Backdrop tap dismisses (configurable)
//   · Hardware back closes (Android, via RN Modal onRequestClose)
//   · Top handle (grabber) for affordance
//   · accessibilityViewIsModal + announce title on open
//   · Reduce-motion: snaps with 1ms duration instead of spring
//
//  Use for: bottom panels with scrollable / longer content, action lists,
//  filter panels, picker UIs. For yes/no destructive decisions use
//  <ConfirmDialog> instead.
// ─────────────────────────────────────────────
import { ReactNode, useEffect } from 'react';
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { Colors, Radius, Shadows, Spacing, TypePresets } from '@/constants/tokens';
import { Springs, ReducedMotion } from '@/constants/motion';
import { A11yDefaults, Roles } from '@/constants/a11y';
import { useReducedMotion } from '@/animations';
import { playUiSound } from '@/hooks/useFeedback';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Tap outside the sheet closes it. Default true. */
  dismissOnBackdrop?: boolean;
  /** Disable pan-to-dismiss gesture. Default false. */
  disableGesture?: boolean;
  testID?: string;
}

const DISMISS_THRESHOLD = 100;
const DISMISS_VELOCITY = 600;

export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissOnBackdrop = true,
  disableGesture = false,
  testID,
}: Props) {
  const { height: screenH } = useWindowDimensions();
  const translateY = useSharedValue(screenH);
  const opacity = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) {
      playUiSound('whoosh');
      if (title) AccessibilityInfo.announceForAccessibility(title);
      if (reduced) {
        translateY.value = 0;
        opacity.value = 1;
      } else {
        translateY.value = withSpring(0, Springs.sheet);
        opacity.value = withTiming(1, { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      }
    } else {
      if (reduced) {
        translateY.value = screenH;
        opacity.value = 0;
      } else {
        translateY.value = withTiming(screenH, { duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1) });
        opacity.value = withTiming(0, { duration: 200, easing: Easing.linear });
      }
    }
  }, [open, screenH, reduced, opacity, translateY, title]);

  const pan = Gesture.Pan()
    .enabled(!disableGesture)
    .onChange((event) => {
      if (event.translationY > 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationY > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(
          screenH,
          { duration: reduced ? ReducedMotion.duration : 240, easing: Easing.bezier(0.4, 0, 0.2, 1) },
          (finished) => {
            if (finished) runOnJS(onClose)();
          },
        );
      } else {
        translateY.value = withSpring(0, Springs.sheet);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0, 1]),
  }));

  return (
    <RNModal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      {...A11yDefaults.modalRoot(title ?? 'Panel')}
    >
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.backdropContainer, backdropStyle]}>
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no"
              onPress={dismissOnBackdrop ? onClose : undefined}
              style={styles.backdrop}
            />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.sheet, sheetStyle]} testID={testID}>
              <View style={styles.grabberRow}>
                <View style={styles.grabber} />
              </View>
              {title ? (
                <View style={styles.titleRow}>
                  <Text
                    accessibilityRole={Roles.header}
                    style={[TypePresets.headingSm, styles.title]}
                  >
                    {title}
                  </Text>
                </View>
              ) : null}
              <View style={styles.body}>{children}</View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgOverlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.highlightTop,
    paddingBottom: Spacing[8],
    ...Shadows.lg,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
  },
  titleRow: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  title: {
    color: Colors.textPrimary,
  },
  body: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[3],
  },
});
