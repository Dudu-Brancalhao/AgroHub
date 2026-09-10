import { Injectable } from '@nestjs/common';
import { Crop, Harvest, Prisma, Property } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeForSearch } from '../common/validation/text-normalizer';

export type CropWithHarvest = Crop & { harvest: Harvest };
export type PropertyDetailed = Property & { crops: CropWithHarvest[] };

/**
 * The old include walked property -> harvest -> crop. That path no longer exists: a property and a
 * harvest are related only through the crops between them, so the crops are fetched with their
 * harvest and grouped by year in the service (research.md R-006).
 */
const DETAIL_INCLUDE = {
  crops: {
    orderBy: [{ createdAt: 'asc' as const }],
    include: { harvest: true },
  },
};

/** The only place Prisma is touched for properties (Constitution II). */
@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PropertyUncheckedCreateInput): Promise<Property> {
    return this.prisma.property.create({ data });
  }

  async findById(id: string): Promise<Property | null> {
    return this.prisma.property.findUnique({ where: { id } });
  }

  async findByIdDetailed(id: string): Promise<PropertyDetailed | null> {
    return this.prisma.property.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  }

  async listByProducer(producerId: string): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: { producerId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async update(id: string, data: Prisma.PropertyUpdateInput): Promise<Property> {
    return this.prisma.property.update({ where: { id }, data });
  }

  /** Counts taken inside the transaction, then one delete; the cascade removes the rest. */
  /**
   * The report no longer carries a harvest count: harvests are not beneath a property any more,
   * and reporting `harvests: 0` would imply the operation considered them (research.md R-008).
   */
  async removeWithReport(id: string): Promise<{ properties: number; crops: number }> {
    return this.prisma.$transaction(async (tx) => {
      const crops = await tx.crop.count({ where: { propertyId: id } });
      await tx.property.delete({ where: { id } });
      return { properties: 1, crops };
    });
  }
}

/**
 * The only place Prisma is touched for crops, and the only place `nameNormalized` is derived.
 *
 * Confining the derivation here is what keeps the composite unique index meaningful: a service
 * that wrote `name` without the key would let duplicates through the constraint (FR-025).
 */
@Injectable()
export class CropsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(propertyId: string, harvestId: string, name: string): Promise<Crop> {
    return this.prisma.crop.create({
      data: { propertyId, harvestId, name, nameNormalized: normalizeForSearch(name) },
    });
  }

  async findById(id: string): Promise<Crop | null> {
    return this.prisma.crop.findUnique({ where: { id } });
  }

  async listByHarvest(harvestId: string): Promise<Crop[]> {
    return this.prisma.crop.findMany({ where: { harvestId }, orderBy: { createdAt: 'asc' } });
  }

  async listByProperty(propertyId: string): Promise<CropWithHarvest[]> {
    return this.prisma.crop.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'asc' },
      include: { harvest: true },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.crop.delete({ where: { id } });
  }
}
