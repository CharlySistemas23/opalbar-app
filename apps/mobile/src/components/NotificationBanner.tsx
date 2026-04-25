import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export interface BannerNotification {
  id: number;
  notifId?: string;
  type?: string;
  title: string;
  body?: string;
  avatarUrl?: string;
  accentColor?: string;
  icon?: FeatherIcon;
  onPress?: () => void;
}

interface BannerState {
  current: BannerNotification | null;
  push: (n: Omit<BannerNotification, 'id'>) => void;
  dismiss: () => void;
}

let nextId = 1;

export const useBannerStore = create<BannerState>((set) => ({
  current: null,
  push: (n) => set({ current: { id: nextId++, ...n } }),
  dismiss: () => set({ current: null }),
}));

export function showNotificationBanner(n: Omit<BannerNotification, 'id'>) {
  useBannerStore.getState().push(n);
}

const SWIPE_DISMISS_THRESHOLD = 60;
const AUTO_DISMISS_MS = 5000;

export function NotificationBannerHost() {
  const current = useBannerStore((s) => s.current);
  const dismiss = useBannerStore((s) => s.dismiss);

  if (!current) return null;

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.host}>
      <BannerView key={current.id} notif={current} onDismiss={dismiss} />
    </SafeAreaView>
  );
}

function BannerView({
  notif,
  onDismiss,
}: {
  notif: BannerNotification;
  onDismiss: () => void;
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  const dismissNow = (direction: 'up' | 'fade' = 'up') => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: direction === 'up' ? -140 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const timer = setTimeout(() => dismissNow('fade'), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        // Only allow upward drag (negative dy). Downward = no movement, feels "stuck".
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (-g.dy > SWIPE_DISMISS_THRESHOLD) {
          dismissNow('up');
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const accent = notif.accentColor ?? Colors.accentPrimary;
  const icon = notif.icon ?? 'bell';

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (notif.onPress) notif.onPress();
    dismissNow('up');
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Pressable onPress={handlePress} style={styles.card} android_ripple={{ color: 'rgba(255,255,255,0.04)' }}>
        {/* Top hairline glow — premium dark-UI signature */}
        <View style={styles.topHighlight} />

        {notif.avatarUrl ? (
          <View style={styles.avatarWrap}>
            <Image source={{ uri: notif.avatarUrl }} style={styles.avatar} />
            <View style={[styles.avatarBadge, { backgroundColor: accent }]}>
              <Feather name={icon} size={9} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={[styles.iconBox, { backgroundColor: accent + '22', borderColor: accent + '33' }]}>
            <Feather name={icon} size={18} color={accent} />
          </View>
        )}

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>
            {notif.title}
          </Text>
          {notif.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {notif.body}
            </Text>
          ) : null}
        </View>

        {/* Drag handle hint — tells the user this can be swiped */}
        <View style={styles.handle} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  wrap: {
    paddingHorizontal: Spacing[3],
    paddingTop: Platform.OS === 'android' ? Spacing[2] : 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.highlightTop,
  },
  avatarWrap: { width: 44, height: 44, position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.sansSemiBold,
    fontSize: Typography.fontSize.base,
    letterSpacing: Typography.letterSpacing.tight,
  },
  body: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.sans,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.snug,
  },
  handle: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: 'auto',
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    opacity: 0.5,
  },
});
