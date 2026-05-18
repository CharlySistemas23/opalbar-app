// ─────────────────────────────────────────────
//  EmptyState — Editorial Premium
//
//  Calmer than the previous version: NO floating icon, NO pulsing ring.
//  Editorial empty states sit quietly:
//   · a hairline-outlined circle frame with the icon at low contrast
//   · serif Heading title, body subtitle
//   · optional CTA button (Button primitive)
//   · whole block fades in once via FadeIn (no infinite motion)
// ─────────────────────────────────────────────
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { Body, Heading } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Color of the icon glyph. Defaults to textMuted. */
  tint?: string;
  /** Replace the default circle frame with no frame (just the icon). */
  bareIcon?: boolean;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tint = Colors.textMuted,
  bareIcon = false,
  testID,
}: Props) {
  return (
    <View style={styles.root} testID={testID}>
      <FadeIn>
        <View style={styles.iconWrap}>
          {!bareIcon ? <View style={styles.iconFrame} /> : null}
          <Feather name={icon} size={28} color={tint} />
        </View>
      </FadeIn>
      <FadeIn delay={70}>
        <Heading size="sm" align="center" style={styles.title}>
          {title}
        </Heading>
      </FadeIn>
      {message ? (
        <FadeIn delay={140}>
          <Body align="center" tone="secondary" style={styles.msg}>
            {message}
          </Body>
        </FadeIn>
      ) : null}
      {actionLabel && onAction ? (
        <FadeIn delay={210} style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="primary" size="md" fullWidth={false} />
        </FadeIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: EditorialSpacing.heroPadding,
    gap: Spacing[3],
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  iconFrame: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  title: {
    marginTop: Spacing[1],
  },
  msg: {
    maxWidth: 280,
  },
  action: {
    marginTop: Spacing[3],
  },
});
