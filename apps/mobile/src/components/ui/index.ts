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

// Feedback / state
export { Skeleton, SkeletonList } from './Skeleton';
export { FadeIn } from './FadeIn';

// Data display
export { Badge } from './Badge';

// Forms
export { Input } from './Input';

// Typography — use these instead of <Text>
export { Display, Heading, Subhead, Body, Caption, Label } from './Typography';
