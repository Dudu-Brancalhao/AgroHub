import { Injectable } from '@nestjs/common';
import { DocumentType, Prisma, Producer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeForSearch } from '../common/validation/text-normalizer';

export interface ProducerListFilters {
  search?: string;
  skip: number;
  take: number;
}

/**
 * The only place Prisma is touched for producers (Constitution II), and the only place
 * `nameSearch` is derived.
 *
 * That second point is deliberate: `nameSearch` is denormalised, so it is wrong the moment
 * someone writes `name` without it. Confining both writes to this class means a service cannot
 * get it wrong, because a service cannot write the row at all (research.md R-005).
 */
@Injectable()
export class ProducersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { document: string; documentType: DocumentType; name: string }): Promise<Producer> {
    return this.prisma.producer.create({
      data: { ...data, nameSearch: normalizeForSearch(data.name) },
    });
  }

  async findById(id: string): Promise<Producer | null> {
    return this.prisma.producer.findUnique({ where: { id } });
  }

  async findByIdDetailed(id: string) {
    return this.prisma.producer.findUnique({
      where: { id },
      include: {
        // properties -> crops -> harvest. The old include walked property -> harvest -> crop,
        // and that path no longer exists: the two are related only through the crops between
        // them (research.md R-006).
        properties: {
          orderBy: { createdAt: 'asc' },
          include: {
            crops: { orderBy: { createdAt: 'asc' }, include: { harvest: true } },
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: { document?: string; documentType?: DocumentType; name?: string },
  ): Promise<Producer> {
    return this.prisma.producer.update({
      where: { id },
      data: {
        ...data,
        // Re-derived whenever the name changes, never left stale.
        ...(data.name !== undefined ? { nameSearch: normalizeForSearch(data.name) } : {}),
      },
    });
  }

  /**
   * A page plus the total, in one transaction so the two cannot disagree.
   *
   * `orderBy` is stable (createdAt then id): an unordered paged query may repeat or skip rows
   * between pages, which is the classic silent pagination bug.
   */
  async list(filters: ProducerListFilters): Promise<[Producer[], number]> {
    const where = this.buildWhere(filters.search);
    return this.prisma.$transaction([
      this.prisma.producer.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.producer.count({ where }),
    ]);
  }

  private buildWhere(search?: string): Prisma.ProducerWhereInput {
    if (!search) {
      return {};
    }
    const digits = search.replace(/\D/g, '');
    const byName: Prisma.ProducerWhereInput = {
      nameSearch: { contains: normalizeForSearch(search) },
    };
    // Only treat it as a document search when it actually contains digits, so searching a name
    // does not also match arbitrary document prefixes.
    return digits.length > 0
      ? { OR: [byName, { document: { startsWith: digits } }] }
      : byName;
  }
}
