// ─────────────────────────────────────────────
//  ChatInputBar — Editorial Premium message composer
//
//  Three pieces of UI:
//   1. Attach button (opens AttachSheet)
//   2. Text field (multiline, sticker trigger inline-right)
//   3. Mic OR send button (swaps based on whether there's text)
//
//  Editorial: hairline border around the input; focus state lifts the bg
//  to bgElevated. Send button is a 42pt amber square. Disabled and busy
//  states make the icon appear via ActivityIndicator.
// ─────────────────────────────────────────────
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing, Typography } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { Pressy } from '@/components/ui';

interface Props {
  text: string;
  onChangeText: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
  sending: boolean;
  uploadingImage: boolean;
  uploadingAudio: boolean;
  onAttachPress: () => void;
  onStickerPress: () => void;
  onSend: () => void;
  onMicStart: () => void;
  t: boolean;
}

export function ChatInputBar({
  text,
  onChangeText,
  onFocus,
  onBlur,
  focused,
  sending,
  uploadingImage,
  uploadingAudio,
  onAttachPress,
  onStickerPress,
  onSend,
  onMicStart,
  t,
}: Props) {
  const sendScale = useRef(new Animated.Value(1)).current;
  const hasText = text.trim().length > 0;

  function send() {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, damping: 12, stiffness: 320, useNativeDriver: true }),
    ]).start();
    onSend();
  }

  return (
    <View style={styles.compose}>
      <Pressy
        haptic="tap"
        accessibilityLabel={t ? 'Adjuntar' : 'Attach'}
        accessibilityRole={Roles.button}
        hitSlop={HitSlop.expand}
        onPress={onAttachPress}
        disabled={sending || uploadingImage || uploadingAudio}
        style={styles.attachBtn}
      >
        {uploadingImage || uploadingAudio ? (
          <ActivityIndicator size="small" color={Colors.accentPrimary} />
        ) : (
          <Feather name="plus" size={20} color={Colors.textSecondary} />
        )}
      </Pressy>

      <View style={[styles.inputWrap, focused && styles.inputWrapFocus]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={t ? 'Mensaje…' : 'Message…'}
          placeholderTextColor={Colors.textMuted}
          multiline
          accessibilityLabel={t ? 'Escribir mensaje' : 'Write message'}
        />
        <Pressy
          haptic="tap"
          accessibilityLabel={t ? 'Stickers' : 'Stickers'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          onPress={onStickerPress}
          style={styles.stickerBtn}
        >
          <Feather name="smile" size={20} color={Colors.textSecondary} />
        </Pressy>
      </View>

      {!hasText ? (
        <Pressy
          haptic="select"
          accessibilityLabel={t ? 'Grabar nota de voz' : 'Record voice note'}
          accessibilityRole={Roles.button}
          hitSlop={HitSlop.expand}
          onPress={onMicStart}
          style={styles.micBtn}
        >
          <Feather name="mic" size={18} color={Colors.accentPrimary} />
        </Pressy>
      ) : (
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <Pressy
            haptic="success"
            accessibilityLabel={t ? 'Enviar' : 'Send'}
            accessibilityRole={Roles.button}
            hitSlop={HitSlop.expand}
            onPress={send}
            disabled={sending}
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Feather name="send" size={17} color={Colors.textInverse} />
            )}
          </Pressy>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
    backgroundColor: Colors.bgPrimary,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    paddingLeft: Spacing[4],
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 42,
  },
  inputWrapFocus: {
    borderColor: Colors.accentPrimary + '88',
    backgroundColor: Colors.bgElevated,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.sans,
    maxHeight: 120,
    paddingVertical: 6,
  },
  stickerBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginBottom: 2,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentPrimary + '18',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentPrimary + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
