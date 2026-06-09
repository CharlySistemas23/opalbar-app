// ─────────────────────────────────────────────
//  Privacy — Editorial Premium
//
//  Magazine layout:
//   · Kicker + Heading header
//   · 4 grouped sections: VISIBILIDAD · MENSAJES · ETIQUETAS · AMISTAD
//   · Visibility uses native Switch inside ListItem.rightSlot
//   · Policy pickers use ListItem rows with custom radio rightSlot, the
//     selected one carries the accent left bar via ListItem `selected`
//   · Optimistic updates with toast rollback
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  usersApi,
  friendshipsApi,
  mentionsApi,
  type FriendPolicy,
  type MentionPolicy,
} from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';
import { Colors, EditorialSpacing, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  FadeIn,
  Heading,
  Kicker,
  ListItem,
  Pressy,
} from '@/components/ui';
import { toast } from '@/components/Toast';

type DmPolicy = 'EVERYONE' | 'FOLLOWING' | 'FRIENDS_OF_FRIENDS' | 'FRIENDS_ONLY' | 'NONE';

export default function Privacy() {
  const router = useRouter();
  const { language } = useAppStore();
  const fb = useFeedback();
  const t = language === 'es';

  const [settings, setSettings] = useState({ showProfile: true, showActivity: false, allowMessages: true });
  const [dmPolicy, setDmPolicy] = useState<DmPolicy>('EVERYONE');
  const [friendPolicy, setFriendPolicy] = useState<FriendPolicy>('EVERYONE');
  const [mentionPolicy, setMentionPolicy] = useState<MentionPolicy>('EVERYONE');
  const [loadingPolicy, setLoadingPolicy] = useState(true);

  useEffect(() => {
    let mounted = true;
    usersApi
      .me()
      .then((res: any) => {
        if (!mounted) return;
        const dm = res?.data?.dmPolicy as DmPolicy | undefined;
        const fp = res?.data?.friendPolicy as FriendPolicy | undefined;
        const mp = res?.data?.mentionPolicy as MentionPolicy | undefined;
        if (dm) setDmPolicy(dm);
        if (fp) setFriendPolicy(fp);
        if (mp) setMentionPolicy(mp);
      })
      .catch(() => {})
      .finally(() => mounted && setLoadingPolicy(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function toggle(key: keyof typeof settings) {
    const prev = settings[key];
    const next = !prev;
    fb.toggle(next);
    setSettings((p) => ({ ...p, [key]: next }));
    try {
      await usersApi.updatePrivacy({ ...settings, [key]: next });
    } catch (err: any) {
      setSettings((p) => ({ ...p, [key]: prev }));
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    }
  }

  async function selectDmPolicy(next: DmPolicy) {
    if (next === dmPolicy) return;
    const prev = dmPolicy;
    setDmPolicy(next);
    try {
      await usersApi.updateDmPolicy(next);
    } catch (err: any) {
      setDmPolicy(prev);
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    }
  }

  async function selectFriendPolicy(next: FriendPolicy) {
    if (next === friendPolicy) return;
    const prev = friendPolicy;
    setFriendPolicy(next);
    try {
      await friendshipsApi.updatePolicy(next);
    } catch (err: any) {
      setFriendPolicy(prev);
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    }
  }

  async function selectMentionPolicy(next: MentionPolicy) {
    if (next === mentionPolicy) return;
    const prev = mentionPolicy;
    setMentionPolicy(next);
    try {
      await mentionsApi.updatePolicy(next);
    } catch (err: any) {
      setMentionPolicy(prev);
      toast(apiError(err, t ? 'No se pudo guardar.' : 'Save failed.'), 'danger');
    }
  }

  const visibility = [
    { key: 'showProfile' as const, label: t ? 'Perfil público' : 'Public profile', desc: t ? 'Otros usuarios pueden ver tu perfil.' : 'Other users can see your profile.' },
    { key: 'showActivity' as const, label: t ? 'Mostrar actividad' : 'Show activity', desc: t ? 'Tu actividad reciente es visible.' : 'Your recent activity is visible.' },
    { key: 'allowMessages' as const, label: t ? 'Recibir mensajes' : 'Receive messages', desc: t ? 'Otros pueden enviarte mensajes.' : 'Others can send you messages.' },
  ];

  const dmOptions: { value: DmPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede escribirte (irán a Solicitudes si no lo sigues).' : "Anyone can message you (filtered to Requests if you don't follow).",
    },
    {
      value: 'FOLLOWING',
      label: t ? 'Solo a quienes sigo' : 'People I follow',
      desc: t ? 'Solo gente que sigues puede iniciar conversación.' : 'Only people you follow can start a conversation.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo gente con amigos en común puede escribirte.' : 'Only people with mutual friends can message you.',
    },
    {
      value: 'FRIENDS_ONLY',
      label: t ? 'Solo amigos' : 'Friends only',
      desc: t ? 'Solo tus amigos confirmados pueden escribirte.' : 'Only confirmed friends can message you.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie nuevo puede enviarte mensajes.' : 'No one new can message you.',
    },
  ];

  const mentionOptions: { value: MentionPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede etiquetarte y aparece de inmediato.' : 'Anyone can tag you and it appears instantly.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Amigos al instante; amigos de amigos requieren aprobación.' : 'Friends tag instantly; friends-of-friends need approval.',
    },
    {
      value: 'FRIENDS_ONLY',
      label: t ? 'Solo amigos' : 'Friends only',
      desc: t ? 'Solo amigos al instante; otros requieren aprobación.' : 'Only friends tag instantly; others require approval.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie puede etiquetarte.' : 'No one can tag you.',
    },
  ];

  const friendOptions: { value: FriendPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede enviarte solicitudes.' : 'Anyone can send you friend requests.',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo personas con amigos en común.' : 'Only people with mutual friends.',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie puede enviarte solicitudes.' : 'No one can send you friend requests.',
    },
  ];

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
          <Heading size="md">{t ? 'Privacidad' : 'Privacy'}</Heading>
        </FadeIn>

        {/* ── Visibilidad ── */}
        <FadeIn delay={80} style={styles.section}>
          <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
            {t ? 'VISIBILIDAD' : 'VISIBILITY'}
          </Kicker>
          <View style={styles.listShell}>
            {visibility.map((it, idx) => (
              <View key={it.key}>
                <ListItem
                  title={it.label}
                  subtitle={it.desc}
                  rightSlot={
                    <Switch
                      value={settings[it.key]}
                      onValueChange={() => toggle(it.key)}
                      trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                      thumbColor={Colors.textInverse}
                      accessibilityLabel={it.label}
                    />
                  }
                />
                {idx < visibility.length - 1 ? <ListItem.Separator /> : null}
              </View>
            ))}
          </View>
        </FadeIn>

        <PolicyGroup
          kicker={t ? 'QUIÉN PUEDE ESCRIBIRME' : 'WHO CAN MESSAGE ME'}
          options={dmOptions}
          value={dmPolicy}
          onSelect={selectDmPolicy}
          disabled={loadingPolicy}
          delay={140}
        />
        <PolicyGroup
          kicker={t ? 'QUIÉN PUEDE ETIQUETARME' : 'WHO CAN TAG ME'}
          options={mentionOptions}
          value={mentionPolicy}
          onSelect={selectMentionPolicy}
          disabled={loadingPolicy}
          delay={200}
        />
        <PolicyGroup
          kicker={t ? 'SOLICITUDES DE AMISTAD' : 'FRIEND REQUESTS'}
          options={friendOptions}
          value={friendPolicy}
          onSelect={selectFriendPolicy}
          disabled={loadingPolicy}
          delay={260}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyGroup<T extends string>({
  kicker,
  options,
  value,
  onSelect,
  disabled,
  delay,
}: {
  kicker: string;
  options: { value: T; label: string; desc: string }[];
  value: T;
  onSelect: (v: T) => void;
  disabled?: boolean;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.section}>
      <Kicker tone="muted" style={{ marginBottom: Spacing[3] }}>
        {kicker}
      </Kicker>
      <View style={styles.listShell}>
        {options.map((opt, idx) => {
          const selected = value === opt.value;
          return (
            <View key={opt.value}>
              <ListItem
                title={opt.label}
                subtitle={opt.desc}
                selected={selected}
                onPress={() => onSelect(opt.value)}
                disabled={disabled}
                rightSlot={<Radio selected={selected} />}
              />
              {idx < options.length - 1 ? <ListItem.Separator /> : null}
            </View>
          );
        })}
      </View>
    </FadeIn>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={[styles.radio, selected && styles.radioOn]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.accentPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentPrimary,
  },
});
