import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Reads the OS "Reduce Motion" setting and listens for changes. Animation
// presets short-circuit to instant when this returns true so users who
// asked the system to calm down get an instant interface.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduced(value);
    });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduced(value),
    );

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduced;
}
