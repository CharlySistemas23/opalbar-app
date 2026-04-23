import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, tint = Colors.textMuted }: Props) {
  return (
    <View style={styles.root}>
      <View style={[styles.iconBox, { backgroundColor: tint + '15' }]}>
        <Feather name={icon} size={32} color={tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.accentPrimary }]} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.btnLbl}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  iconBox: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  msg: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  btn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
});
