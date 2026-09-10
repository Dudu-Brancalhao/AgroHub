/** Mirrors `HarvestResponseDto` (contracts/api-client.md operations 19–23). */

export type Harvest = {
  id: string;
  year: number;
  createdAt: string;
  updatedAt: string;
};

export const MIN_HARVEST_YEAR = 1900;

/**
 * Computed at call time, never hard-coded, so it tracks the server's `isPlausibleHarvestYear`
 * across a year boundary (data-model.md → Harvest).
 */
export function maxHarvestYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}
