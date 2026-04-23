import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { Colors } from '@/constants/tokens';

/**
 * Entry-point screen.
 *
 * Expo Router v6 sets `navigationRef.isReady()` inside its `onReady()` callback,
 * which fires AFTER all passive useEffects of the screen tree have committed.
 * Calling `router.replace` directly in useEffect therefore fails with
 * "assertIsReady" because the nav container is not ready yet.
 *
 * Solution: defer navigation with setTimeout(0) so it runs in the next
 * event-loop macrotask — after `onReady()` has marked navigation as ready.
 * This is the same pattern expo-router uses for hiding the splash screen.
 */
export default function Index() {
  const { isAuthenticated, isGuest, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else if (isGuest) {
        router.replace('/(guest)/home');
      } else {
        router.replace('/(auth)/welcome');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [_hasHydrated, isAuthenticated, isGuest]);

  // Safety fallback: if store hasn't hydrated within 3s, go to welcome
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!isMounted.current || _hasHydrated) return;
      router.replace('/(auth)/welcome');
    }, 3000);
    return () => clearTimeout(fallback);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.accentPrimary} size="large" />
    </View>
  );
}
