import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Colors, Typography, Spacing } from '@/constants/tokens';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>404</Text>
      <Text style={styles.subtitle}>Pantalla no encontrada</Text>
      <Link href="/(tabs)/home" style={styles.link}>Ir al inicio</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  title: { fontSize: Typography.fontSize['5xl'], fontWeight: Typography.fontWeight.bold, color: Colors.accentPrimary },
  subtitle: { fontSize: Typography.fontSize.md, color: Colors.textSecondary },
  link: { fontSize: Typography.fontSize.base, color: Colors.accentPrimary, marginTop: Spacing[2] },
});
