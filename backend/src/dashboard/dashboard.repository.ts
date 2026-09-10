import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropSpellingRow } from './crop-label.resolver';

export interface DashboardAggregates {
  farms: number;
  totalArea: Prisma.Decimal | null;
  arableArea: Prisma.Decimal | null;
  vegetationArea: Prisma.Decimal | null;
  byState: Array<{ state: string; totalArea: Prisma.Decimal | null }>;
  cropSpellings: CropSpellingRow[];
}

/**
 * The only place Prisma is touched for the dashboard, and the owner of the transaction boundary.
 *
 * Everything is read inside ONE transaction at Repeatable Read, and that isolation level is
 * load-bearing rather than decorative. PostgreSQL defaults to Read Committed, where each
 * *statement* takes a fresh snapshot - so four independent queries see four points in time. A
 * property inserted between the count and the groupBy yields a response whose state slices do not
 * add up to its own hectare total, and nothing in the code looks wrong: no test fails, and it only
 * happens under concurrent writes (research.md R-001).
 *
 * Repeatable Read pins one snapshot for the whole transaction, so FR-011 and FR-024 are guaranteed
 * rather than usually true. For read-only work it takes no locks and costs nothing measurable.
 */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchAggregates(): Promise<DashboardAggregates> {
    return this.prisma.$transaction(
      async (tx) => {
        // All three sums come from one aggregate: the land-use breakdown needs arable and
        // vegetation, and re-querying them separately would break the single-snapshot guarantee
        // this transaction exists to provide.
        const totals = await tx.property.aggregate({
          _count: true,
          _sum: { totalArea: true, arableArea: true, vegetationArea: true },
        });

        const byState = await tx.property.groupBy({
          by: ['state'],
          _sum: { totalArea: true },
        });

        // Grouped by BOTH columns on purpose: the normalised key is what collapses spelling
        // variants, and the raw name is what lets the resolver pick the spelling people actually
        // use. Grouping by the key alone would force _min(name), which picks the wrong one.
        const crops = await tx.crop.groupBy({
          by: ['nameNormalized', 'name'],
          _count: { _all: true },
        });

        return {
          farms: totals._count,
          totalArea: totals._sum.totalArea,
          arableArea: totals._sum.arableArea,
          vegetationArea: totals._sum.vegetationArea,
          byState: byState.map((row) => ({ state: row.state, totalArea: row._sum.totalArea })),
          cropSpellings: crops.map((row) => ({
            nameNormalized: row.nameNormalized,
            name: row.name,
            count: row._count._all,
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
