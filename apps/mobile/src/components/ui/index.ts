// ─────────────────────────────────────────────
//  UI primitives barrel
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

// Feedback / state
export { Skeleton, SkeletonList } from './Skeleton';
export { FadeIn } from './FadeIn';
export { Confetti } from './Confetti';

// Data display
export { Badge } from './Badge';

// Forms
export { Input } from './Input';

// Typography — use these instead of <Text>
export { Display, Heading, Subhead, Body, Caption, Label } from './Typography';
