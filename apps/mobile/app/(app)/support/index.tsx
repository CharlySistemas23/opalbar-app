// ─────────────────────────────────────────────
//  Support — Editorial Premium
//
//  Magazine layout for support hub:
//   · Header: back + Kicker "AYUDA" + Heading "Soporte"
//   · Hero block: Display headline + Lead subtitle
//   · CTA row: "Continuar conversación" (first non-terminal ticket) or
//     "Abrir ticket" (new)
//   · FAQ section: Kicker overline + expandable accordion rows
//   · Tickets section: Kicker + Card list with real status Badge
// ─────────────────────────────────────────────
import { LayoutAnimation, Platform, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
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
  Pressy,
  SkeletonList,
} from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Terminal statuses no longer accept user messages (mirrors TERMINAL_STATUSES
// in apps/api support.service.ts).
const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED']);

type StatusKey = 'OPEN' | 'IN_REVIEW' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
type BadgeVariant = 'default' | 'warning' | 'success' | 'danger' | 'info' | 'champagne' | 'accent';

const STATUS: Record<
  StatusKey,
  { variant: BadgeVariant; label: { es: string; en: string } }
> = {
  OPEN: { variant: 'warning', label: { es: 'Abierto', en: 'Open' } },
  IN_REVIEW: { variant: 'info', label: { es: 'En revisión', en: 'In review' } },
  WAITING_USER: { variant: 'champagne', label: { es: 'Esperando tu respuesta', en: 'Waiting on you' } },
  RESOLVED: { variant: 'success', label: { es: 'Resuelto', en: 'Resolved' } },
  CLOSED: { variant: 'default', label: { es: 'Cerrado', en: 'Closed' } },
};

const FAQ: { id: string; q: { es: string; en: string }; a: { es: string; en: string } }[] = [
  {
    id: 'reservations',
    q: { es: '¿Cómo hago o cambio una reservación?', en: 'How do I make or change a reservation?' },
    a: {
      es: 'Ve a la pestaña Reservar, elige sucursal, fecha y hora disponibles. Para modificar o cancelar una reservación existente, ábrela desde "Mis reservaciones" en tu perfil.',
      en: 'Go to the Reserve tab, pick a venue, date and an available time. To change or cancel an existing reservation, open it from "My reservations" in your profile.',
    },
  },
  {
    id: 'loyalty',
    q: { es: '¿Cómo gano y canjeo mis puntos?', en: 'How do I earn and redeem points?' },
    a: {
      es: 'Ganas puntos con cada visita registrada en el bar. Consulta tu saldo, nivel y movimientos en Perfil → Cartera.',
      en: 'You earn points on every visit registered at the bar. Check your balance, level and history in Profile → Wallet.',
    },
  },
  {
    id: 'offers',
    q: { es: '¿Cómo canjeo una oferta?', en: 'How do I redeem an offer?' },
    a: {
      es: 'Abre la oferta desde la pestaña Ofertas y toca Canjear. Se genera un código que el staff valida en tu visita.',
      en: 'Open the offer from the Offers tab and tap Redeem. A code is generated for staff to validate on your visit.',
    },
  },
  {
    id: 'account',
    q: { es: '¿Cómo administro mi cuenta y privacidad?', en: 'How do I manage my account and privacy?' },
    a: {
      es: 'Ve a Perfil → Editar perfil para tus datos, o Perfil → Privacidad para controlar quién puede ver tu actividad y solicitar tus datos.',
      en: 'Go to Profile → Edit profile for your details, or Profile → Privacy to control who can see your activity and request your data.',
    },
  },
  {
    id: 'contact',
    q: { es: '¿Cómo contacto a OPALBAR directamente?', en: 'How do I reach OPALBAR directly?' },
    a: {
      es: 'Abre un ticket aquí mismo con los detalles de tu caso. Te respondemos en menos de 24 horas y podrás seguir la conversación en esta sección.',
      en: 'Open a ticket right here with your case details. We reply within 24 hours and you can follow the conversation in this section.',
    },
  },
];

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
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    supportApi
      .myTickets()
      .then((r) => setTickets(r.data?.data?.data ?? r.data?.data ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openTicket = () => router.push('/(app)/support/new-ticket' as never);
  // The first ticket the user can still act on — anything not RESOLVED/CLOSED.
  const activeTicket = tickets.find((tk) => !TERMINAL_STATUSES.has(tk.status || ''));
  const continueOrOpen = () => {
    if (activeTicket) router.push(`/(app)/support/chat/${activeTicket.id}` as never);
    else openTicket();
  };
  const toggleFaq = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((prev) => (prev === id ? null : id));
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
                ? 'Respondemos en menos de 24 horas.'
                : 'We reply within 24 hours.'}
            </Lead>
          </FadeIn>

          {/* ── CTAs ─────────────────────────── */}
          <FadeIn delay={120} style={styles.ctaRow}>
            <View style={{ flex: 1 }}>
              <Button
                label={activeTicket ? (t ? 'Continuar conversación' : 'Continue conversation') : (t ? 'Abrir ticket' : 'Open ticket')}
                onPress={continueOrOpen}
                variant="primary"
                size="md"
                leftIcon={<Feather name="message-circle" size={16} color={Colors.textInverse} />}
              />
            </View>
            {activeTicket ? (
              <View style={{ flex: 1 }}>
                <Button
                  label={t ? 'Nuevo ticket' : 'New ticket'}
                  onPress={openTicket}
                  variant="secondary"
                  size="md"
                  leftIcon={<Feather name="edit-3" size={16} color={Colors.textPrimary} />}
                />
              </View>
            ) : null}
          </FadeIn>

          {/* ── FAQ ──────────────────────────── */}
          <FadeIn delay={200} style={styles.section}>
            <Kicker tone="muted">{t ? 'PREGUNTAS FRECUENTES' : 'FREQUENTLY ASKED'}</Kicker>
            <Heading size="sm" style={{ marginTop: Spacing[1], marginBottom: Spacing[4] }}>
              {t ? 'Antes de escribirnos' : 'Before reaching out'}
            </Heading>
            <View style={styles.listShell}>
              {FAQ.map((item, idx, arr) => {
                const expanded = openFaq === item.id;
                return (
                  <View key={item.id}>
                    <Pressy
                      onPress={() => toggleFaq(item.id)}
                      accessibilityRole={Roles.button}
                      accessibilityLabel={t ? item.q.es : item.q.en}
                      accessibilityState={{ expanded }}
                      haptic="select"
                      style={styles.faqRow}
                    >
                      <Body weight="semiBold" style={{ flex: 1 }}>
                        {t ? item.q.es : item.q.en}
                      </Body>
                      <Feather
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Colors.textMuted}
                      />
                    </Pressy>
                    {expanded ? (
                      <View style={styles.faqAnswer}>
                        <Body size="sm" tone="secondary">
                          {t ? item.a.es : item.a.en}
                        </Body>
                      </View>
                    ) : null}
                    {idx < arr.length - 1 ? (
                      <Hairline variant="subtle" marginHorizontal={Spacing[5]} />
                    ) : null}
                  </View>
                );
              })}
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

  faqRow: {
    minHeight: 56,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  faqAnswer: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[4],
  },
});
