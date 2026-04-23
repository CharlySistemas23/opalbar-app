import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { reviewsApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

export default function WriteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'Selecciona una calificación' : 'Please select a rating');
      return;
    }
    setLoading(true);
    try {
      await reviewsApi.create({ venueId: id, rating, comment: comment.trim() || undefined });
      router.back();
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', err.response?.data?.message ?? (t ? 'No se pudo enviar' : 'Could not submit'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Escribir reseña' : 'Write a review'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.ratingLabel}>{t ? 'Calificación' : 'Rating'}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.commentLabel}>{t ? 'Comentario (opcional)' : 'Comment (optional)'}</Text>
        <TextInput
          style={styles.textarea}
          placeholder={t ? 'Comparte tu experiencia...' : 'Share your experience...'}
          placeholderTextColor={Colors.textDisabled}
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>
      </View>

      <View style={styles.footer}>
        <Button label={t ? 'Enviar reseña' : 'Submit review'} onPress={handleSubmit} loading={loading} disabled={rating === 0} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { flex: 1, paddingHorizontal: Spacing[5], gap: Spacing[3] },
  ratingLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  stars: { flexDirection: 'row', gap: Spacing[2] },
  star: { fontSize: 36, color: Colors.border },
  starActive: { color: '#F59E0B' },
  commentLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing[2] },
  textarea: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing[4], color: Colors.textPrimary, fontSize: Typography.fontSize.base, height: 140, textAlignVertical: 'top' },
  charCount: { alignSelf: 'flex-end', fontSize: Typography.fontSize.xs, color: Colors.textDisabled },
  footer: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderTopWidth: 1, borderTopColor: Colors.border },
});
