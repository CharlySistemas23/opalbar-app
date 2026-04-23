import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useAdminCounts, type InboxCounts } from '@/hooks/useAdminCounts';
import { Colors } from '@/constants/tokens';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];

type TabDef = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** Which counts contribute to this tab's badge. */
  badge?: (c: InboxCounts) => number;
};

const TABS: TabDef[] = [
  { name: 'dashboard', label: 'Inicio', icon: 'grid',
    // Dashboard aggregates the whole inbox — show total pending.
    badge: (c) => c.total },
  { name: 'manage', label: 'Gestión', icon: 'briefcase',
    // Manage covers community posts + reviews + tickets + reservations.
    badge: (c) => c.posts + c.reviews + c.tickets + c.reservations },
  { name: 'users', label: 'Usuarios', icon: 'users' },
  { name: 'reports', label: 'Reportes', icon: 'flag',
    badge: (c) => c.reports + c.flags },
  { name: 'settings', label: 'Ajustes', icon: 'settings' },
];

export default function AdminLayout() {
  const { user, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      router.replace('/(tabs)/home');
    }
  }, [_hasHydrated, user]);

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={(props) => <AdminTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="users" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="gdpr" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="staff" options={{ href: null }} />
      <Tabs.Screen name="loyalty" options={{ href: null }} />
      <Tabs.Screen name="flags" options={{ href: null }} />
      <Tabs.Screen name="marketing" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
    </Tabs>
  );
}

function AdminTabBar({ state, navigation }: any) {
  const { counts } = useAdminCounts();
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeBar}>
      <View style={styles.pill}>
        {TABS.map((tab, i) => {
          const focused = state.index === i;
          const route = state.routes[i];
          const routeName = route?.name ?? tab.name;
          const badge = tab.badge?.(counts) ?? 0;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, focused && styles.tabItemActive]}
              activeOpacity={0.85}
              onPress={() => {
                // Emit the standard tabPress event. When the tab is already
                // focused, react-navigation's default handler pops the nested
                // stack to its root (e.g. from manage/events/new back to
                // manage/index). Without this, tapping the active tab did
                // nothing and users got stuck inside sub-screens.
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate({ name: routeName, merge: true });
                }
              }}
            >
              <View>
                <Feather
                  name={tab.icon}
                  size={18}
                  color={focused ? Colors.textInverse : Colors.textSecondary}
                />
                {badge > 0 && !focused ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 0 : 8,
    paddingTop: 8,
    backgroundColor: Colors.bgPrimary,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 32,
    padding: 4,
    height: 62,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    height: 54,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: Colors.accentPrimary,
  },
  tabLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: Colors.textInverse,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accentDanger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '800',
  },
});
