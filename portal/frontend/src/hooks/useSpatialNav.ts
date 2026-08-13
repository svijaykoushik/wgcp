import { useEffect, useCallback } from 'react';
import { findNextFocusable, FocusableRect, Direction } from '../engine/SpatialEngine';

interface UseSpatialNavOptions {
  enabled?: boolean;
}

export function useSpatialNav({ enabled = true }: UseSpatialNavOptions = {}) {
  const getFocusables = useCallback((): FocusableRect[] => {
    const elements = document.querySelectorAll('[data-focusable]');
    return Array.from(elements)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        // Ensure element is visible and not disabled
        const isVisible = rect.width > 0 && rect.height > 0;
        const isDisabled = el.hasAttribute('disabled');
        return isVisible && !isDisabled;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-focusable')!,
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        };
      });
  }, []);

  // Arrow key handler
  useEffect(() => {
    if (!enabled) return;

    const handleKey = (e: KeyboardEvent) => {
      const dirMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      const direction = dirMap[e.key];
      if (!direction) return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      e.preventDefault();

      // Find current focused element in our focusables list
      const activeEl = document.activeElement;
      const currentId = activeEl?.getAttribute('data-focusable');
      const current = focusables.find((f) => f.id === currentId);

      if (!current) {
        // Fallback: focus first element with data-focusable
        const firstEl = document.querySelector(`[data-focusable="${focusables[0].id}"]`) as HTMLElement;
        firstEl?.focus();
        return;
      }

      const nextId = findNextFocusable(current, focusables, direction);
      if (nextId) {
        const nextEl = document.querySelector(`[data-focusable="${nextId}"]`) as HTMLElement;
        if (nextEl) {
          nextEl.focus();
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, getFocusables]);
}
