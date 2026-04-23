// ─────────────────────────────────────────────
//  App Store — global app state (language, theme, etc.)
// ─────────────────────────────────────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

function getPlatformStorage() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-async-storage/async-storage').default;
}

type Language = 'es' | 'en';

interface AppState {
  language: Language;
  hasOnboarded: boolean;
  notificationCount: number;
  hapticsEnabled: boolean;
  soundsEnabled: boolean;

  setLanguage: (lang: Language) => void;
  setHasOnboarded: (val: boolean) => void;
  setNotificationCount: (count: number) => void;
  incrementNotifications: () => void;
  clearNotifications: () => void;
  setHapticsEnabled: (val: boolean) => void;
  setSoundsEnabled: (val: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'es',
      hasOnboarded: false,
      notificationCount: 0,
      hapticsEnabled: true,
      soundsEnabled: true,

      setLanguage: (language) => set({ language }),
      setHasOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      setNotificationCount: (notificationCount) => set({ notificationCount }),
      incrementNotifications: () => set((s) => ({ notificationCount: s.notificationCount + 1 })),
      clearNotifications: () => set({ notificationCount: 0 }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundsEnabled: (soundsEnabled) => set({ soundsEnabled }),
    }),
    {
      name: 'opalbar-app',
      storage: createJSONStorage(() => getPlatformStorage()),
    },
  ),
);
