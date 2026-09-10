import { request } from '../../lib/httpClient';
import { parseArea } from '../../lib/area';
import type {
  DeletionReport,
  PagedProducers,
  Producer,
  ProducerDetail,
  ProducerInput,
  PropertyDetail,
} from './types';

/** Operations 5–9 (contracts/api-client.md). */

type RawProperty = Omit<PropertyDetail, 'totalArea' | 'arableArea' | 'vegetationArea'> & {
  totalArea: string;
  arableArea: string;
  vegetationArea: string;
};

type RawProducerDetail = Omit<ProducerDetail, 'properties'> & { properties: RawProperty[] };

/** Decimal strings become integers here, at the boundary — never in a reducer or a component. */
export function toProperty(raw: RawProperty): PropertyDetail {
  return {
    ...raw,
    totalArea: parseArea(raw.totalArea) ?? 0,
    arableArea: parseArea(raw.arableArea) ?? 0,
    vegetationArea: parseArea(raw.vegetationArea) ?? 0,
    harvests: raw.harvests ?? [],
  };
}

export type ListParams = { page: number; pageSize: number; search: string };

export function listProducers({ page, pageSize, search }: ListParams): Promise<PagedProducers> {
  return request<PagedProducers>({
    method: 'GET',
    path: '/producers',
    // An empty search is omitted entirely rather than sent as `search=` (contracts/api-client.md).
    query: { page, pageSize, search: search.trim() || undefined },
  });
}

export async function fetchProducer(id: string): Promise<ProducerDetail> {
  const raw = await request<RawProducerDetail>({ method: 'GET', path: `/producers/${id}` });

  return { ...raw, properties: (raw.properties ?? []).map(toProperty) };
}

export function createProducer(input: ProducerInput): Promise<Producer> {
  return request<Producer>({ method: 'POST', path: '/producers', body: input });
}

export function updateProducer(id: string, input: Partial<ProducerInput>): Promise<Producer> {
  return request<Producer>({ method: 'PATCH', path: `/producers/${id}`, body: input });
}

export function deleteProducer(id: string): Promise<DeletionReport> {
  return request<DeletionReport>({ method: 'DELETE', path: `/producers/${id}` });
}
