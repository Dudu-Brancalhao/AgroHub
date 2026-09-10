import type { Centiares } from '../../lib/area';
import type { DocumentType } from '../../lib/documents';

/** Mirrors the producer, property and crop DTOs (contracts/api-client.md operations 5–18). */

export type Crop = {
  id: string;
  propertyId: string;
  harvestId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** A farm's plantings for one season, as nested in the producer detail response. */
export type HarvestWithCrops = {
  harvestId: string;
  year: number;
  crops: Crop[];
};

export type Property = {
  id: string;
  producerId: string;
  farmName: string;
  city: string;
  state: string;
  /** Held as integers; the API sends strings and expects numbers (research.md R-004). */
  totalArea: Centiares;
  arableArea: Centiares;
  vegetationArea: Centiares;
  createdAt: string;
  updatedAt: string;
};

export type PropertyDetail = Property & { harvests: HarvestWithCrops[] };

export type Producer = {
  id: string;
  document: string;
  documentType: DocumentType;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * What `GET /api/producers/:id` returns: the producer plus its farms, each already carrying its
 * crops grouped by season. This single response backs the whole detail screen (research.md R-009).
 */
export type ProducerDetail = Producer & { properties: PropertyDetail[] };

export type PagedProducers = {
  data: Producer[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProducerInput = { name: string; document: string };

export type PropertyInput = {
  farmName: string;
  city: string;
  state: string;
  totalArea: Centiares;
  arableArea: Centiares;
  vegetationArea: Centiares;
};

export type CropInput = { harvestId: string; name: string };

/** Returned by every delete, so a toast can name what actually went. */
export type DeletionReport = {
  deleted: { producers?: number; properties?: number; crops?: number; harvests?: number };
};
