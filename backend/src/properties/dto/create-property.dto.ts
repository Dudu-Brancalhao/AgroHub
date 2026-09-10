import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { BRAZILIAN_STATES } from '../../common/constants/brazilian-states';
import { ToDecimal } from '../../common/validation/decimal.transform';
import { IsArea } from '../../common/validation/is-area.validator';
import { normalizeDisplayText } from '../../common/validation/text-normalizer';

/**
 * Areas carry @ToDecimal so the DTO never holds a plain `number` past validation. That is what
 * lets the area rule add them exactly; adding them as numbers wrongly rejects a 1000 + 500.11 ha
 * farm on 1500.11 ha (research.md R-001).
 *
 * The area RULE itself is not here: a DTO sees only the payload, and on update the rule needs the
 * stored row. It lives in PropertiesService.
 */
export class CreatePropertyDto {
  @ApiProperty({ maxLength: 200, example: 'Fazenda Santa Helena' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString({ message: 'O nome da fazenda é obrigatório.' })
  @MinLength(1, { message: 'O nome da fazenda é obrigatório.' })
  @MaxLength(200, { message: 'O nome da fazenda deve ter no máximo 200 caracteres.' })
  farmName!: string;

  @ApiProperty({ maxLength: 120, example: 'Uberaba' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString({ message: 'A cidade é obrigatória.' })
  @MinLength(1, { message: 'A cidade é obrigatória.' })
  @MaxLength(120, { message: 'A cidade deve ter no máximo 120 caracteres.' })
  city!: string;

  @ApiProperty({ enum: BRAZILIAN_STATES, example: 'MG' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(BRAZILIAN_STATES as readonly string[], { message: 'Informe uma UF brasileira válida.' })
  state!: string;

  /**
   * `type: Number` is not decoration. The declared TypeScript type is Prisma.Decimal, and without
   * an explicit type Swagger reflects that class and documents the field as an empty object — so
   * "Try it out" sends {"totalArea": {}} and every request fails validation. The wire format is a
   * JSON number; Decimal is what the field becomes AFTER @ToDecimal runs.
   */
  @ApiProperty({
    type: Number,
    example: 1500.11,
    description: 'Área total em hectares, até 2 casas decimais.',
  })
  @IsArea({ min: 0.01, label: 'A área total' })
  @ToDecimal()
  totalArea!: Prisma.Decimal;

  @ApiProperty({ type: Number, example: 1000, description: 'Área agricultável em hectares.' })
  @IsArea({ min: 0, label: 'A área agricultável' })
  @ToDecimal()
  arableArea!: Prisma.Decimal;

  @ApiProperty({ type: Number, example: 500.11, description: 'Área de vegetação em hectares.' })
  @IsArea({ min: 0, label: 'A área de vegetação' })
  @ToDecimal()
  vegetationArea!: Prisma.Decimal;
}
