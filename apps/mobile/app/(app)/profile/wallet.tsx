import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { walletApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

export default function Wallet() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';

  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([
      walletApi.wallet().then((r) => setWallet(r.data?.data)),
      walletApi.transactions({}).then((r) => setTxs(r.data?.data?.data ?? [])),
    ])
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const points = wallet?.points ?? user?.points ?? 0;
  const levelName = wallet?.currentLevel?.name || user?.profile?.loyaltyLevel?.name || (t ? 'Ámbar' : 'Amber');
  const nextLevel = wallet?.nextLevel;
  const delta = nextLevel ? Math.max(0, (nextLevel.minPoints ?? 0) - points) : 0;
  const progress = nextLevel
    ? Math.min(1, points / (nextLevel.minPoints || 1))
    : 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Mis puntos' : 'My points'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.accentPrimary} />
        </View>
      ) : error && !wallet ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => { setLoading(true); load(); }}
        />
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(tx) => tx.id}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
              <View style={styles.bigCard}>
                <View style={styles.starBox}>
                  <Feather name="star" size={28} color={Colors.textInverse} />
                </View>
                <Text style={styles.bigLabel}>{t ? 'Tus puntos OPAL' : 'Your OPAL points'}</Text>
                <Text style={styles.bigValue}>{points.toLocaleString(language)} pts</Text>
                <Text style={styles.bigLevel}>
                  {t ? `Nivel ${levelName}` : `${levelName} Level`}
                  {nextLevel ? ` • ${delta} pts ${t ? 'para' : 'to'} ${nextLevel.name}` : ''}
                </Text>
                {nextLevel && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(app)/offers' as never)}>
                  <Feather name="gift" size={18} color={Colors.accentPrimary} />
                  <Text style={styles.actionLabel}>{t ? 'Canjear' : 'Redeem'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push('/(app)/profile/loyalty-levels')}
                >
                  <Feather name="award" size={18} color={Colors.accentPrimary} />
                  <Text style={styles.actionLabel}>{t ? 'Niveles' : 'Levels'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>{t ? 'Historial' : 'History'}</Text>
            </View>
          }
          renderItem={({ item }) => <TxRow tx={item} lang={language} t={t} />}
          ListEmptyComponent={
            <EmptyState
              icon="clock"
              title={t ? 'Aún no hay movimientos' : 'No transactions yet'}
              message={t ? 'Tus puntos ganados y canjeados aparecerán aquí.' : 'Your earned and spent points will appear here.'}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

function TxRow({ tx, lang, t }: { tx: any; lang: 'es' | 'en'; t: boolean }) {
  const amount = tx.amount ?? tx.points ?? 0;
  const isPositive = amount > 0;
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: (isPositive ? Colors.accentSuccess : Colors.accentDanger) + '20' }]}>
        <Feather
          name={isPositive ? 'arrow-down-left' : 'arrow-up-right'}
          size={18}
          color={isPositive ? Colors.accentSuccess : Colors.accentDanger}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txLabel} numberOfLines={1}>
          {tx.description || tx.reason || (t ? 'Transacción' : 'Transaction')}
        </Text>
        <Text style={styles.txDate}>
          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(lang) : ''}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isPositive ? Colors.accentSuccess : Colors.accentDanger }]}>
        {isPositive ? '+' : ''}{amount} pts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
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
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  bigCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(244, 163, 64, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244, 163, 64, 0.3)',
    gap: 8,
  },
  starBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  bigLabel: { color: Colors.textSecondary, fontSize: 13 },
  bigValue: { color: Colors.accentPrimary, fontSize: 36, fontWeight: '800' },
  bigLevel: { color: Colors.textMuted, fontSize: 12 },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(244, 163, 64, 0.2)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accentPrimary },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },

  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 6 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  txLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  txDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800' },

  empty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});
