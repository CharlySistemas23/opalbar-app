import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors } from '@/constants/tokens';
import { useAppStore } from '@/stores/app.store';
import { Pressy } from '@/components/ui/Pressy';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface TabDef {
  route: string;
  icon: FeatherIcon;
  label: { es: string; en: string };
}

const TABS: TabDef[] = [
  { route: 'home', icon: 'home', label: { es: 'INICIO', en: 'HOME' } },
  { route: 'events', icon: 'calendar', label: { es: 'EVENTOS', en: 'EVENTS' } },
  { route: 'bar', icon: 'map-pin', label: { es: 'EL BAR', en: 'THE BAR' } },
  { route: 'community', icon: 'users', label: { es: 'COMUNIDAD', en: 'COMMUNITY' } },
  { route: 'profile', icon: 'user', label: { es: 'PERFIL', en: 'PROFILE' } },
];

function PillTabBar({ state, navigation }: any) {
  const { language } = useAppStore();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.pill}>
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
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={def.icon}
              label={def.label[language]}
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
  icon,
  label,
  onPress,
}: {
  focused: boolean;
  icon: FeatherIcon;
  label: string;
  onPress: () => void;
}) {
  // Smoothly animate the active indicator + icon size on focus change.
  const focus = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [focused, focus]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + focus.value * 4 }, { scaleY: 1 + focus.value * 0.4 }],
    opacity: 0.2 + focus.value * 0.8,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -focus.value * 2 }, { scale: 1 + focus.value * 0.08 }],
  }));

  return (
    <Pressy
      haptic={focused ? 'none' : 'select'}
      scaleTo={0.92}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Feather
          name={icon}
          size={focused ? 22 : 20}
          color={focused ? Colors.accentPrimary : Colors.textMuted}
        />
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      <Animated.View style={[styles.dot, focused && styles.dotActive, dotStyle]} />
    </Pressy>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <PillTabBar {...props} />}
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
  },
  pill: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    height: 60,
    backgroundColor: Colors.bgCard,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 6,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
    paddingBottom: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.accentPrimary,
    fontWeight: '800',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  dotActive: {
    backgroundColor: Colors.accentPrimary,
  },
});
