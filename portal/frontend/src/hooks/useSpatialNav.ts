import { useEffect, useCallback, useState } from 'react';
import { findNextFocusable, FocusableRect, Direction } from '../engine/SpatialEngine';

interface UseSpatialNavOptions {
  containerId: string;
  enabled?: boolean;
  onSelect?: (id: string) => void;
  onBack?: () => void;
  initialFocusId?: string;
}

export function useSpatialNav({
  containerId,
  enabled = true,
  onSelect,
  onBack,
  initialFocusId,
}: UseSpatialNavOptions) {
  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId ?? null);

  // Collect all focusable rects within the container
  const getFocusables = useCallback((): FocusableRect[] => {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const elements = container.querySelectorAll('[data-focusable]');
    return Array.from(elements).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-focusable')!,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      };
    });
  }, [containerId]);

  // Set initial focus
  useEffect(() => {
    if (!enabled) return;
    const focusables = getFocusables();
    if (focusables.length > 0) {
      const exists = focusables.some(f => f.id === focusedId);
      if (!exists) {
        setFocusedId(initialFocusId ?? focusables[0].id);
      }
    } else {
      setFocusedId(null);
    }
  }, [enabled, containerId, initialFocusId, getFocusables, focusedId]);

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
      if (direction) {
        e.preventDefault();
        const focusables = getFocusables();
        const current = focusables.find((f) => f.id === focusedId);
        if (!current) {
          // Fallback: focus first element
          if (focusables.length > 0) setFocusedId(focusables[0].id);
          return;
        }
        const nextId = findNextFocusable(current, focusables, direction);
        if (nextId) {
          setFocusedId(nextId);
          // Scroll into view
          const nextEl = document.querySelector(`[data-focusable="${nextId}"]`);
          nextEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      if (e.key === 'Enter' || e.key === ' ') {
        // Trigger onSelect if input elements are not focused
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          e.preventDefault();
          if (focusedId && onSelect) {
            onSelect(focusedId);
          }
        }
      }

      if (e.key === 'Escape') {
        if (onBack) onBack();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, focusedId, getFocusables, onSelect, onBack]);

  return { focusedId, setFocusedId };
}
