import { useState, useCallback, useRef } from 'react';

type TransitionDirection = 'left' | 'right';
type TransitionPhase = 'idle' | 'exiting' | 'entering';

export function useViewTransition(transitionDuration = 300) {
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [direction, setDirection] = useState<TransitionDirection>('right');
  const pendingViewRef = useRef<string | null>(null);

  const startTransition = useCallback(
    (nextView: string, dir: TransitionDirection, applyView: (view: string) => void) => {
      setDirection(dir);
      setPhase('exiting');
      pendingViewRef.current = nextView;

      // After exit animation completes, switch view and enter
      setTimeout(() => {
        applyView(nextView);
        setPhase('entering');

        // After enter animation completes, go idle
        setTimeout(() => {
          setPhase('idle');
        }, transitionDuration);
      }, transitionDuration * 0.7); // Overlap exit/enter slightly
    },
    [transitionDuration]
  );

  // CSS class to apply to the view container
  const transitionClass =
    phase === 'exiting'
      ? direction === 'right' ? 'view-exit-left' : 'view-exit-right'
      : phase === 'entering'
      ? direction === 'right' ? 'view-transition-enter-right' : 'view-transition-enter-left'
      : '';

  return { startTransition, transitionClass, phase };
}
