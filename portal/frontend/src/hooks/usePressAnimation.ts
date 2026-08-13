import { useState, useCallback, useRef } from 'react';

export function usePressAnimation() {
  const [pressing, setPressing] = useState<'idle' | 'down' | 'release'>('idle');
  const timeoutRef = useRef<number | null>(null);

  const triggerPress = useCallback((onComplete?: () => void) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPressing('down');

    // After press-down (100ms), spring back up
    timeoutRef.current = window.setTimeout(() => {
      setPressing('release');

      // After spring-back (300ms), go idle and fire callback
      timeoutRef.current = window.setTimeout(() => {
        setPressing('idle');
        onComplete?.();
      }, 300);
    }, 100);
  }, []);

  return { pressing, triggerPress, dataPressing: pressing === 'idle' ? undefined : pressing };
}
