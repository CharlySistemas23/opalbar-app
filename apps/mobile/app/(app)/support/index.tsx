// ─────────────────────────────────────────────
//  Support — Editorial Premium
//
//  Magazine layout for support hub:
//   · Header: back + Kicker "AYUDA" + Heading "Soporte"
//   · Hero block: Display headline + Lead subtitle
//   · CTA row: primary "Chat" + secondary "Abrir ticket"
//   · FAQ section: Kicker overline + ListItem rows (chevron)
//   · Tickets section: Kicker + Card list with status Badge
// ─────────────────────────────────────────────
import { ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { supportApi } from '@/api/client';
import { apiError } from '@/api/errors';
import { useAppStore } from '@/stores/app.store';
import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  FadeIn,
  Hairline,
  Heading,
  Kicker,
  Lead,
  ListItem,
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';

type StatusKey = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type BadgeVariant = 'default' | 'warning' | 'success' | 'danger' | 'info' | 'champagne' | 'accent';

const STATUS: Record<
  StatusKey,
  { variant: BadgeVariant; label: { es: string; en: string } }
> = {
  OPEN: { variant: 'warning', label: { es: 'Abierto', en: 'Open' } },
  IN_PROGRESS: { variant: 'info', label: { es: 'En curso', en: 'In progress' } },
  RESOLVED: { variant: 'success', label: { es: 'Resuelto', en: 'Resolved' } },
  CLOSED: { variant: 'default', label: { es: 'Cerrado', en: 'Closed' } },
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

interface TicketRecord {
  id: string;
  subject?: string;
  title?: string;
  status?: string;
  updatedAt?: string;
}

export default function Support() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
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

  useEffect(() => {
    load();
  }, []);

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
        <Pressy
          onPress={() => router.back()}
          haptic="select"
          hitSlop={HitSlop.expand}
          accessibilityRole={Roles.button}
          accessibilityLabel="Volver"
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressy>
        <View style={{ flex: 1 }}>
          <Kicker tone="muted">{t ? 'AYUDA' : 'HELP'}</Kicker>
          <Heading size="md" style={{ marginTop: Spacing[1] }}>
            {t ? 'Soporte' : 'Support'}
          </Heading>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: EditorialSpacing.pageGutter, paddingTop: Spacing[4] }}>
          <SkeletonList count={4} itemHeight={88} />
        </View>
      ) : error && tickets.length === 0 ? (
        <ErrorState
          message={error}
          retryLabel={t ? 'Reintentar' : 'Retry'}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ─────────────────────────── */}
          <FadeIn>
            <Kicker tone="champagne">
              {t ? 'ESTAMOS AQUÍ' : 'WE ARE HERE'}
            </Kicker>
            <Heading size="lg" style={{ marginTop: Spacing[2] }}>
              {t ? '¿En qué podemos ayudarte?' : 'How can we help?'}
            </Heading>
            <Lead style={{ marginTop: Spacing[3] }}>
              {t
                ? 'Respondemos en menos de 24 horas. Si es urgente, abre un chat.'
                : 'We reply within 24 hours. If it is urgent, open a chat.'}
            </Lead>
          </FadeIn>

          {/* ── CTAs ─────────────────────────── */}
          <FadeIn delay={120} style={styles.ctaRow}>
            <View style={{ flex: 1 }}>
              <Button
                label={t ? 'Chat en vivo' : 'Live chat'}
                onPress={openLiveChat}
                variant="primary"
                size="md"
                leftIcon={<Feather name="message-circle" size={16} color={Colors.textInverse} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t ? 'Abrir ticket' : 'Open ticket'}
                onPress={openTicket}
                variant="secondary"
                size="md"
                leftIcon={<Feather name="edit-3" size={16} color={Colors.textPrimary} />}
              />
            </View>
          </FadeIn>

          {/* ── FAQ ──────────────────────────── */}
          <FadeIn delay={200} style={styles.section}>
            <Kicker tone="muted">{t ? 'PREGUNTAS FRECUENTES' : 'FREQUENTLY ASKED'}</Kicker>
            <Heading size="sm" style={{ marginTop: Spacing[1], marginBottom: Spacing[4] }}>
              {t ? 'Antes de escribirnos' : 'Before reaching out'}
            </Heading>
            <View style={styles.listShell}>
              {(t ? FAQ.es : FAQ.en).map((q, idx, arr) => (
                <View key={q}>
                  <ListItem title={q} onPress={openTicket} showChevron />
                  {idx < arr.length - 1 ? (
                    <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
                  ) : null}
                </View>
              ))}
            </View>
          </FadeIn>

          {/* ── Tickets ──────────────────────── */}
          <FadeIn delay={280} style={styles.section}>
            <Kicker tone="muted">{t ? 'MIS TICKETS' : 'MY TICKETS'}</Kicker>
            <Heading size="sm" style={{ marginTop: Spacing[1], marginBottom: Spacing[4] }}>
              {t ? 'Conversaciones recientes' : 'Recent threads'}
            </Heading>

            {tickets.length === 0 ? (
              <Card variant="flat">
                <Body tone="secondary">
                  {t
                    ? 'Todavía no abriste ningún ticket. Empieza uno cuando lo necesites.'
                    : 'No tickets yet. Start one whenever you need.'}
                </Body>
              </Card>
            ) : (
              <View style={{ gap: Spacing[3] }}>
                {tickets.map((it) => {
                  const statusKey = (it.status as StatusKey) || 'OPEN';
                  const s = STATUS[statusKey] ?? STATUS.OPEN;
                  const when = it.updatedAt ? relTime(it.updatedAt, language) : '';
                  return (
                    <Card
                      key={it.id}
                      onPress={() => router.push(`/(app)/support/chat/${it.id}` as never)}
                      variant="flat"
                      padding={Spacing[4]}
                      accessibilityLabel={it.subject || it.title || 'Ticket'}
                    >
                      <View style={styles.ticketRow}>
                        <View style={{ flex: 1 }}>
                          <Body weight="semiBold" numberOfLines={1}>
                            {it.subject || it.title || (t ? 'Ticket' : 'Ticket')}
                          </Body>
                          {when ? (
                            <Caption tone="muted" style={{ marginTop: 2 }}>
                              {when}
                            </Caption>
                          ) : null}
                        </View>
                        <Badge variant={s.variant} label={s.label[language]} />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </FadeIn>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[5],
    gap: Spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[10],
  },

  ctaRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[6],
  },

  section: {
    marginTop: Spacing[10],
  },

  listShell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderTopColor: Colors.highlightTop,
    overflow: 'hidden',
  },

  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
});
