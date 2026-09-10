import { ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BRAZILIAN_STATES } from '../../common/constants/brazilian-states';
import { ToDecimal } from '../../common/validation/decimal.transform';
import { IsArea } from '../../common/validation/is-area.validator';
import { normalizeDisplayText } from '../../common/validation/text-normalizer';

/**
 * Every field optional — and the area rule is deliberately NOT checked here.
 *
 * A DTO sees only the payload, and `{"totalArea": 80}` is a perfectly good number in isolation.
 * Only the stored row reveals that 80 is too small for the 60 + 30 already recorded, so the rule
 * runs in PropertiesService against the merged record (FR-014, research.md R-009).
 */
export class UpdatePropertyDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString()
  @MinLength(1, { message: 'O nome da fazenda não pode ficar vazio.' })
  @MaxLength(200)
  farmName?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString()
  @MinLength(1, { message: 'A cidade não pode ficar vazia.' })
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ enum: BRAZILIAN_STATES })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(BRAZILIAN_STATES as readonly string[], { message: 'Informe uma UF brasileira válida.' })
  state?: string;

  @ApiPropertyOptional({ type: Number, example: 1500.11 })
  @IsOptional()
  @IsArea({ min: 0.01, label: 'A área total' })
  @ToDecimal()
  totalArea?: Prisma.Decimal;

  @ApiPropertyOptional({ type: Number, example: 1000 })
  @IsOptional()
  @IsArea({ min: 0, label: 'A área agricultável' })
  @ToDecimal()
  arableArea?: Prisma.Decimal;

  @ApiPropertyOptional({ type: Number, example: 500.11 })
  @IsOptional()
  @IsArea({ min: 0, label: 'A área de vegetação' })
  @ToDecimal()
  vegetationArea?: Prisma.Decimal;
}
