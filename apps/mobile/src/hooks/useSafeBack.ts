import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

// In Expo Router, router.back() pops the innermost Stack. When a screen sits
// at the root of a nested Stack (e.g. admin/manage/community/index.tsx), the
// back arrow becomes a no-op and the user gets stuck. This hook checks
// canGoBack() first and falls back to an explicit fallback route.
export function useSafeBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
