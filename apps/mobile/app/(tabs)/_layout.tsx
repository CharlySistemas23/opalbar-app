// ─────────────────────────────────────────────
//  Tabs layout — Editorial Premium
//
//  Tab bar choice: NOT a pill. Editorial doesn't ride on rounded pills.
//  Instead: a flat bar with a hairline top border and a 2px underline
//  marker that slides under the active tab. The label is small caps with
//  letterspacing — same vocabulary as <Kicker>.
//
//  Motion: underline + label color cross-fade over 240ms outQuint.
//  Active label uses textPrimary; inactive uses textMuted. No icon scale,
//  no jump — the underline carries the active state.
// ─────────────────────────────────────────────
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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

function EditorialTabBar({ state, navigation }: any) {
  const { language } = useAppStore();

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
      <Feather
        name={icon}
        size={20}
        color={focused ? Colors.textPrimary : Colors.textMuted}
      />
      <Text
        style={[
          TypePresets.kicker,
          {
            color: focused ? Colors.textPrimary : Colors.textMuted,
            marginTop: Spacing[1],
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <EditorialTabBar {...props} />}
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
    borderTopColor: Colors.border,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[2],
    paddingTop: Spacing[2],
    minHeight: 64,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[2],
    minHeight: 56,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '40%',
    backgroundColor: Colors.textPrimary,
  },
});
