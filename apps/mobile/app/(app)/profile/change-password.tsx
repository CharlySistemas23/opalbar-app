import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api/client';
import { useAppStore } from '@/stores/app.store';
import { Colors, Typography, Spacing } from '@/constants/tokens';

export default function ChangePassword() {
  const router = useRouter();
  const { language } = useAppStore();
  const t = language === 'es';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChange() {
    if (next !== confirm) {
      Alert.alert(t ? 'Error' : 'Error', t ? 'Las contraseñas no coinciden' : 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      Alert.alert(t ? 'Éxito' : 'Success', t ? 'Contraseña actualizada' : 'Password updated', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert(t ? 'Error' : 'Error', err.response?.data?.message ?? (t ? 'No se pudo cambiar' : 'Could not change password'));
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
        <Text style={styles.title}>{t ? 'Contraseña' : 'Password'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Input label={t ? 'Contraseña actual' : 'Current password'} value={current} onChangeText={setCurrent} secureTextEntry />
        <Input label={t ? 'Nueva contraseña' : 'New password'} value={next} onChangeText={setNext} secureTextEntry />
        <Input label={t ? 'Confirmar contraseña' : 'Confirm password'} value={confirm} onChangeText={setConfirm} secureTextEntry />
      </View>

      <View style={styles.footer}>
        <Button label={t ? 'Cambiar contraseña' : 'Change password'} onPress={handleChange} loading={loading} disabled={!current || !next || !confirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  content: { flex: 1, paddingHorizontal: Spacing[5], gap: Spacing[4], paddingTop: Spacing[2] },
  footer: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderTopWidth: 1, borderTopColor: Colors.border },
});
