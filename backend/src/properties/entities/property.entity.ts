import { ApiProperty } from '@nestjs/swagger';
import { Crop, Harvest, Property } from '@prisma/client';
import { decimalToString } from '../../common/validation/decimal.transform';

export class CropResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A fazenda que plantou. Informado diretamente, sem precisar percorrer a safra.',
  })
  propertyId!: string;

  @ApiProperty({ format: 'uuid' })
  harvestId!: string;

  @ApiProperty({ description: 'Devolvido como o usuário digitou.', example: 'Soja' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  // nameNormalized is deliberately absent: it is a comparison key, not data the caller needs.
  static fromEntity(crop: Crop): CropResponseDto {
    return {
      id: crop.id,
      propertyId: crop.propertyId,
      harvestId: crop.harvestId,
      name: crop.name,
      createdAt: crop.createdAt,
      updatedAt: crop.updatedAt,
    };
  }
}

/** A property's crops in one harvest, grouped for readability (FR-019). */
export class HarvestWithCropsDto {
  @ApiProperty({ format: 'uuid' })
  harvestId!: string;

  @ApiProperty({ example: 2021 })
  year!: number;

  @ApiProperty({ type: [CropResponseDto] })
  crops!: CropResponseDto[];
}

/**
 * Groups a property's crops by harvest year.
 *
 * Done here rather than by a nested database include, because the include would have to walk
 * property -> harvest, and that path no longer exists (research.md R-006).
 */
export function groupCropsByHarvest(
  crops: Array<Crop & { harvest: Harvest }>,
): HarvestWithCropsDto[] {
  const byHarvest = new Map<string, HarvestWithCropsDto>();

  for (const crop of crops) {
    const entry = byHarvest.get(crop.harvestId) ?? {
      harvestId: crop.harvestId,
      year: crop.harvest.year,
      crops: [],
    };
    entry.crops.push(CropResponseDto.fromEntity(crop));
    byHarvest.set(crop.harvestId, entry);
  }

  return [...byHarvest.values()].sort((a, b) => a.year - b.year);
}

export class PropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  producerId!: string;

  @ApiProperty({ example: 'Fazenda Santa Helena' })
  farmName!: string;

  @ApiProperty({ example: 'Uberaba' })
  city!: string;

  @ApiProperty({ example: 'MG' })
  state!: string;

  /**
   * Areas are serialised as STRINGS.
   *
   * Returning them as JSON numbers would hand the client back the same floating-point problem the
   * server just avoided: `1500.11` parsed as a double is not exactly 1500.11, and any client-side
   * arithmetic reintroduces the drift. A string is exact and the client can decide what to do
   * with it (research.md R-001).
   */
  @ApiProperty({ type: String, example: '1500.11' })
  totalArea!: string;

  @ApiProperty({ type: String, example: '1000.00' })
  arableArea!: string;

  @ApiProperty({ type: String, example: '500.11' })
  vegetationArea!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(property: Property): PropertyResponseDto {
    return {
      id: property.id,
      producerId: property.producerId,
      farmName: property.farmName,
      city: property.city,
      state: property.state,
      totalArea: decimalToString(property.totalArea),
      arableArea: decimalToString(property.arableArea),
      vegetationArea: decimalToString(property.vegetationArea),
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };
  }

  static fromEntityDetailed(
    property: Property & { crops: Array<Crop & { harvest: Harvest }> },
  ): PropertyDetailDto {
    return {
      ...PropertyResponseDto.fromEntity(property),
      harvests: groupCropsByHarvest(property.crops),
    };
  }
}

/**
 * A property with what it planted, agrupado por safra.
 *
 * O agrupamento é de leitura, não de posse: a safra não fica abaixo da propriedade. Cada grupo é
 * uma safra COMPARTILHADA em que esta fazenda plantou, e o vínculo entre as duas é a cultura.
 */
export class PropertyDetailDto extends PropertyResponseDto {
  @ApiProperty({
    type: [HarvestWithCropsDto],
    description:
      'Safras em que esta fazenda plantou, com as culturas de cada uma. Uma fazenda sem culturas ' +
      'devolve uma lista vazia.',
  })
  harvests!: HarvestWithCropsDto[];
}
