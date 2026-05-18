// ─────────────────────────────────────────────
//  ErrorState — Editorial Premium
//
//  Same calm shape as <EmptyState> but with danger-tinted icon and an
//  explicit retry CTA. Never auto-retries.
// ─────────────────────────────────────────────
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, EditorialSpacing, Radius, Spacing } from '@/constants/tokens';
import { Body, Heading } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Props {
  message: string;
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: FeatherIcon;
  testID?: string;
}

export function ErrorState({
  message,
  title = 'Algo no salió bien',
  retryLabel = 'Reintentar',
  onRetry,
  icon = 'alert-circle',
  testID,
}: Props) {
  return (
    <View style={styles.root} testID={testID} accessibilityLiveRegion="polite">
      <FadeIn>
        <View style={styles.iconWrap}>
          <View style={styles.iconFrame} />
          <Feather name={icon} size={28} color={Colors.accentDanger} />
        </View>
      </FadeIn>
      <FadeIn delay={70}>
        <Heading size="sm" align="center" tone="primary" style={styles.title}>
          {title}
        </Heading>
      </FadeIn>
      <FadeIn delay={140}>
        <Body align="center" tone="secondary" style={styles.msg}>
          {message}
        </Body>
      </FadeIn>
      {onRetry ? (
        <FadeIn delay={210} style={styles.action}>
          <Button
            label={retryLabel}
            onPress={onRetry}
            variant="primary"
            size="md"
            fullWidth={false}
            leftIcon={<Feather name="refresh-cw" size={14} color={Colors.textInverse} />}
          />
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
    borderColor: 'rgba(217,106,106,0.30)',
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
