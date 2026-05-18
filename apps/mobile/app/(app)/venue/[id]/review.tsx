// ─────────────────────────────────────────────
//  Write a Review — Editorial Premium
//
//  Kicker + Display title, large rating stars, then an editorial
//  multi-line input (kicker label above). Sticky primary CTA.
// ─────────────────────────────────────────────
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  Body,
  Button,
  Caption,
  Display,
  FadeIn,
  Hairline,
  Kicker,
  Pressy,
} from '@/components/ui';
import { Colors, EditorialSpacing, Radius, Spacing, TypePresets } from '@/constants/tokens';
import { HitSlop, Roles } from '@/constants/a11y';
import { reviewsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { useFeedback } from '@/hooks/useFeedback';

const STAR_LABEL_ES = ['', 'Mala', 'Regular', 'Buena', 'Excelente', 'Sublime'];
const STAR_LABEL_EN = ['', 'Poor', 'Fair', 'Good', 'Great', 'Sublime'];

export default function WriteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const insets = useSafeAreaInsets();
  const fb = useFeedback();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert(
        t ? 'Error' : 'Error',
        t ? 'Selecciona una calificación' : 'Please select a rating',
      );
      return;
    }
    setLoading(true);
    try {
      await reviewsApi.create({
        venueId: id,
        rating,
        comment: comment.trim() || undefined,
      });
      fb.success();
      router.back();
    } catch (err: any) {
      fb.error();
      Alert.alert(
        t ? 'Error' : 'Error',
        err.response?.data?.message ?? (t ? 'No se pudo enviar' : 'Could not submit'),
      );
    } finally {
      setLoading(false);
    }
  }

  const starLabels = t ? STAR_LABEL_ES : STAR_LABEL_EN;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerRow}>
          <Pressy
            onPress={() => router.back()}
            accessibilityRole={Roles.button}
            accessibilityLabel={t ? 'Volver' : 'Back'}
            hitSlop={HitSlop.expand}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressy>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Kicker tone="champagne">{t ? 'TU EXPERIENCIA' : 'YOUR EXPERIENCE'}</Kicker>
          </FadeIn>
          <FadeIn delay={80} style={{ marginTop: Spacing[3] }}>
            <Display size="md">{t ? 'Escribe una reseña.' : 'Write a review.'}</Display>
          </FadeIn>
          <FadeIn delay={160} style={{ marginTop: Spacing[3] }}>
            <Body tone="secondary" size="lg">
              {t
                ? 'Tu opinión ayuda a otros miembros a elegir.'
                : 'Your review helps other members decide.'}
            </Body>
          </FadeIn>

          {/* Rating ─────────────────────── */}
          <FadeIn delay={240} style={styles.section}>
            <Kicker tone="muted">{t ? 'CALIFICACIÓN' : 'RATING'}</Kicker>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressy
                  key={star}
                  onPress={() => setRating(star)}
                  accessibilityRole={Roles.button}
                  accessibilityLabel={`${star}`}
                  accessibilityState={{ selected: star <= rating }}
                  hitSlop={HitSlop.expand}
                  haptic="select"
                  style={styles.starBtn}
                >
                  <Feather
                    name="star"
                    size={38}
                    color={star <= rating ? Colors.accentPrimary : Colors.borderStrong}
                    style={star <= rating ? styles.starActive : undefined}
                  />
                </Pressy>
              ))}
            </View>
            {rating > 0 ? (
              <Caption tone="champagne" style={{ marginTop: Spacing[3] }}>
                {starLabels[rating]}
              </Caption>
            ) : null}
          </FadeIn>

          <Hairline variant="subtle" style={{ marginTop: Spacing[6] }} />

          {/* Comment ────────────────────── */}
          <FadeIn delay={320} style={styles.section}>
            <Kicker tone="muted">
              {t ? 'COMENTARIO (OPCIONAL)' : 'COMMENT (OPTIONAL)'}
            </Kicker>
            <View style={styles.textareaBox}>
              <TextInput
                style={styles.textarea}
                placeholder={t ? 'Comparte tu experiencia…' : 'Share your experience…'}
                placeholderTextColor={Colors.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
                accessibilityLabel={t ? 'Comentario' : 'Comment'}
                textAlignVertical="top"
              />
            </View>
            <Caption tone="muted" align="right" style={{ marginTop: Spacing[2] }}>
              {`${comment.length}/500`}
            </Caption>
          </FadeIn>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Spacing[4] + insets.bottom }]}>
          <Hairline variant="subtle" />
          <View style={styles.footerInner}>
            <Button
              label={t ? 'Enviar reseña' : 'Submit review'}
              onPress={handleSubmit}
              loading={loading}
              disabled={rating === 0}
              variant="primary"
              size="lg"
              fullWidth
              haptic="success"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  headerRow: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[2],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing[2],
  },

  scroll: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[6],
    paddingBottom: 140,
  },

  section: { marginTop: Spacing[8] },

  stars: {
    marginTop: Spacing[4],
    flexDirection: 'row',
    gap: Spacing[3],
  },
  starBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starActive: {},

  textareaBox: {
    marginTop: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    padding: Spacing[4],
    minHeight: 140,
  },
  textarea: {
    flex: 1,
    color: Colors.textPrimary,
    ...TypePresets.body,
    padding: 0,
    minHeight: 110,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgPrimary,
  },
  footerInner: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingTop: Spacing[4],
  },
});
