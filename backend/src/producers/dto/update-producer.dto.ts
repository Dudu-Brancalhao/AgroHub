import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsDocument } from '../../common/validation/is-document.validator';
import { normalizeDocument } from '../../common/validation/document';
import { normalizeDisplayText } from '../../common/validation/text-normalizer';

/** Fields omitted stay unchanged; those supplied face the same rules as creation (US5 §2). */
export class UpdateProducerDto {
  @ApiPropertyOptional({ example: '11.222.333/0001-81' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDocument(value) : value))
  @IsDocument()
  document?: string;

  @ApiPropertyOptional({ maxLength: 200, example: 'José A. de Almeida' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeDisplayText(value) : value))
  @IsString({ message: 'O nome deve ser um texto.' })
  @MinLength(1, { message: 'O nome não pode ficar vazio.' })
  @MaxLength(200, { message: 'O nome deve ter no máximo 200 caracteres.' })
  name?: string;
}
