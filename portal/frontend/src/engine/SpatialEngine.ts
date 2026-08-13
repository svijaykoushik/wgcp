export interface FocusableRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Given a currently focused rect and a set of candidate rects,
 * return the ID of the best candidate in the given direction.
 * Returns null if no valid candidate exists.
 */
export function findNextFocusable(
  current: FocusableRect,
  candidates: FocusableRect[],
  direction: Direction
): string | null {
  const cx = current.left + current.width / 2;
  const cy = current.top + current.height / 2;

  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (candidate.id === current.id) continue;

    const tx = candidate.left + candidate.width / 2;
    const ty = candidate.top + candidate.height / 2;

    // Filter: candidate must be in the correct direction
    const isValid =
      (direction === 'right' && tx > cx) ||
      (direction === 'left' && tx < cx) ||
      (direction === 'down' && ty > cy) ||
      (direction === 'up' && ty < cy);

    if (!isValid) continue;

    // Score: primary-axis distance + weighted cross-axis distance
    const PRIMARY_WEIGHT = 1;
    const CROSS_WEIGHT = 3; // penalize misalignment heavily

    let primary: number, cross: number;
    if (direction === 'left' || direction === 'right') {
      primary = Math.abs(tx - cx);
      cross = Math.abs(ty - cy);
    } else {
      primary = Math.abs(ty - cy);
      cross = Math.abs(tx - cx);
    }

    const score = PRIMARY_WEIGHT * primary + CROSS_WEIGHT * cross;
    if (score < bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  return bestId;
}
