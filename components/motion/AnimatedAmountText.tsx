import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui';

type Props = Omit<React.ComponentProps<typeof AppText>, 'children'> & {
  value: number;
  format: (n: number) => string;
  /** When this changes the value is shown immediately instead of rolling (e.g. switching month or mode). */
  resetKey?: string;
  duration?: number;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Shows an amount that rolls to its new value when it changes (e.g. after adding an expense).
 * Never rolls on first render or when `resetKey` changes, and never when Reduce Motion is on.
 */
export function AnimatedAmountText({ value, format, resetKey, duration = 500, style, ...rest }: Props) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const keyRef = useRef(resetKey);
  const reduceMotion = useRef(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const keyChanged = keyRef.current !== resetKey;
    keyRef.current = resetKey;
    const from = shownRef.current;
    // Tiny changes and context switches are shown as-is; only a real change in the same context rolls.
    if (keyChanged || reduceMotion.current || Math.abs(value - from) < 1) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = t >= 1 ? value : from + (value - from) * easeOutCubic(t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, resetKey, duration]);

  return (
    <AppText {...rest} style={{ ...StyleSheet.flatten(style), fontVariant: ['tabular-nums'] }}>
      {/* Exact value when settled (keeps decimals as before); whole numbers only while rolling */}
      {format(shown === value ? value : Math.round(shown))}
    </AppText>
  );
}
