// ─────────────────────────────────────────────
//  UI primitives barrel — Editorial Premium
//
//  ALWAYS import from '@/components/ui' in app screens.
//  Keeps the design system consolidated and refactors painless.
// ─────────────────────────────────────────────

// Layout & surfaces
export { Card } from './Card';
export { ScreenLayout } from './ScreenLayout';
export { Hairline } from './Hairline';

// Interactions
export { Button } from './Button';
export { Pressy } from './Pressy';
export { LikeButton } from './LikeButton';
export { ReactionPicker, REACTION_EMOJIS } from './ReactionPicker';
export type { ReactionEmoji } from './ReactionPicker';

// Overlays
export { Modal } from './Modal';
export { Sheet } from './Sheet';
export { ConfirmDialog } from './ConfirmDialog';

// Lists & navigation
export { ListItem } from './ListItem';
export { SegmentedControl, Tabs } from './SegmentedControl';
export type { SegmentOption } from './SegmentedControl';

// Feedback / state
export { Skeleton, SkeletonList, SkeletonText } from './Skeleton';
export { FadeIn } from './FadeIn';
export { Confetti } from './Confetti';

// Data display
export { Badge } from './Badge';

// Forms
export { Input } from './Input';
export type { InputProps } from './Input';

// Typography — use these instead of <Text>
export {
  Hero,
  Display,
  Heading,
  Lead,
  Subhead,
  Body,
  Caption,
  Kicker,
  Label,
  Numeric,
} from './Typography';
