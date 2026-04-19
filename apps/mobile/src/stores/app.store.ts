// ─────────────────────────────────────────────
//  App Store — global app state (language, theme, etc.)
// ─────────────────────────────────────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'es' | 'en';

interface AppState {
  language: Language;
  hasOnboarded: boolean;
  notificationCount: number;

  setLanguage: (lang: Language) => void;
  setHasOnboarded: (val: boolean) => void;
  setNotificationCount: (count: number) => void;
  incrementNotifications: () => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'es',
      hasOnboarded: false,
      notificationCount: 0,

      setLanguage: (language) => set({ language }),
      setHasOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      setNotificationCount: (notificationCount) => set({ notificationCount }),
      incrementNotifications: () => set((s) => ({ notificationCount: s.notificationCount + 1 })),
      clearNotifications: () => set({ notificationCount: 0 }),
    }),
    {
      name: 'opalbar-app',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
