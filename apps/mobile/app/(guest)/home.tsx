import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Badge } from '@/components/ui';
import { eventsApi, offersApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

export default function GuestHome() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [events, setEvents] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventsApi.list({ limit: 5 }),
      offersApi.list({ limit: 3 }),
    ]).then(([eRes, oRes]) => {
      setEvents(eRes.data.data?.items ?? []);
      setOffers(oRes.data.data?.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t ? '¡Bienvenido!' : 'Welcome!'}</Text>
          <Text style={styles.sub}>{t ? 'Explora lo que tenemos para ti' : 'Explore what we have for you'}</Text>
        </View>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginText}>{t ? 'Iniciar sesión' : 'Sign in'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.guestBanner}>
        <View style={styles.bannerIcon}>
          <Feather name="lock" size={18} color={Colors.accentPrimary} />
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>{t ? 'Modo invitado' : 'Guest mode'}</Text>
          <Text style={styles.bannerDesc}>{t ? 'Regístrate para asistir a eventos y más' : 'Register to attend events and more'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')} hitSlop={8}>
          <Text style={styles.registerLink}>{t ? 'Registrarse' : 'Register'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accentPrimary} style={{ marginTop: Spacing[8] }} />
      ) : (
        <FlatList
          data={[{ type: 'events' }, { type: 'offers' }]}
          keyExtractor={(item) => item.type}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'events') {
              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t ? 'Próximos eventos' : 'Upcoming events'}</Text>
                  {events.map((event) => (
                    <Card key={event.id} style={styles.card}>
                      <View style={styles.cardRow}>
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
                          <Text style={styles.cardMeta}>
                            {event.startDate ? new Date(event.startDate).toLocaleDateString(language) : ''}
                          </Text>
                        </View>
                        <Badge label={event.status ?? 'ACTIVE'} variant="success" />
                      </View>
                    </Card>
                  ))}
                </View>
              );
            }
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t ? 'Ofertas disponibles' : 'Available offers'}</Text>
                {offers.map((offer) => (
                  <Card key={offer.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <Text style={styles.offerEmoji}>🏷</Text>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>{offer.description}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5] },
  greeting: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  loginBtn: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.accentPrimary },
  loginText: { fontSize: Typography.fontSize.sm, color: Colors.accentPrimary, fontWeight: Typography.fontWeight.semiBold },
  guestBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginHorizontal: Spacing[5], marginBottom: Spacing[4], backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing[4] },
  bannerEmoji: { fontSize: 24 },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(244,163,64,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerInfo: { flex: 1 },
  bannerTitle: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textPrimary },
  bannerDesc: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  registerLink: { fontSize: Typography.fontSize.sm, color: Colors.accentPrimary, fontWeight: Typography.fontWeight.semiBold },
  listContent: { paddingBottom: Spacing[8] },
  section: { paddingHorizontal: Spacing[5], gap: Spacing[3], marginBottom: Spacing[6] },
  sectionTitle: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  card: { padding: Spacing[4] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  offerEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semiBold, color: Colors.textPrimary },
  cardMeta: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
