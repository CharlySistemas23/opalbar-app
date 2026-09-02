import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { useAppStore } from '@/stores/app.store';
import {
  BIOMETRIC_RELOCK_AFTER_MS,
  lockNow,
  shouldLock,
  unlockNow,
  useBiometricLockState,
} from '@/lib/biometric';
import BiometricLock from './(auth)/biometric';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { usePushTapRouting } from '@/hooks/usePushTapRouting';
import { useRealtimeConnection } from '@/hooks/useRealtime';
import { ToastHost } from '@/components/Toast';
import { NotificationListener } from '@/components/NotificationListener';
import { NotificationBannerHost } from '@/components/NotificationBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateOverlay } from '@/components/UpdateOverlay';
import { reportError } from '@/lib/error-reporter';

// ── Web dev diagnostic: surface JS errors before React mounts (dev only) ────
if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
  // Show JS errors visually even if React never renders
  const showWebError = (msg: string) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;background:#100E0C;color:#C46868;padding:24px;' +
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
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Ship to backend Sentry via /client-errors (best-effort, never throws).
    // When @sentry/react-native lands, reportError swaps to Sentry.captureException.
    reportError(error, {
      component: 'RootErrorBoundary',
      componentStack: info.componentStack,
    });
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <View
          style={{ flex: 1, backgroundColor: '#100E0C', padding: 32, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 40, marginBottom: 20 }}>✦</Text>
          <Text
            style={{
              color: '#F6F1E7',
              fontSize: 22,
              fontFamily: 'Fraunces_600SemiBold',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Algo salió mal
          </Text>
          <Text
            style={{
              color: '#B8B1A2',
              fontSize: 15,
              fontFamily: 'Inter_400Regular',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 28,
              maxWidth: 300,
            }}
          >
            Tuvimos un problema al cargar esta pantalla. Puedes reintentar; si sigue pasando, cierra y vuelve a abrir OPAL BAR.
          </Text>
          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            hitSlop={8}
            style={({ pressed }) => ({
              backgroundColor: '#C9A961',
              paddingVertical: 14,
              paddingHorizontal: 40,
              borderRadius: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#100E0C', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Reintentar</Text>
          </Pressable>
          {__DEV__ && (
            <ScrollView style={{ maxHeight: 220, marginTop: 28 }}>
              <Text style={{ color: '#C46868', fontSize: 12, fontFamily: 'monospace' }}>
                {this.state.error.message}
              </Text>
              {!!this.state.error.stack && (
                <Text style={{ color: '#827C71', fontSize: 10, marginTop: 12, fontFamily: 'monospace' }}>
                  {this.state.error.stack}
                </Text>
              )}
            </ScrollView>
          )}
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

function PushTapRouter() {
  usePushTapRouting();
  return null;
}

function RealtimeBridge() {
  const { isAuthenticated } = useAuthStore();
  useRealtimeConnection(isAuthenticated);
  return null;
}

/**
 * Biometric app-lock gate.
 *
 * When `app.store.biometricLock` is on and a session exists, the app
 * requires Face ID / Touch ID:
 *   · on cold start (once both stores have rehydrated)
 *   · when returning from background after > BIOMETRIC_RELOCK_AFTER_MS
 * While locked, app/(auth)/biometric.tsx is rendered as an absolute
 * overlay ABOVE the navigator so the user's screen/state is preserved
 * underneath. Unlock drops the overlay; "Cerrar sesión" logs out.
 * Only 'background' is tracked (not 'inactive') because the system
 * biometric sheet itself flips iOS to 'inactive'.
 */
function BiometricGate() {
  const locked = useBiometricLockState((s) => s.locked);
  const biometricLock = useAppStore((s) => s.biometricLock);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s._hasHydrated);
  const [appHydrated, setAppHydrated] = useState(() => useAppStore.persist.hasHydrated());
  const coldStartDone = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  // app.store persists via AsyncStorage too — wait for its rehydration so
  // we don't read the default `false` flag before the real value lands.
  useEffect(() => {
    if (appHydrated) return;
    const unsub = useAppStore.persist.onFinishHydration(() => setAppHydrated(true));
    return unsub;
  }, [appHydrated]);

  // Cold start: lock exactly once, after hydration.
  useEffect(() => {
    if (coldStartDone.current || !authHydrated || !appHydrated) return;
    coldStartDone.current = true;
    if (!biometricLock || !isAuthenticated) return;
    let alive = true;
    shouldLock().then((yes) => {
      if (alive && yes) lockNow();
    });
    return () => {
      alive = false;
    };
  }, [authHydrated, appHydrated, biometricLock, isAuthenticated]);

  // Background → foreground after the threshold.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since == null) return;
      if (Date.now() - since < BIOMETRIC_RELOCK_AFTER_MS) return;
      const { biometricLock: flag } = useAppStore.getState();
      const { isAuthenticated: authed } = useAuthStore.getState();
      if (!flag || !authed) return;
      shouldLock().then((yes) => {
        if (yes) lockNow();
      });
    });
    return () => sub.remove();
  }, []);

  // Session gone (logout / expiry) → never keep a lock over the auth flow.
  useEffect(() => {
    if (!isAuthenticated && locked) unlockNow();
  }, [isAuthenticated, locked]);

  if (!locked || !isAuthenticated) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="auto">
      <BiometricLock overlay />
    </View>
  );
}

/**
 * Auth-stack segments an *authenticated* user is allowed to stay on
 * (registration / onboarding flow). Everything else in (auth) bounces to
 * home once the session exists.
 */
const ONBOARDING_FLOW_SEGMENTS = new Set<string | undefined>([
  'register',
  'onboarding',
  'otp-email',
  'otp-phone',
  'registration-complete',
]);

function SessionGuard() {
  const { isAuthenticated, isGuest, _hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;

    const timer = setTimeout(() => {
      const inAuth = segments[0] === '(auth)';
      const seg0 = segments[0] as string | undefined;
      const inIndex = (segments as unknown as string[]).length === 0 || seg0 === 'index';
      const hasAccess = isAuthenticated || isGuest;

      // Onboarding screens live inside (auth) but REQUIRE the user to already
      // be authenticated (step1-profile calls updateProfile, etc.). They must
      // NOT be kicked back to home by the "isAuthenticated && inAuth" rule.
      // Segment 1 is the folder ('register' / 'onboarding') or the screen
      // name. otp-* are included because the OTP screen auto-logs-in after
      // verification and then routes onward itself — without this the guard
      // would race it to /(tabs)/home mid-flow.
      const seg1 = (segments as unknown as string[])[1];
      const isOnboardingFlow = inAuth && ONBOARDING_FLOW_SEGMENTS.has(seg1);

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
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0F0D0C' }}>
        <StatusBar style="light" />
        <OfflineBanner />
        <SessionGuard />
        <PushGuard />
        <PushTapRouter />
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
        <BiometricGate />
        <ToastHost />
        <NotificationBannerHost />
        <UpdateOverlay />
      </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
