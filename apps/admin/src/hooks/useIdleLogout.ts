import { useEffect, useRef, useState } from 'react';

const IDLE_MS = 5 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];

export function useIdleLogout(active: boolean, onLogout: () => void) {
  const [warning, setWarning] = useState<{ secondsLeft: number } | null>(null);
  const lastActivity = useRef(Date.now());
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setWarning(null);
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    // Reset es throttled: actualizamos el ref en CADA evento (barato, no
    // dispara re-render) pero solo tocamos React state cuando realmente
    // pasó algo. mousemove dispara 60+ veces por segundo y antes esto
    // generaba 60+ re-renders del Layout, arrastrando todas las pantallas
    // con caída de FPS visible.
    const reset = () => {
      lastActivity.current = Date.now();
      // setState con bailout: solo dispara re-render si el valor cambia.
      setWarning((prev) => (prev === null ? prev : null));
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    tickRef.current = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const remainingMs = IDLE_MS - idleMs;
      if (remainingMs <= 0) {
        if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
        setWarning(null);
        onLogout();
      } else if (remainingMs <= WARN_BEFORE_MS) {
        setWarning({ secondsLeft: Math.ceil(remainingMs / 1000) });
      } else {
        setWarning(null);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [active, onLogout]);

  const stayActive = () => { lastActivity.current = Date.now(); setWarning(null); };

  return { warning, stayActive };
}
