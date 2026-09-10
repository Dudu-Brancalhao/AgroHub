import { request } from '../../lib/httpClient';
import { toApiNumber } from '../../lib/area';
import { toProperty } from '../producers/api';
import type {
  Crop,
  CropInput,
  DeletionReport,
  PropertyDetail,
  PropertyInput,
} from '../producers/types';

/**
 * Operations 10–18 (contracts/api-client.md).
 *
 * Areas travel out as JSON numbers and come back as strings — that asymmetry is the backend's
 * contract, not an accident: `CreatePropertyDto` declares them as `type: Number` while
 * `PropertyResponseDto` maps them through `decimalToString`. The integer is divided by 100 only
 * here, at serialisation, where a two-decimal value round-trips through JSON exactly.
 */
function toRequestBody(input: Partial<PropertyInput>) {
  return {
    ...(input.farmName !== undefined && { farmName: input.farmName }),
    ...(input.city !== undefined && { city: input.city }),
    // Sent uppercase: the server uppercases too, but sending the canonical value keeps what the
    // client shows and what the server stored identical.
    ...(input.state !== undefined && { state: input.state.toUpperCase() }),
    ...(input.totalArea !== undefined && { totalArea: toApiNumber(input.totalArea) }),
    ...(input.arableArea !== undefined && { arableArea: toApiNumber(input.arableArea) }),
    ...(input.vegetationArea !== undefined && {
      vegetationArea: toApiNumber(input.vegetationArea),
    }),
  };
}

type RawProperty = Parameters<typeof toProperty>[0];

export async function createProperty(
  producerId: string,
  input: PropertyInput,
): Promise<PropertyDetail> {
  const raw = await request<RawProperty>({
    method: 'POST',
    path: `/producers/${producerId}/properties`,
    body: toRequestBody(input),
  });
  return toProperty(raw);
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyInput>,
): Promise<PropertyDetail> {
  const raw = await request<RawProperty>({
    method: 'PATCH',
    path: `/properties/${id}`,
    body: toRequestBody(input),
  });
  return toProperty(raw);
}

export function deleteProperty(id: string): Promise<DeletionReport> {
  return request<DeletionReport>({ method: 'DELETE', path: `/properties/${id}` });
}

/** Operations 10 and 11 — direct-link and refresh paths; the detail screen uses operation 6. */
export async function listPropertiesByProducer(producerId: string): Promise<PropertyDetail[]> {
  const raw = await request<RawProperty[]>({
    method: 'GET',
    path: `/producers/${producerId}/properties`,
  });
  return raw.map(toProperty);
}

export async function fetchProperty(id: string): Promise<PropertyDetail> {
  return toProperty(await request<RawProperty>({ method: 'GET', path: `/properties/${id}` }));
}

/** Crops — operations 15, 16 and 18. */

export function createCrop(propertyId: string, input: CropInput): Promise<Crop> {
  return request<Crop>({ method: 'POST', path: `/properties/${propertyId}/crops`, body: input });
}

export function listCropsByProperty(propertyId: string): Promise<Crop[]> {
  return request<Crop[]>({ method: 'GET', path: `/properties/${propertyId}/crops` });
}

export function deleteCrop(id: string): Promise<DeletionReport> {
  return request<DeletionReport>({ method: 'DELETE', path: `/crops/${id}` });
}
