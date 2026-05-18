// ─────────────────────────────────────────────
//  Modal — Editorial Premium dialog
//
//  Center-aligned, single-purpose dialog. For destructive confirmations
//  use <ConfirmDialog> which composes on top of this. For bottom panels
//  with content scroll, use <Sheet>.
//
//  Behavior:
//   · Renders via RN's Modal (statusBarTranslucent on Android)
//   · Backdrop tap closes (configurable via dismissOnBackdrop)
//   · Hardware back closes (Android)
//   · accessibilityViewIsModal + accessibilityLabel propagated
//   · Fade + 6px rise for the content. Reduce-motion respected.
//   · Keyboard avoiding so inputs don't disappear under the keyboard
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
} from 'react-native';

import { Colors, EditorialSpacing, Radius, Shadows, Spacing, TypePresets } from '@/constants/tokens';
import { A11yDefaults, HitSlop, Roles } from '@/constants/a11y';
import { FadeIn } from './FadeIn';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Tap outside the card closes the modal. Default true. */
  dismissOnBackdrop?: boolean;
  /** Hide the close (X) button. Useful for required-decision modals. */
  hideClose?: boolean;
  /** Max card width — sm 320 / md 400 / lg 520. Default md. */
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissOnBackdrop = true,
  hideClose = false,
  size = 'md',
  testID,
}: Props) {
  useEffect(() => {
    if (open && title) AccessibilityInfo.announceForAccessibility(title);
  }, [open, title]);

  const maxWidth = size === 'sm' ? 320 : size === 'lg' ? 520 : 400;

  return (
    <RNModal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      {...A11yDefaults.modalRoot(title ?? 'Diálogo')}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={dismissOnBackdrop ? onClose : undefined}
          style={styles.backdrop}
        />

        <FadeIn distance={6} style={[styles.cardWrapper, { maxWidth }]}>
          <View style={styles.card} testID={testID}>
            {(title || !hideClose) && (
              <View style={styles.header}>
                {title ? (
                  <Text
                    accessibilityRole={Roles.header}
                    style={[TypePresets.heading, styles.title]}
                  >
                    {title}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {!hideClose ? (
                  <Pressable
                    onPress={onClose}
                    hitSlop={HitSlop.expand}
                    accessibilityRole={Roles.button}
                    accessibilityLabel="Cerrar"
                    style={styles.closeBtn}
                  >
                    <View style={styles.closeIcon}>
                      <View style={styles.closeLine1} />
                      <View style={styles.closeLine2} />
                    </View>
                  </Pressable>
                ) : null}
              </View>
            )}

            <View style={styles.body}>{children}</View>
          </View>
        </FadeIn>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgOverlay,
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing[5],
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[2],
    gap: Spacing[3],
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
  },
  body: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[6],
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    marginTop: -Spacing[1],
  },
  closeIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine1: {
    position: 'absolute',
    width: 14,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    position: 'absolute',
    width: 14,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Colors.textSecondary,
    transform: [{ rotate: '-45deg' }],
  },
});
