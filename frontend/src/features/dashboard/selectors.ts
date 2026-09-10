import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import type { BreakdownKind, BreakdownUnit, Category } from './types';

export const selectSummary = (state: RootState) => state.dashboard.summary;
export const selectSummaryRequest = (state: RootState) => state.dashboard.request;
export const selectSummaryIsStale = (state: RootState) => state.dashboard.stale;

/** Past this, slices are too thin to read and the palette runs out of safe hues. */
export const MAX_SLICES = 6;

export type Slice = Category & {
  /** Share of the whole, 0–100. A pie answers "how much of the total", not "versus the biggest". */
  share: number;
  /** True for the folded remainder, which is drawn in a neutral rather than a categorical hue. */
  isOther: boolean;
};

export type PieBreakdown = {
  unit: BreakdownUnit;
  slices: Slice[];
  total: number;
};

/**
 * Turns a breakdown into pie slices.
 *
 * Two rules do the work. Slices are ordered largest first, so the eye reads them in the order
 * they matter. And anything past the sixth is folded into a single "Outras" rather than given a
 * seventh colour — a generated hue would break the validated palette, and thin slices are
 * unreadable regardless of what colour they are.
 */
function toSlices(categories: Category[]): { slices: Slice[]; total: number } {
  const total = categories.reduce((sum, category) => sum + category.value, 0);
  if (total === 0) return { slices: [], total: 0 };

  const ordered = [...categories].sort((a, b) => b.value - a.value);
  const head = ordered.slice(0, MAX_SLICES);
  const tail = ordered.slice(MAX_SLICES);

  const kept: Category[] =
    tail.length === 0
      ? head
      : [
          ...head,
          {
            key: '__other__',
            label: `Outras (${tail.length})`,
            value: tail.reduce((sum, category) => sum + category.value, 0),
          },
        ];

  return {
    total,
    slices: kept.map((category) => ({
      ...category,
      share: (category.value / total) * 100,
      isOther: category.key === '__other__',
    })),
  };
}

export const selectBreakdown = createSelector(
  [selectSummary, (_state: RootState, kind: BreakdownKind) => kind],
  (summary, kind): PieBreakdown | null => {
    if (!summary) return null;

    const breakdown = summary[kind];
    const { slices, total } = toSlices(breakdown.categories);

    return { unit: breakdown.unit, slices, total };
  },
);

/**
 * SC-007: the land-use categories must add up to the registry total exactly. Both sides are
 * integers, so this is a true equality rather than a tolerance.
 */
export const selectLandUseTotal = createSelector([selectSummary], (summary) =>
  summary ? summary.byLandUse.categories.reduce((total, c) => total + c.value, 0) : 0,
);
