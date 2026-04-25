import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { Colors, Radius } from '@/constants/tokens';

export default function Welcome() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();
  const { language } = useAppStore();
  const t = language === 'es';
  const [entering, setEntering] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>OPALBAR</Text>
        <Text style={styles.tagline}>
          {t
            ? 'Siempre hay algo pasando,\ny tú te enteras primero.'
            : "Something's always happening,\nand you hear about it first."}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/login' as never)}
          activeOpacity={0.85}
        >
          <Feather name="log-in" size={18} color={Colors.textInverse} />
          <Text style={styles.primaryBtnLabel}>
            {t ? 'Iniciar sesión' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/register' as never)}
          activeOpacity={0.85}
        >
          <Feather name="user-plus" size={18} color={Colors.textPrimary} />
          <Text style={styles.secondaryBtnLabel}>
            {t ? 'Crear cuenta' : 'Create account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => {
            if (entering) return;
            setEntering(true);
            continueAsGuest();
            router.replace('/(guest)/home' as never);
          }}
          activeOpacity={0.7}
          disabled={entering}
        >
          {entering
            ? <ActivityIndicator color={Colors.accentPrimary} size="small" />
            : <Text style={styles.ghostBtnLabel}>
                {t ? 'Continuar como invitado' : 'Continue as guest'}
              </Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logo: {
    width: 128, height: 128, borderRadius: 28,
    marginBottom: 12,
  },
  brand: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    gap: 12,
    paddingBottom: 24,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Radius.button,
  },
  primaryBtnLabel: { color: Colors.textInverse, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.button,
    borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  ghostBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnLabel: {
    color: Colors.accentPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
