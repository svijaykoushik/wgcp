import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusables.length === 0) return;

    // Focus first element
    focusables[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = Array.from(focusables).indexOf(
          document.activeElement as HTMLElement
        );
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + focusables.length) % focusables.length
          : (currentIndex + 1) % focusables.length;
        focusables[nextIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}
