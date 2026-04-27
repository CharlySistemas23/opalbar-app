import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/tokens';
import { Pressy } from '@/components/ui/Pressy';
import { FadeIn } from '@/components/ui/FadeIn';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tint = Colors.textMuted,
}: Props) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [float, pulse]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 6 }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 - pulse.value * 0.45,
    transform: [{ scale: 0.9 + pulse.value * 0.7 }],
  }));

  return (
    <View style={styles.root}>
      <FadeIn from={12} duration={420}>
        <View style={styles.iconWrap}>
          <Animated.View
            style={[
              styles.iconPulse,
              { backgroundColor: tint + '20', borderColor: tint + '40' },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={[styles.iconBox, { backgroundColor: tint + '18' }, iconStyle]}
          >
            <Feather name={icon} size={32} color={tint} />
          </Animated.View>
        </View>
      </FadeIn>
      <FadeIn delay={120} from={10}>
        <Text style={styles.title}>{title}</Text>
      </FadeIn>
      {message ? (
        <FadeIn delay={200} from={10}>
          <Text style={styles.msg}>{message}</Text>
        </FadeIn>
      ) : null}
      {actionLabel && onAction ? (
        <FadeIn delay={300} from={10}>
          <Pressy
            haptic="select"
            scaleTo={0.95}
            onPress={onAction}
            style={[styles.btn, { backgroundColor: Colors.accentPrimary }]}
          >
            <Text style={styles.btnLbl}>{actionLabel}</Text>
          </Pressy>
        </FadeIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  iconWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPulse: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  msg: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
});
