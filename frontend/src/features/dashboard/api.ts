import { request } from '../../lib/httpClient';
import { parseArea } from '../../lib/area';
import type {
  Breakdown,
  RawBreakdown,
  RawDashboardSummary,
  RegistrySummary,
} from './types';

/**
 * Operation 4 (contracts/api-client.md).
 *
 * The decimal-string-to-integer conversion happens here, at the edge where a DTO becomes a
 * client model — not in the reducer and not in a component.
 */
function toBreakdown(raw: RawBreakdown): Breakdown {
  return {
    unit: raw.unit,
    categories: raw.categories.map((category) => ({
      key: category.key,
      label: category.label,
      // Branch on `unit`, never on the runtime type: a count of 0 and the string "0" would
      // otherwise be indistinguishable in a way that silently changes the maths.
      value:
        raw.unit === 'hectares'
          ? (parseArea(String(category.value)) ?? 0)
          : Number(category.value),
    })),
  };
}

export async function fetchSummary(): Promise<RegistrySummary> {
  const raw = await request<RawDashboardSummary>({ method: 'GET', path: '/dashboard' });

  return {
    totals: {
      farms: raw.totals.farms,
      hectares: parseArea(raw.totals.hectares) ?? 0,
    },
    byState: toBreakdown(raw.byState),
    byCrop: toBreakdown(raw.byCrop),
    byLandUse: toBreakdown(raw.byLandUse),
  };
}
