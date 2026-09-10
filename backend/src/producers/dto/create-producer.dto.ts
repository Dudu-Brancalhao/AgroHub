import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsDocument } from '../../common/validation/is-document.validator';
import { normalizeDocument } from '../../common/validation/document';
import { normalizeDisplayText } from '../../common/validation/text-normalizer';

export class CreateProducerDto {
  @ApiProperty({
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos). Pontuação opcional.',
    example: '529.982.247-25',
  })
  // Normalised BEFORE validation so punctuation never reaches storage or comparison (FR-007).
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDocument(value) : value))
  @IsDocument()
  document!: string;

  @ApiProperty({ maxLength: 200, example: 'José Antônio de Almeida' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString({ message: 'O nome é obrigatório.' })
  @MinLength(1, { message: 'O nome é obrigatório.' })
  @MaxLength(200, { message: 'O nome deve ter no máximo 200 caracteres.' })
  name!: string;
}
