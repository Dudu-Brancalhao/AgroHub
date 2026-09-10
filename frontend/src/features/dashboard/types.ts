import type { Centiares } from '../../lib/area';

/** Mirrors `DashboardSummaryDto` (contracts/api-client.md operation 4). */

export type BreakdownUnit = 'hectares' | 'count';

/** As it arrives: `value` is a decimal string for hectares, a number for counts. */
export type RawCategory = { key: string; label: string; value: string | number };
export type RawBreakdown = { unit: BreakdownUnit; categories: RawCategory[] };

export type RawDashboardSummary = {
  totals: { farms: number; hectares: string };
  byState: RawBreakdown;
  byCrop: RawBreakdown;
  byLandUse: RawBreakdown;
};

/**
 * As it is held: hectare values parsed to integers at the boundary, so the land-use categories
 * sum to the total exactly (SC-007) and no rounding is introduced by display (FR-020).
 */
export type Category = { key: string; label: string; value: number };
export type Breakdown = { unit: BreakdownUnit; categories: Category[] };

export type RegistrySummary = {
  totals: { farms: number; hectares: Centiares };
  byState: Breakdown;
  byCrop: Breakdown;
  byLandUse: Breakdown;
};

export type BreakdownKind = 'byState' | 'byCrop' | 'byLandUse';
