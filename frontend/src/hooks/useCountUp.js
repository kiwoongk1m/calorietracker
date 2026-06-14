// Animate a number from its current displayed value up to `target` with an
// easeOutCubic curve. Counts up from 0 on first mount, then animates between
// values on change (e.g. when grams change the calorie figure). Honors
// prefers-reduced-motion by snapping straight to the final value.

import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useCountUp(target, { duration = 600, decimals = 0 } = {}) {
  const to = Number(target) || 0;
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));

  // Track the latest rendered value so a mid-flight target change animates from
  // where the number visually is, not from a stale starting point.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const from = valueRef.current;
    if (from === to) return;

    const factor = Math.pow(10, decimals);
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * ease(t);
      setValue(Math.round(v * factor) / factor);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, decimals]);

  return value;
}
