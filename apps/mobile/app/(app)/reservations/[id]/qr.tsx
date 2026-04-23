import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { reservationsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { apiError } from '@/api/errors';
import { Colors } from '@/constants/tokens';

export default function ReservationQR() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [code, setCode] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ venue?: string; date?: string; partySize?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    reservationsApi
      .detail(id)
      .then((r) => {
        const res = r.data?.data ?? r.data;
        setCode(res?.confirmCode ?? res?.code ?? null);
        setMeta({
          venue: res?.venue?.name,
          date: res?.date ?? res?.startTime,
          partySize: res?.partySize,
        });
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const dateStr = meta?.date ? new Date(meta.date).toLocaleString(language, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Feather name="x" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t ? 'Código de reserva' : 'Reservation code'}</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={Colors.accentPrimary} />
        ) : error ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Feather name="alert-circle" size={32} color={Colors.accentDanger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : code ? (
          <>
            <Text style={styles.lead}>
              {t
                ? 'Muestra este código en la entrada para hacer check-in.'
                : 'Show this code at the door to check in.'}
            </Text>

            <View style={styles.qrCard}>
              <QRCode value={code} size={240} backgroundColor="#FFFFFF" color="#0B0B0F" />
            </View>

            <View style={styles.codeBox}>
              <Text style={styles.codeLbl}>{t ? 'CÓDIGO' : 'CODE'}</Text>
              <Text style={styles.codeVal}>{code}</Text>
            </View>

            {meta?.venue ? (
              <View style={styles.metaCard}>
                <MetaRow icon="map-pin" label={meta.venue} />
                {dateStr ? <MetaRow icon="calendar" label={dateStr} /> : null}
                {meta.partySize ? (
                  <MetaRow icon="users" label={`${meta.partySize} ${t ? 'personas' : 'guests'}`} />
                ) : null}
              </View>
            ) : null}

            <Text style={styles.hint}>
              {t
                ? 'Mantén tu pantalla encendida. Si pierdes el código, puedes volver a esta reserva cuando quieras.'
                : 'Keep your screen on. If you lose the code, you can return to this reservation anytime.'}
            </Text>
          </>
        ) : (
          <Text style={styles.errorText}>{t ? 'Esta reserva no tiene código.' : 'This reservation has no code.'}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function MetaRow({ icon, label }: { icon: React.ComponentProps<typeof Feather>['name']; label: string }) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.metaLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  lead: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  qrCard: {
    padding: 20, borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  codeBox: {
    alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  codeLbl: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  codeVal: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: 3 },

  metaCard: {
    width: '100%', gap: 10,
    padding: 14, borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLbl: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },

  hint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
});
