import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { normalizeDisplayText } from '../../common/validation/text-normalizer';

export class CreateCropDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Safra COMPARTILHADA em que esta fazenda plantou. Deve existir: cadastre-a antes em ' +
      'POST /harvests.',
  })
  // The property comes from the path because it OWNS the crop; the harvest comes from the body
  // because it is shared and owns nothing (research.md R-003).
  @IsUUID('4', { message: 'Informe uma safra válida.' })
  harvestId!: string;

  @ApiProperty({ maxLength: 120, example: 'Soja' })
  // Trimmed and inner-whitespace-collapsed, but capitalisation is preserved for display (FR-024).
  // The comparison key that enforces uniqueness is derived separately in CropsRepository.
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString({ message: 'O nome da cultura é obrigatório.' })
  @MinLength(1, { message: 'O nome da cultura é obrigatório.' })
  @MaxLength(120, { message: 'O nome da cultura deve ter no máximo 120 caracteres.' })
  name!: string;
}
