import { describe, test, expect } from 'vitest';
import { findNextFocusable, FocusableRect } from '../engine/SpatialEngine';

describe('Spatial Navigation Engine Tests', () => {
  const current: FocusableRect = {
    id: 'current',
    top: 100,
    left: 100,
    width: 50,
    height: 50,
  };

  test('Finds best focus candidate to the right', () => {
    const candidates: FocusableRect[] = [
      { id: 'right-close', top: 100, left: 200, width: 50, height: 50 },
      { id: 'right-far', top: 100, left: 400, width: 50, height: 50 },
      { id: 'left-close', top: 100, left: 0, width: 50, height: 50 },
    ];

    const nextId = findNextFocusable(current, candidates, 'right');
    expect(nextId).toBe('right-close');
  });

  test('Finds best focus candidate below', () => {
    const candidates: FocusableRect[] = [
      { id: 'below-close', top: 200, left: 100, width: 50, height: 50 },
      { id: 'below-far', top: 400, left: 100, width: 50, height: 50 },
      { id: 'above-close', top: 0, left: 100, width: 50, height: 50 },
    ];

    const nextId = findNextFocusable(current, candidates, 'down');
    expect(nextId).toBe('below-close');
  });

  test('Finds best focus candidate with offset alignment', () => {
    const candidates: FocusableRect[] = [
      { id: 'right-perfect', top: 100, left: 300, width: 50, height: 50 },
      { id: 'right-offset', top: 110, left: 200, width: 50, height: 50 }, // Left-offset is physically closer in terms of pure distance
    ];

    const nextId = findNextFocusable(current, candidates, 'right');
    // 'right-offset' is selected because it is closer along the X axis and misalignment is small
    expect(nextId).toBe('right-offset');
  });

  test('Returns null if no candidate exists in the requested direction', () => {
    const candidates: FocusableRect[] = [
      { id: 'left-close', top: 100, left: 0, width: 50, height: 50 },
    ];

    const nextId = findNextFocusable(current, candidates, 'right');
    expect(nextId).toBeNull();
  });
});
