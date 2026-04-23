import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

interface Props {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Heart({ size = 24, color, filled = false, style }: Props) {
  return (
    <Ionicons
      name={filled ? 'heart' : 'heart-outline'}
      size={size}
      color={color}
      style={style}
    />
  );
}
