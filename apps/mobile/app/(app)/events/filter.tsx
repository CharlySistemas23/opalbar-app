import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing, Radius } from '@/constants/tokens';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EventFilter() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [
    { id: 'live_music', label: t ? '🎵 Música en vivo' : '🎵 Live music' },
    { id: 'dj', label: '🎧 DJ' },
    { id: 'art', label: t ? '🎨 Arte' : '🎨 Art' },
    { id: 'food', label: t ? '🍴 Gastronomía' : '🍴 Food' },
  ];

  const days = t ? DAYS : DAYS_EN;

  function toggleDay(i: number) {
    setSelectedDays((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t ? 'Filtrar eventos' : 'Filter events'}</Text>
        <TouchableOpacity onPress={() => { setSelectedDays([]); setSelectedCategory(''); }}>
          <Text style={styles.clear}>{t ? 'Limpiar' : 'Clear'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t ? 'Día de la semana' : 'Day of week'}</Text>
        <View style={styles.daysRow}>
          {days.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, selectedDays.includes(i) && styles.dayChipActive]}
              onPress={() => toggleDay(i)}
            >
              <Text style={[styles.dayText, selectedDays.includes(i) && styles.dayTextActive]}>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t ? 'Categoría' : 'Category'}</Text>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catRow, selectedCategory === cat.id && styles.catRowActive]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
          >
            <Text style={styles.catLabel}>{cat.label}</Text>
            {selectedCategory === cat.id && <Feather name="check" size={16} color={Colors.accentPrimary} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t ? 'Aplicar filtros' : 'Apply filters'} onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing[5] },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  clear: { fontSize: Typography.fontSize.sm, color: Colors.accentPrimary },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[4] },
  sectionTitle: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, fontWeight: Typography.fontWeight.semiBold, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing[2] },
  daysRow: { flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap' },
  dayChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: Colors.accentPrimary, borderColor: Colors.accentPrimary },
  dayText: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, fontWeight: Typography.fontWeight.medium },
  dayTextActive: { color: Colors.textInverse },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[4], backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  catRowActive: { borderColor: Colors.accentPrimary },
  catLabel: { fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  check: { fontSize: 16, color: Colors.accentPrimary },
  footer: { padding: Spacing[5] },
});
