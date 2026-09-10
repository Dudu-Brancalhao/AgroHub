import { Injectable } from '@nestjs/common';
import { Harvest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** The only place Prisma is touched for harvests (Constitution II). */
@Injectable()
export class HarvestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(year: number): Promise<Harvest> {
    return this.prisma.harvest.create({ data: { year } });
  }

  async findById(id: string): Promise<Harvest | null> {
    return this.prisma.harvest.findUnique({ where: { id } });
  }

  async findAll(): Promise<Harvest[]> {
    return this.prisma.harvest.findMany({ orderBy: { year: 'desc' } });
  }

  async update(id: string, year: number): Promise<Harvest> {
    return this.prisma.harvest.update({ where: { id }, data: { year } });
  }

  async countCrops(id: string): Promise<number> {
    return this.prisma.crop.count({ where: { harvestId: id } });
  }

  /**
   * Counts the referencing crops and deletes in ONE transaction.
   *
   * The count is for the message; the database RESTRICT is the guard. Between counting zero and
   * issuing the delete another request can record a crop - the same check-then-act race feature
   * 002 avoided for duplicate documents (research.md R-005).
   */
  async removeIfUnused(id: string): Promise<{ deleted: boolean; blockingCrops: number }> {
    return this.prisma.$transaction(async (tx) => {
      const blockingCrops = await tx.crop.count({ where: { harvestId: id } });
      if (blockingCrops > 0) {
        return { deleted: false, blockingCrops };
      }
      await tx.harvest.delete({ where: { id } });
      return { deleted: true, blockingCrops: 0 };
    });
  }
}
