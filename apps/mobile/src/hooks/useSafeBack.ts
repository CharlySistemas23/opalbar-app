import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

// Admin screens need deterministic back navigation: from a detail screen, back
// must always land on its parent list/hub — regardless of how the user got
// there. router.back() can pop across tabs (e.g. dashboard → detail via
// badge → back lands on dashboard, skipping the hub). Using router.replace
// forces the parent screen to be the current screen, so the user can then
// go further back from there to the real hub.
export function useSafeBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    router.replace(fallback);
  }, [router, fallback]);
}
