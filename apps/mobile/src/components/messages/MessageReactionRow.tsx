// ─────────────────────────────────────────────
//  MessageReactionRow — the inline reaction picker that appears at the top
//  of the long-press action sheet.
//
//  Renders the canonical 6 emojis (from REACTION_EMOJIS) as a horizontal
//  row with role=menu so screen readers traverse it as a menu of options.
// ─────────────────────────────────────────────
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Body, Pressy, REACTION_EMOJIS } from '@/components/ui';
import { Roles } from '@/constants/a11y';

interface Props {
  onSelect: (emoji: string) => void;
}

export function MessageReactionRow({ onSelect }: Props) {
  return (
    <View accessibilityRole={Roles.menu} style={styles.row}>
      {REACTION_EMOJIS.map((emoji) => (
        <Pressy
          key={emoji}
          onPress={() => onSelect(emoji)}
          haptic="tap"
          accessibilityRole={Roles.menuitem}
          accessibilityLabel={`Reaccionar con ${emoji}`}
          style={styles.cell}
        >
          <Body style={styles.emoji} allowFontScaling={false}>{emoji}</Body>
        </Pressy>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[1],
    marginBottom: Spacing[3],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 30,
    lineHeight: 34,
  },
});
