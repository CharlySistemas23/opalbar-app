import { Motion } from '../constants/motion';
import { useFadeRise } from './useFadeRise';

// Compute the stagger delay for an item at `index` within a list. Caps at
// `staggerMax` so deep lists don't make later items wait absurdly long.
export function staggerDelay(index: number): number {
  const capped = Math.min(index, Motion.staggerMax);
  return capped * Motion.staggerStep;
}

// Convenience hook: returns a Reanimated style with fadeRise animated,
// delayed by the staggered offset for this index.
export function useStaggerItem(index: number) {
  return useFadeRise({ delay: staggerDelay(index) });
}
