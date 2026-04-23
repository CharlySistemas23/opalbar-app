import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { ErrorState } from '@/components/ErrorState';
import { Colors, Radius } from '@/constants/tokens';

const STATUS: Record<string, { color: string; label: { es: string; en: string } }> = {
  OPEN:        { color: Colors.accentPrimary, label: { es: 'Abierto',    en: 'Open' } },
  IN_PROGRESS: { color: '#60A5FA',            label: { es: 'En curso',   en: 'In progress' } },
  RESOLVED:    { color: Colors.accentSuccess, label: { es: 'Resuelto',   en: 'Resolved' } },
  CLOSED:      { color: Colors.textMuted,     label: { es: 'Cerrado',    en: 'Closed' } },
};

const FAQ = {
  es: [
    '¿Cómo hago una reservación?',
    '¿Cómo canjeo mis puntos?',
    '¿Cómo cambio mi contraseña?',
    'Reportar un problema técnico',
  ],
  en: [
    'How do I make a reservation?',
    'How do I redeem my points?',
    'How do I change my password?',
    'Report a technical issue',
  ],
};

export default function Support() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    supportApi
      .myTickets()
      .then((r) => setTickets(r.data?.data?.data ?? r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openTicket = () => router.push('/(app)/support/new-ticket' as never);

  const openLiveChat = () => {
    if (tickets.length > 0) {
      router.push(`/(app)/support/chat/${tickets[0].id}` as never);
      return;
    }
    openTicket();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Soporte y Ayuda' : 'Support & Help'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accentPrimary} /></View>
      ) : error && tickets.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{t ? '¿En qué podemos ayudarte?' : 'How can we help you?'}</Text>
            <Text style={styles.heroSub}>{t ? 'Respuesta garantizada en menos de 24h' : 'Guaranteed response in less than 24h'}</Text>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.liveBtn} onPress={openLiveChat} activeOpacity={0.9}>
              <Text style={styles.liveBtnText}>{t ? 'Chat en vivo' : 'Live chat'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ticketBtn} onPress={openTicket} activeOpacity={0.9}>
              <Text style={styles.ticketBtnText}>{t ? 'Abrir ticket' : 'Open ticket'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t ? 'Preguntas frecuentes' : 'Frequently asked questions'}</Text>
            {(t ? FAQ.es : FAQ.en).map((q) => (
              <TouchableOpacity key={q} style={styles.faqRow} onPress={openTicket} activeOpacity={0.85}>
                <Text style={styles.faqText}>{q}</Text>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t ? 'Mis tickets' : 'My tickets'}</Text>
            {tickets.length === 0 ? (
              <View style={styles.emptyTicket}>
                <Text style={styles.emptyTicketText}>{t ? 'No tienes tickets todavía.' : 'You do not have tickets yet.'}</Text>
              </View>
            ) : (
              tickets.map((item) => {
                const status = STATUS[item.status] ?? STATUS.OPEN;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.ticket}
                    onPress={() => router.push(`/(app)/support/chat/${item.id}` as never)}
                    activeOpacity={0.9}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subject} numberOfLines={1}>{item.subject || item.title}</Text>
                      <Text style={styles.date}>
                        {(status.label[language] || status.label.es)} · {item.updatedAt ? relTime(item.updatedAt, language) : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label[language]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function relTime(date: string, locale: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diff < 60) return locale === 'es' ? `hace ${diff}s` : `${diff}s ago`;
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return locale === 'es' ? `hace ${m}m` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return locale === 'es' ? `hace ${h}h` : `${h}h ago`;
  }
  const d = Math.floor(diff / 86400);
  return locale === 'es' ? `hace ${d}d` : `${d}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 20,
  },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  liveBtn: {
    flex: 1,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  liveBtnText: {
    color: Colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  ticketBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ticketBtnText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  section: { gap: 8 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  faqRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  ticket: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  subject: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  emptyTicket: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  emptyTicketText: { color: Colors.textSecondary, fontSize: 13 },
});
