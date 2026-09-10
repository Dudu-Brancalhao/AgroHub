import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardRepository } from './dashboard.repository';
import { resolveCrops } from './crop-label.resolver';
import { RawCategory, buildBreakdown } from './breakdown.builder';
import { sumOrZero, toHectares } from './decimal.util';
import { DashboardSummaryDto } from './dto/dashboard-response.dto';
import { normalizeForSearch } from '../common/validation/text-normalizer';

/** pt-BR labels for the land-use categories (Constitution VIII). */
const LAND_USE_LABELS = {
  arable: 'Área agricultável',
  vegetation: 'Vegetação',
  unclassified: 'Área não classificada',
} as const;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly repository: DashboardRepository) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    let aggregates;
    try {
      aggregates = await this.repository.fetchAggregates();
    } catch (error) {
      // FR-026: enough context to diagnose, nothing internal to the caller. The filter turns this
      // into the generic 500 envelope.
      this.logger.error(
        { event: 'dashboard.failed', err: error instanceof Error ? error.message : error },
        'failed to build dashboard summary',
      );
      throw new InternalServerErrorException();
    }

    const totalArea = sumOrZero(aggregates.totalArea);
    const arableArea = sumOrZero(aggregates.arableArea);
    const vegetationArea = sumOrZero(aggregates.vegetationArea);

    return {
      totals: {
        farms: aggregates.farms,
        hectares: toHectares(totalArea),
      },
      byState: this.buildStateBreakdown(aggregates.byState),
      byCrop: this.buildCropBreakdown(aggregates.cropSpellings),
      byLandUse: this.buildLandUseBreakdown(totalArea, arableArea, vegetationArea),
    };
  }

  /**
   * FR-010: the state is normalised on read. The registry validates it against the 27 federative
   * units and stores it uppercased, so two categories for one unit cannot arise from data entered
   * through the API - but the breakdown must stay correct if data ever arrives another way.
   */
  private buildStateBreakdown(rows: Array<{ state: string; totalArea: Prisma.Decimal | null }>) {
    const merged = new Map<string, Prisma.Decimal>();

    for (const row of rows) {
      const key = row.state.trim().toUpperCase();
      merged.set(key, (merged.get(key) ?? new Prisma.Decimal(0)).plus(sumOrZero(row.totalArea)));
    }

    const raw: RawCategory[] = [...merged.entries()].map(([key, value]) => ({
      key,
      label: key,
      value,
    }));

    return buildBreakdown('hectares', raw);
  }

  private buildCropBreakdown(rows: Parameters<typeof resolveCrops>[0]) {
    // Re-normalise defensively for the same reason as the state key above: the stored key is
    // derived by the registry, and this breakdown should not depend on that having been done.
    const normalised = rows.map((row) => ({
      ...row,
      nameNormalized: normalizeForSearch(row.nameNormalized),
    }));

    const raw: RawCategory[] = resolveCrops(normalised).map((crop) => ({
      key: crop.key,
      label: crop.label,
      value: crop.count,
    }));

    return buildBreakdown('count', raw);
  }

  private buildLandUseBreakdown(
    totalArea: Prisma.Decimal,
    arableArea: Prisma.Decimal,
    vegetationArea: Prisma.Decimal,
  ) {
    const unclassified = totalArea.minus(arableArea).minus(vegetationArea);

    // Feature 002 guarantees arable + vegetation <= total for every property, so this sum can
    // never be negative. If it is, the registry was corrupted outside the API - by a direct
    // database write, a failed migration, or a regression in the area rule - and this is the only
    // place that would notice. A negative pie slice renders as nonsense, so fail loudly instead
    // (research.md R-011).
    if (unclassified.isNegative()) {
      this.logger.error(
        {
          event: 'dashboard.invariant.violated',
          totalArea: toHectares(totalArea),
          arableArea: toHectares(arableArea),
          vegetationArea: toHectares(vegetationArea),
        },
        'unclassified area is negative: arable + vegetation exceeds total across the registry',
      );
      throw new InternalServerErrorException();
    }

    // All three go through the shared builder, so the zero filter that drops `unclassified` when
    // the land is fully classified is the same rule that keeps empty states out of byState.
    return buildBreakdown('hectares', [
      { key: 'arable', label: LAND_USE_LABELS.arable, value: arableArea },
      { key: 'vegetation', label: LAND_USE_LABELS.vegetation, value: vegetationArea },
      { key: 'unclassified', label: LAND_USE_LABELS.unclassified, value: unclassified },
    ]);
  }
}
