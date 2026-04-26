import { View, Text, StyleSheet, Switch, ScrollView, Alert, TouchableOpacity, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usersApi, friendshipsApi, type FriendPolicy } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

type DmPolicy = 'EVERYONE' | 'FOLLOWING' | 'FRIENDS_OF_FRIENDS' | 'FRIENDS_ONLY' | 'NONE';

export default function Privacy() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [settings, setSettings] = useState({ showProfile: true, showActivity: false, allowMessages: true });
  const [dmPolicy, setDmPolicy] = useState<DmPolicy>('EVERYONE');
  const [friendPolicy, setFriendPolicy] = useState<FriendPolicy>('EVERYONE');
  const [loadingPolicy, setLoadingPolicy] = useState(true);

  useEffect(() => {
    let mounted = true;
    usersApi.me()
      .then((res: any) => {
        if (!mounted) return;
        const dm = res?.data?.dmPolicy as DmPolicy | undefined;
        const fp = res?.data?.friendPolicy as FriendPolicy | undefined;
        if (dm) setDmPolicy(dm);
        if (fp) setFriendPolicy(fp);
      })
      .catch(() => {})
      .finally(() => mounted && setLoadingPolicy(false));
    return () => { mounted = false; };
  }, []);

  // Optimistic auto-save — toggling sends immediately, reverts on error.
  async function toggle(key: keyof typeof settings) {
    const prev = settings[key];
    const next = !prev;
    setSettings((p) => ({ ...p, [key]: next }));
    try {
      await usersApi.updatePrivacy({ ...settings, [key]: next });
    } catch (err: any) {
      setSettings((p) => ({ ...p, [key]: prev }));
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    }
  }

  async function selectPolicy(next: DmPolicy) {
    if (next === dmPolicy) return;
    const prev = dmPolicy;
    setDmPolicy(next);
    try {
      await usersApi.updateDmPolicy(next);
    } catch (err: any) {
      setDmPolicy(prev);
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
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
      Alert.alert(t ? 'Error' : 'Error', apiError(err));
    }
  }

  const items = [
    { key: 'showProfile' as const, label: t ? 'Perfil público' : 'Public profile', desc: t ? 'Otros usuarios pueden ver tu perfil' : 'Other users can see your profile' },
    { key: 'showActivity' as const, label: t ? 'Mostrar actividad' : 'Show activity', desc: t ? 'Tu actividad reciente es visible' : 'Your recent activity is visible' },
    { key: 'allowMessages' as const, label: t ? 'Recibir mensajes' : 'Receive messages', desc: t ? 'Otros pueden enviarte mensajes' : 'Others can send you messages' },
  ];

  const dmOptions: { value: DmPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede enviarte mensajes (irán a Solicitudes si no lo sigues)' : 'Anyone can message you (filtered to Requests if you don\'t follow them)',
    },
    {
      value: 'FOLLOWING',
      label: t ? 'Solo a quienes sigo' : 'People I follow',
      desc: t ? 'Solo gente que sigues puede iniciarte una conversación' : 'Only people you follow can start a conversation',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo gente con amigos en común puede escribirte' : 'Only people with mutual friends can message you',
    },
    {
      value: 'FRIENDS_ONLY',
      label: t ? 'Solo amigos' : 'Friends only',
      desc: t ? 'Solo tus amigos confirmados pueden escribirte' : 'Only confirmed friends can message you',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie nuevo puede enviarte mensajes' : 'No one new can message you',
    },
  ];

  const friendOptions: { value: FriendPolicy; label: string; desc: string }[] = [
    {
      value: 'EVERYONE',
      label: t ? 'Todos' : 'Everyone',
      desc: t ? 'Cualquiera puede enviarte solicitudes de amistad' : 'Anyone can send you friend requests',
    },
    {
      value: 'FRIENDS_OF_FRIENDS',
      label: t ? 'Amigos de amigos' : 'Friends of friends',
      desc: t ? 'Solo personas con amigos en común pueden enviarte solicitudes' : 'Only people with mutual friends can send requests',
    },
    {
      value: 'NONE',
      label: t ? 'Nadie' : 'No one',
      desc: t ? 'Nadie puede enviarte solicitudes de amistad' : 'No one can send you friend requests',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Privacidad' : 'Privacy'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {items.map((item, i) => (
            <View key={item.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: Colors.border, true: Colors.accentPrimary }}
                thumbColor={Colors.textInverse}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          {t ? 'Quién puede enviarme mensajes' : 'Who can message me'}
        </Text>
        <View style={styles.card}>
          {dmOptions.map((opt, i) => {
            const selected = dmPolicy === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => selectPolicy(opt.value)}
                disabled={loadingPolicy}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorder,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  <Text style={styles.rowDesc}>{opt.desc}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          {t ? 'Quién puede enviarme solicitudes de amistad' : 'Who can send me friend requests'}
        </Text>
        <View style={styles.card}>
          {friendOptions.map((opt, i) => {
            const selected = friendPolicy === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => selectFriendPolicy(opt.value)}
                disabled={loadingPolicy}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorder,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  <Text style={styles.rowDesc}>{opt.desc}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4], paddingVertical: Spacing[4], paddingBottom: Spacing[8] },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowInfo: { flex: 1, paddingRight: Spacing[3] },
  rowLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  rowDesc: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing[2],
    marginLeft: Spacing[2],
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accentPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentPrimary },
});
