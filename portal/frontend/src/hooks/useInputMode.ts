import { useState, useEffect } from 'react';

export type InputMode = 'keyboard' | 'gamepad' | 'touch';

export function useInputMode(): InputMode {
  const [mode, setMode] = useState<InputMode>('keyboard');

  useEffect(() => {
    const onKeyDown = () => setMode('keyboard');
    const onGamepadConnected = () => setMode('gamepad');
    const onTouchStart = () => setMode('touch');
    const onMouseMove = () => {
      if (mode === 'touch') return;
      setMode('keyboard');
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [mode]);

  return mode;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
