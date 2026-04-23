import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  message: string;
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: FeatherIcon;
}

export function ErrorState({
  message,
  title,
  retryLabel = 'Reintentar',
  onRetry,
  icon = 'alert-circle',
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={32} color={Colors.accentDanger} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.msg}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
          <Feather name="refresh-cw" size={14} color={Colors.textInverse} />
          <Text style={styles.btnLbl}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentDanger + '15',
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  msg: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  btn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.accentPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnLbl: { color: Colors.textInverse, fontSize: 13, fontWeight: '700' },
});
