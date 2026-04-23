import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];
type Variant = 'success' | 'danger' | 'warning' | 'info';

const VARIANT_COLORS: Record<Variant, string> = {
  success: Colors.accentSuccess,
  danger: Colors.accentDanger,
  warning: Colors.accentPrimary,
  info: '#60A5FA',
};

interface Props {
  icon: FeatherIcon;
  variant?: Variant;
  title: string;
  message: string;
  /** Primary CTA */
  primary?: { label: string; onPress: () => void; loading?: boolean };
  /** Secondary CTA (outlined) */
  secondary?: { label: string; onPress: () => void };
  /** Optional hint text below buttons */
  hint?: string;
  onBack?: () => void;
}

export function AuthStatusScreen({
  icon, variant = 'info', title, message,
  primary, secondary, hint, onBack,
}: Props) {
  const color = VARIANT_COLORS[variant];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {onBack && (
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={10}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.body}>
        <View style={[styles.iconOuter, { backgroundColor: color + '15' }]}>
          <View style={[styles.iconInner, { backgroundColor: color + '25' }]}>
            <Feather name={icon} size={48} color={color} />
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {hint && (
          <View style={styles.hintBox}>
            <Feather name="info" size={13} color={Colors.textMuted} />
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {primary && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: color }, primary.loading && { opacity: 0.7 }]}
            onPress={primary.onPress}
            disabled={primary.loading}
            activeOpacity={0.9}
          >
            {primary.loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.primaryLbl}>{primary.label}</Text>}
          </TouchableOpacity>
        )}
        {secondary && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={secondary.onPress} activeOpacity={0.85}>
            <Text style={[styles.secondaryLbl, { color }]}>{secondary.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },

  navBar: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  iconOuter: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconInner: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24, fontWeight: '800',
    textAlign: 'center', lineHeight: 30,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 14, lineHeight: 22,
    textAlign: 'center',
  },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 8,
  },
  hintText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, flex: 1 },

  footer: {
    paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, gap: 10,
  },
  primaryBtn: {
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryLbl: { color: Colors.textInverse, fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryLbl: { fontSize: 14, fontWeight: '700' },
});
