// ─────────────────────────────────────────────
//  Preferences — Editorial Premium
//
//  Magazine layout: Kicker + Heading header, then grouped editorial
//  ListItem stacks split by kicker overlines: CUENTA · APP · SEGURIDAD ·
//  SOPORTE. Language picker opens an editorial Modal and PERSISTS the
//  choice on the server (PATCH /users/me/profile { language }) besides the
//  local app store. "Intereses" opens a chip editor backed by
//  GET /events/categories + PATCH /users/me/interests.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { eventsApi, usersApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Body,
  Button,
  Caption,
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Modal as UIModal,
  Pressy,
  Skeleton,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { toast } from '@/components/Toast';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Language = 'es' | 'en';

interface MenuEntry {
  icon: FeatherIcon;
  label: { es: string; en: string };
  subtitle?: { es: string; en: string };
  path?: string;
  meta?: string;
  onPress?: () => void;
}

interface Category {
  id: string;
  name: string;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
}

interface MeInterests {
  interests?: { categoryId?: string; category?: { id: string } }[];
}

function categoryLabel(c: Category, lang: Language) {
  return lang === 'en' && c.nameEn ? c.nameEn : c.name;
}

export default function Preferences() {
  const router = useRouter();
  const { language, setLanguage } = useAppStore();
  const { refreshUser } = useAuthStore();
  const t = language === 'es';
  const fb = useFeedback();

  const [langOpen, setLangOpen] = useState(false);
  const [langSaving, setLangSaving] = useState<Language | null>(null);

  // ── Interests editor ──
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestCount, setInterestCount] = useState<number | null>(null);

  const loadInterests = useCallback(async () => {
    setInterestsLoading(true);
    setInterestsError(null);
    try {
      const [catRes, meRes] = await Promise.all([eventsApi.categories(), usersApi.me()]);
      const cats: unknown = catRes?.data?.data;
      const me = (meRes?.data?.data ?? {}) as MeInterests;
      const list = Array.isArray(cats) ? (cats as Category[]) : [];
      const ids = new Set(
        (me.interests ?? [])
          .map((i) => i.category?.id ?? i.categoryId)
          .filter((id): id is string => typeof id === 'string'),
      );
      setCategories(list);
      setSelected(ids);
      setSavedIds(ids);
      setInterestCount(ids.size);
    } catch (err) {
      setInterestsError(
        apiError(err, t ? 'No se pudieron cargar los intereses.' : 'Could not load interests.'),
      );
    } finally {
      setInterestsLoading(false);
    }
  }, [t]);

  // Count for the row meta on first mount (cheap: single /users/me).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meRes = await usersApi.me();
        const me = (meRes?.data?.data ?? {}) as MeInterests;
        if (alive) setInterestCount((me.interests ?? []).length);
      } catch {
        // meta only — the editor itself surfaces errors
        if (alive) setInterestCount(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function openInterests() {
    setInterestsOpen(true);
    loadInterests();
  }

  function toggleCategory(id: string) {
    fb.select();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const interestsDirty = useMemo(() => {
    if (selected.size !== savedIds.size) return true;
    for (const id of selected) if (!savedIds.has(id)) return true;
    return false;
  }, [selected, savedIds]);

  async function saveInterests() {
    const ids = Array.from(selected);
    setInterestsSaving(true);
    try {
      await usersApi.updateInterests({ categoryIds: ids });
      setSavedIds(new Set(ids));
      setInterestCount(ids.length);
      fb.success();
      toast(t ? 'Intereses guardados.' : 'Interests saved.', 'success');
      setInterestsOpen(false);
      refreshUser().catch(() => undefined);
    } catch (err) {
      fb.error();
      toast(apiError(err, t ? 'No se pudieron guardar.' : 'Could not save.'), 'danger');
    } finally {
      setInterestsSaving(false);
    }
  }

  // ── Language ──
  async function chooseLanguage(lng: Language) {
    if (lng === language || langSaving) return;
    const previous = language;
    setLangSaving(lng);
    setLanguage(lng); // optimistic — UI flips right away
    try {
      await usersApi.updateProfile({ language: lng });
      fb.success();
      setLangOpen(false);
      refreshUser().catch(() => undefined);
    } catch (err) {
      setLanguage(previous);
      fb.error();
      toast(
        apiError(
          err,
          previous === 'es' ? 'No se pudo cambiar el idioma.' : 'Could not change language.',
        ),
        'danger',
      );
    } finally {
      setLangSaving(null);
    }
  }

  const account: MenuEntry[] = [
    {
      icon: 'user',
      label: { es: 'Perfil', en: 'Profile' },
      subtitle: { es: 'Nombre, biografía, foto.', en: 'Name, bio, photo.' },
      path: '/(app)/profile/edit',
    },
    {
      icon: 'heart',
      label: { es: 'Intereses', en: 'Interests' },
      subtitle: {
        es: 'Qué tipo de eventos te recomendamos.',
        en: 'Which kinds of events we recommend.',
      },
      meta:
        interestCount === null
          ? undefined
          : interestCount === 0
            ? t ? 'Sin elegir' : 'None'
            : String(interestCount),
      onPress: openInterests,
    },
    {
      icon: 'lock',
      label: { es: 'Cambiar contraseña', en: 'Change password' },
      subtitle: { es: 'Actualiza tus credenciales.', en: 'Update your credentials.' },
      path: '/(app)/profile/change-password',
    },
    {
      icon: 'monitor',
      label: { es: 'Sesiones activas', en: 'Active sessions' },
      subtitle: { es: 'Dispositivos conectados.', en: 'Connected devices.' },
      path: '/(app)/profile/sessions',
    },
  ];

  const app: MenuEntry[] = [
    {
      icon: 'globe',
      label: { es: 'Idioma', en: 'Language' },
      subtitle: {
        es: 'Se aplica en la app y en tus correos.',
        en: 'Applies to the app and your emails.',
      },
      meta: t ? 'Español' : 'English',
      onPress: () => setLangOpen(true),
    },
    {
      icon: 'bell',
      label: { es: 'Notificaciones', en: 'Notifications' },
      subtitle: { es: 'Qué alertas quieres recibir.', en: 'Which alerts to receive.' },
      path: '/(app)/profile/notification-settings',
    },
  ];

  const security: MenuEntry[] = [
    {
      icon: 'shield',
      label: { es: 'Privacidad', en: 'Privacy' },
      subtitle: { es: 'Bloqueos y visibilidad.', en: 'Blocks and visibility.' },
      path: '/(app)/profile/privacy',
    },
    {
      icon: 'download',
      label: { es: 'Mis datos (GDPR)', en: 'My data (GDPR)' },
      subtitle: { es: 'Exportar o eliminar tu cuenta.', en: 'Export or delete your account.' },
      path: '/(app)/profile/gdpr',
    },
  ];

  const support: MenuEntry[] = [
    {
      icon: 'help-circle',
      label: { es: 'Centro de ayuda', en: 'Help center' },
      path: '/(app)/support',
    },
    {
      icon: 'info',
      label: { es: 'Acerca de OPALBAR', en: 'About OPALBAR' },
      subtitle: { es: 'Versión y términos.', en: 'Version and terms.' },
      path: '/(app)/profile/about',
    },
  ];

  function go(entry: MenuEntry) {
    if (entry.onPress) return entry.onPress();
    if (entry.path) router.push(entry.path as never);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          accessibilityRole={Roles.button}
          accessibilityLabel={t ? 'Atrás' : 'Back'}
          hitSlop={HitSlop.expand}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </Pressy>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.hero}>
          <Kicker tone="muted">{t ? 'AJUSTES' : 'SETTINGS'}</Kicker>
          <Heading size="md">{t ? 'Preferencias' : 'Preferences'}</Heading>
        </FadeIn>

        <Section
          kicker={t ? 'CUENTA' : 'ACCOUNT'}
          entries={account}
          language={language}
          onPress={go}
          delay={80}
        />
        <Section
          kicker={t ? 'APLICACIÓN' : 'APPLICATION'}
          entries={app}
          language={language}
          onPress={go}
          delay={140}
        />
        <Section
          kicker={t ? 'SEGURIDAD Y DATOS' : 'SECURITY & DATA'}
          entries={security}
          language={language}
          onPress={go}
          delay={200}
        />
        <Section
          kicker={t ? 'SOPORTE' : 'SUPPORT'}
          entries={support}
          language={language}
          onPress={go}
          delay={260}
        />
      </ScrollView>

      {/* ── Language picker ── */}
      <UIModal
        open={langOpen}
        onClose={() => {
          if (!langSaving) setLangOpen(false);
        }}
        title={t ? 'Idioma' : 'Language'}
      >
        <View style={{ gap: Spacing[2] }}>
          {(['es', 'en'] as const).map((lng) => {
            const active = language === lng;
            const saving = langSaving === lng;
            return (
              <Pressy
                key={lng}
                onPress={() => chooseLanguage(lng)}
                haptic="select"
                disabled={!!langSaving}
                accessibilityRole={Roles.button}
                accessibilityLabel={lng === 'es' ? 'Español' : 'English'}
                accessibilityState={{ selected: active, busy: saving }}
                style={[styles.langOption, active && styles.langOptionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Body weight="semiBold">{lng === 'es' ? 'Español' : 'English'}</Body>
                  <Body size="sm" tone="muted">
                    {lng === 'es'
                      ? t ? 'Español (México)' : 'Spanish (Mexico)'
                      : t ? 'Inglés (Estados Unidos)' : 'English (United States)'}
                  </Body>
                </View>
                {saving ? (
                  <Feather name="loader" size={18} color={Colors.textMuted} />
                ) : active ? (
                  <Feather name="check" size={18} color={Colors.accentPrimary} />
                ) : null}
              </Pressy>
            );
          })}
          <Caption tone="muted" style={{ marginTop: Spacing[2] }}>
            {t
              ? 'También cambia el idioma de tus notificaciones y correos.'
              : 'Also changes the language of your notifications and emails.'}
          </Caption>
        </View>
      </UIModal>

      {/* ── Interests editor ── */}
      <UIModal
        open={interestsOpen}
        onClose={() => {
          if (!interestsSaving) setInterestsOpen(false);
        }}
        title={t ? 'Intereses' : 'Interests'}
        size="lg"
      >
        <View style={{ gap: Spacing[4] }}>
          <Body size="sm" tone="secondary">
            {t
              ? 'Elige los tipos de evento que más te gustan. Usamos esto para recomendarte planes y avisarte primero.'
              : 'Pick the kinds of events you enjoy most. We use this to recommend plans and let you know first.'}
          </Body>

          {interestsLoading ? (
            <View style={styles.chipRow}>
              {[96, 72, 120, 88, 64, 104].map((w, i) => (
                <Skeleton key={i} width={w} height={36} radius={Radius.full} />
              ))}
            </View>
          ) : interestsError ? (
            <ErrorState
              message={interestsError}
              retryLabel={t ? 'Reintentar' : 'Retry'}
              onRetry={loadInterests}
              icon="heart"
            />
          ) : categories.length === 0 ? (
            <Body size="sm" tone="muted">
              {t
                ? 'Aún no hay categorías disponibles. Vuelve más tarde.'
                : 'No categories available yet. Check back later.'}
            </Body>
          ) : (
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = selected.has(c.id);
                const label = categoryLabel(c, language);
                return (
                  <Pressy
                    key={c.id}
                    onPress={() => toggleCategory(c.id)}
                    haptic="none"
                    accessibilityRole={Roles.button}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    {active ? (
                      <Feather name="check" size={12} color={Colors.textInverse} />
                    ) : null}
                    <Caption
                      tone={active ? 'inverse' : 'secondary'}
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                    >
                      {label}
                    </Caption>
                  </Pressy>
                );
              })}
            </View>
          )}

          {!interestsLoading && !interestsError && categories.length > 0 ? (
            <View style={styles.modalActions}>
              <Caption tone="muted">
                {selected.size === 0
                  ? t ? 'Ninguno elegido' : 'None selected'
                  : t
                    ? `${selected.size} elegido${selected.size === 1 ? '' : 's'}`
                    : `${selected.size} selected`}
              </Caption>
              <Button
                label={t ? 'Guardar' : 'Save'}
                onPress={saveInterests}
                variant="primary"
                size="md"
                loading={interestsSaving}
                disabled={!interestsDirty || interestsSaving}
                haptic="success"
              />
            </View>
          ) : null}
        </View>
      </UIModal>
    </SafeAreaView>
  );
}

function Section({
  kicker,
  entries,
  language,
  onPress,
  delay,
}: {
  kicker: string;
  entries: MenuEntry[];
  language: 'es' | 'en';
  onPress: (e: MenuEntry) => void;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.section}>
      <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
        {kicker}
      </Kicker>
      <View style={styles.listShell}>
        {entries.map((entry, idx) => (
          <View key={entry.label.es}>
            <ListItem
              title={entry.label[language]}
              subtitle={entry.subtitle ? entry.subtitle[language] : undefined}
              meta={entry.meta}
              leftIcon={<Feather name={entry.icon} size={18} color={Colors.textSecondary} />}
              onPress={() => onPress(entry)}
              showChevron={!entry.meta}
            />
            {idx < entries.length - 1 ? <ListItem.Separator /> : null}
          </View>
        ))}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[12],
  },
  hero: {
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  section: {
    marginTop: Spacing[8],
  },
  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  langOptionActive: {
    borderColor: Colors.accentPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
});
