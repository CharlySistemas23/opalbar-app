import React, { useEffect } from 'react';
import { Platform, View, Text, ScrollView } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as useFraunces,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/stores/auth.store';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useRealtimeConnection } from '@/hooks/useRealtime';
import { ToastHost } from '@/components/Toast';
import { NotificationListener } from '@/components/NotificationListener';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateOverlay } from '@/components/UpdateOverlay';

// ── Web diagnostic: catch ALL errors before React mounts ───────────────────
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // DIAGNOSTIC: Turn body purple to prove _layout.tsx loaded
  document.body.style.background = '#4B0082';

  // Show JS errors visually even if React never renders
  const showWebError = (msg: string) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;background:#0D0D0F;color:#E45858;padding:24px;' +
      'font-size:13px;font-family:monospace;z-index:99999;overflow:auto;white-space:pre-wrap;';
    el.textContent = '⚠ JS Error:\n' + msg;
    document.body?.appendChild(el);
  };
  const origOnError = window.onerror;
  (window as any).onerror = (msg: any, _src: any, _line: any, _col: any, err: any) => {
    showWebError(String(err?.stack || msg));
    if (typeof origOnError === 'function') origOnError.call(window, msg, _src, _line, _col, err);
    return false;
  };
  window.addEventListener('unhandledrejection', (e) => {
    showWebError('Unhandled rejection:\n' + String((e.reason as any)?.stack || e.reason));
  });
}

// ── Visible error boundary ─────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0D0F', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#E45858', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            ⚠ Render Error
          </Text>
          <ScrollView>
            <Text style={{ color: '#F4F4F5', fontSize: 13, fontFamily: 'monospace' }}>
              {this.state.error.message}
            </Text>
            {!!this.state.error.stack && (
              <Text style={{ color: '#B4B4BB', fontSize: 11, marginTop: 16, fontFamily: 'monospace' }}>
                {this.state.error.stack}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

// Keep splash screen visible until layout mounts (native only)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/**
 * Watches for auth-state changes AFTER the app is already running
 * (e.g. session expiry, manual logout).  Initial routing is handled in
 * app/index.tsx once the store has finished rehydrating from AsyncStorage.
 */
function PushGuard() {
  usePushRegistration();
  return null;
}

function RealtimeBridge() {
  const { isAuthenticated } = useAuthStore();
  useRealtimeConnection(isAuthenticated);
  return null;
}

function SessionGuard() {
  const { isAuthenticated, isGuest, _hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;

    const timer = setTimeout(() => {
      const inAuth = segments[0] === '(auth)';
      const inIndex = segments.length === 0 || segments[0] === 'index';
      const hasAccess = isAuthenticated || isGuest;

      // Onboarding screens live inside (auth) but REQUIRE the user to already
      // be authenticated (step1-profile calls updateProfile, etc.). They must
      // NOT be kicked back to home by the "isAuthenticated && inAuth" rule.
      // Segment 1 is the folder name ('register' or 'onboarding').
      const isOnboardingFlow =
        inAuth &&
        (segments[1] === 'register' || segments[1] === 'onboarding');

      // While index.tsx is doing its own redirect, stay out of the way
      if (inIndex) return;

      // Only redirect to welcome when there's truly no access AND we're not
      // already in the auth flow. Never auto-redirect to session-expired —
      // that page exists for explicit deep-link cases only. Surprise logouts
      // mid-action ("estaba escribiendo y me sacó") are the worst UX.
      if (!hasAccess && !inAuth) {
        router.replace('/(auth)/welcome');
      } else if (isAuthenticated && inAuth && !isOnboardingFlow) {
        // Only redirect authenticated users out of auth flow — UNLESS they're
        // mid-onboarding (register/* or onboarding/*). Those screens need to
        // finish before landing on home.
        // Guests can freely navigate into auth to log in or register.
        router.replace('/(tabs)/home');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isGuest, _hasHydrated, segments]);

  return null;
}

export default function RootLayout() {
  // Load custom fonts. The splash screen stays visible until they're ready
  // so we never flash System fonts before swapping in Fraunces/Inter.
  const [fontsLoaded, fontError] = useFraunces({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // Hide splash ONLY after fonts are ready (or failed — don't block forever)
    if (Platform.OS !== 'web' && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // On web we render immediately (fonts swap in via CSS). On native, wait.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0F0D0C' }}>
        <StatusBar style="light" />
        <OfflineBanner />
        <SessionGuard />
        <PushGuard />
        <RealtimeBridge />
        <NotificationListener />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(guest)" />
        </Stack>
        <ToastHost />
        <UpdateOverlay />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
