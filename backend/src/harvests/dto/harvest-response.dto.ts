import { ApiProperty } from '@nestjs/swagger';
import { Harvest } from '@prisma/client';

/**
 * Note what is absent: there is no property field, and that absence is the feature. A harvest
 * belongs to nobody.
 */
export class HarvestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 2021, description: 'Ano da safra. O ano identifica a safra: não há duas com o mesmo ano em todo o cadastro.' })
  year!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(harvest: Harvest): HarvestResponseDto {
    return {
      id: harvest.id,
      year: harvest.year,
      createdAt: harvest.createdAt,
      updatedAt: harvest.updatedAt,
    };
  }
}
