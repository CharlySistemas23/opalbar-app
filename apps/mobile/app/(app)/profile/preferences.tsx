import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Row {
  icon: FeatherIcon;
  label: { es: string; en: string };
  sub?: { es: string; en: string };
  path?: string;
  color: string;
  right?: string;
}

export default function Preferences() {
  const router = useRouter();
  const { language, setLanguage } = useAppStore();
  const t = language === 'es';
  const [langOpen, setLangOpen] = useState(false);

  const sections: { title: { es: string; en: string }; rows: Row[] }[] = [
    {
      title: { es: 'CUENTA', en: 'ACCOUNT' },
      rows: [
        { icon: 'user', label: { es: 'Perfil', en: 'Profile' }, sub: { es: 'Nombre, bio, foto', en: 'Name, bio, photo' }, color: Colors.accentPrimary, path: '/(app)/profile/edit' },
        { icon: 'lock', label: { es: 'Cambiar contraseña', en: 'Change password' }, sub: { es: 'Actualiza tus credenciales', en: 'Update your credentials' }, color: '#60A5FA', path: '/(app)/profile/change-password' },
        { icon: 'monitor', label: { es: 'Sesiones activas', en: 'Active sessions' }, sub: { es: 'Dispositivos conectados', en: 'Connected devices' }, color: '#A855F7', path: '/(app)/profile/sessions' },
      ],
    },
    {
      title: { es: 'APP', en: 'APP' },
      rows: [
        {
          icon: 'globe',
          label: { es: 'Idioma', en: 'Language' },
          right: t ? 'Español' : 'English',
          color: Colors.accentSuccess,
        },
        { icon: 'bell', label: { es: 'Notificaciones', en: 'Notifications' }, sub: { es: 'Qué alertas recibir', en: 'Which alerts to receive' }, color: Colors.accentPrimary, path: '/(app)/profile/notification-settings' },
      ],
    },
    {
      title: { es: 'SEGURIDAD Y DATOS', en: 'SECURITY & DATA' },
      rows: [
        { icon: 'shield', label: { es: 'Privacidad', en: 'Privacy' }, sub: { es: 'Bloqueos y visibilidad', en: 'Blocks and visibility' }, color: '#60A5FA', path: '/(app)/profile/privacy' },
        { icon: 'download', label: { es: 'Mis datos (GDPR)', en: 'My data (GDPR)' }, sub: { es: 'Exportar o eliminar', en: 'Export or delete' }, color: Colors.accentDanger, path: '/(app)/profile/gdpr' },
      ],
    },
    {
      title: { es: 'SOPORTE', en: 'SUPPORT' },
      rows: [
        { icon: 'help-circle', label: { es: 'Centro de ayuda', en: 'Help center' }, color: '#60A5FA', path: '/(app)/support' },
        { icon: 'info', label: { es: 'Acerca de OPALBAR', en: 'About OPALBAR' }, sub: { es: 'Versión y términos', en: 'Version and terms' }, color: Colors.textMuted, path: '/(app)/profile/about' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Preferencias' : 'Preferences'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
        {sections.map((sec) => (
          <View key={sec.title.es} style={{ gap: 8 }}>
            <Text style={styles.sectionLbl}>{t ? sec.title.es : sec.title.en}</Text>
            <View style={styles.group}>
              {sec.rows.map((r, i) => {
                const isLang = r.icon === 'globe';
                return (
                  <TouchableOpacity
                    key={r.label.es}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (isLang) setLangOpen(true);
                      else if (r.path) router.push(r.path as never);
                    }}
                    disabled={!isLang && !r.path}
                  >
                    <View style={[styles.iconBox, { backgroundColor: r.color + '20' }]}>
                      <Feather name={r.icon} size={16} color={r.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLbl}>{t ? r.label.es : r.label.en}</Text>
                      {r.sub ? <Text style={styles.rowSub}>{t ? r.sub.es : r.sub.en}</Text> : null}
                    </View>
                    {r.right ? (
                      <Text style={styles.rowRight}>{r.right}</Text>
                    ) : (
                      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setLangOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.langCard}>
            <Text style={styles.langTitle}>{t ? 'Idioma' : 'Language'}</Text>
            {(['es', 'en'] as const).map((lng) => {
              const active = language === lng;
              return (
                <TouchableOpacity
                  key={lng}
                  style={[styles.langOption, active && styles.langOptionActive]}
                  onPress={() => { setLanguage(lng); setLangOpen(false); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.langFlag}>{lng === 'es' ? '🇪🇸' : '🇬🇧'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.langName}>{lng === 'es' ? 'Español' : 'English'}</Text>
                    <Text style={styles.langSub}>{lng === 'es' ? 'Idioma predeterminado' : 'Secondary'}</Text>
                  </View>
                  {active && <Feather name="check" size={18} color={Colors.accentPrimary} />}
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  sectionLbl: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  group: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rowRight: { color: Colors.accentPrimary, fontSize: 13, fontWeight: '700' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  langCard: {
    width: '100%', gap: 10,
    padding: 20, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  langTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  langOptionActive: { borderColor: Colors.accentPrimary, backgroundColor: 'rgba(244,163,64,0.1)' },
  langFlag: { fontSize: 22 },
  langName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  langSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
