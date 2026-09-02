// ─────────────────────────────────────────────
//  Tabs layout — Editorial Premium bottom tab bar
//
//  Tab bar at the BOTTOM (default expo-router position). Text-only +
//  underline indicator. No icons — labels carry meaning, underline marks
//  active.
//
//  NOTE: The previous NOIR pivot attempted to move this to the TOP via
//  `tabBarPosition` / `sceneStyle paddingTop` workarounds — both broke
//  the navigator and caused a hard crash. Keep it at the bottom.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing, TypePresets } from '@/constants/tokens';
import { Durations } from '@/constants/motion';
import { Roles } from '@/constants/a11y';
import { useAppStore } from '@/stores/app.store';
import { useUnreadRealtime, useUnreadStore } from '@/stores/unread.store';
import { Pressy } from '@/components/ui/Pressy';
import { playUiSound } from '@/hooks/useFeedback';

interface TabDef {
  route: string;
  label: { es: string; en: string };
}

// Brief del usuario (2026-05-18): "Club Privado Exclusivo + Estatus + Experiencias".
// Renombres semánticos:
//   events → 'Experiencias' (engloba eventos + reservas + cortesías + VIP)
//   bar    → 'Club' (lugar físico — horarios, menús, reviews)
//   community → 'Comunidad' (sin cambio de slug; cambia el énfasis)
//   profile → 'Cuenta' (perfil + wallet + QR + config)
const TABS: TabDef[] = [
  { route: 'home', label: { es: 'Inicio', en: 'Home' } },
  { route: 'events', label: { es: 'Experiencias', en: 'Experiences' } },
  { route: 'bar', label: { es: 'Club', en: 'Club' } },
  { route: 'community', label: { es: 'Comunidad', en: 'Community' } },
  { route: 'profile', label: { es: 'Cuenta', en: 'Account' } },
];

function NoirTopBar({ state, navigation }: any) {
  const { language } = useAppStore();
  // Un solo punto dorado por tab: "Cuenta" agrupa mensajes, notificaciones y
  // solicitudes de amistad (todas viven detrás de esa pestaña).
  const accountDot = useUnreadStore(
    (s) => s.messages + s.notifications + s.friendRequests > 0,
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar} accessibilityRole={Roles.tablist}>
        {state.routes.map((route: any, index: number) => {
          const def = TABS.find((t) => t.route === route.name);
          if (!def) return null;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              // Pressy already fires the 'select' haptic; add the audible tick.
              playUiSound('tick');
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={def.label[language]}
              dot={route.name === 'profile' && accountDot}
              onPress={onPress}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function TabItem({
  focused,
  label,
  dot = false,
  onPress,
}: {
  focused: boolean;
  label: string;
  dot?: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: Durations.fast,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [focused, progress]);

  const underline = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <Pressy
      haptic={focused ? 'none' : 'select'}
      scaleTo={0.96}
      onPress={onPress}
      accessibilityRole={Roles.tab}
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tab}
    >
      {dot ? <View style={styles.dot} /> : null}
      <Text
        style={[
          TypePresets.subhead,
          {
            color: focused ? Colors.textPrimary : Colors.textMuted,
            textAlign: 'center',
            fontSize: 13,
            letterSpacing: 0.3,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Animated.View style={[styles.underline, underline]} />
    </Pressy>
  );
}

export default function TabsLayout() {
  // Mounted once for the whole authenticated app: loads the badge counters,
  // refreshes them on foreground and keeps them live over the /rt socket.
  useUnreadRealtime();

  // Tab bar custom at the bottom (NOT top — top position caused crashes
  // because expo-router v6 doesn't support `tabBarPosition` and the
  // workaround with `tabBarStyle: position absolute + sceneStyle paddingTop`
  // broke the navigator layout). Stays at the bottom with custom styling.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <NoirTopBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="bar" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[2],
    paddingTop: Spacing[1],
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  underline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: Colors.accentPrimary,
  },
  dot: {
    position: 'absolute',
    top: Spacing[2],
    right: '22%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentPrimary,
  },
});
