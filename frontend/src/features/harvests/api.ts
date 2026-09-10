import { request } from '../../lib/httpClient';
import type { Crop, DeletionReport } from '../producers/types';
import type { Harvest } from './types';

/** Operations 19–23, plus operation 17 (crops by season). */

export function listHarvests(): Promise<Harvest[]> {
  return request<Harvest[]>({ method: 'GET', path: '/harvests' });
}

export function fetchHarvest(id: string): Promise<Harvest> {
  return request<Harvest>({ method: 'GET', path: `/harvests/${id}` });
}

export function createHarvest(year: number): Promise<Harvest> {
  return request<Harvest>({ method: 'POST', path: '/harvests', body: { year } });
}

export function updateHarvest(id: string, year: number): Promise<Harvest> {
  return request<Harvest>({ method: 'PATCH', path: `/harvests/${id}`, body: { year } });
}

/**
 * Refused with 409 while any crop references the season. That refusal is designed, not a
 * failure: a season is shared, so cascading would erase plantings across every farm in the
 * registry at once (FR-041).
 */
export function deleteHarvest(id: string): Promise<DeletionReport> {
  return request<DeletionReport>({ method: 'DELETE', path: `/harvests/${id}` });
}

/** Each item carries `propertyId`, so a planting identifies its farm without a second lookup. */
export function listCropsByHarvest(harvestId: string): Promise<Crop[]> {
  return request<Crop[]>({ method: 'GET', path: `/harvests/${harvestId}/crops` });
}
