import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, Producer } from '@prisma/client';
import { PropertyDetailDto } from '../../properties/entities/property.entity';

/**
 * The only shape of a producer that leaves the API.
 *
 * Six fields named explicitly rather than a spread minus `nameSearch`. With a spread, a column
 * added later is exposed by default and someone must remember to hide it; here it is invisible
 * until someone deliberately adds it, so the omission fails closed.
 */
export class ProducerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Armazenado apenas com dígitos.', example: '52998224725' })
  document!: string;

  @ApiProperty({ enum: DocumentType })
  documentType!: DocumentType;

  @ApiProperty({ example: 'José Antônio de Almeida' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(producer: Producer): ProducerResponseDto {
    return {
      id: producer.id,
      document: producer.document,
      documentType: producer.documentType,
      name: producer.name,
      createdAt: producer.createdAt,
      updatedAt: producer.updatedAt,
    };
  }
}

/** O produtor com toda a sua árvore de registros (FR-028). */
export class ProducerDetailDto extends ProducerResponseDto {
  @ApiProperty({
    type: [PropertyDetailDto],
    description: 'Propriedades do produtor, cada uma com suas culturas agrupadas por safra.',
  })
  properties!: PropertyDetailDto[];
}

/**
 * Quantos registros de cada tipo a exclusão removeu.
 *
 * Cada chave só aparece quando a operação de fato considerou aquele tipo. Excluir um produtor ou
 * uma propriedade não devolve `harvests`: a safra é compartilhada e não fica abaixo de nenhum dos
 * dois, então informar `harvests: 0` daria a entender que a operação chegou a avaliá-la.
 */
export class DeletionCountsDto {
  @ApiPropertyOptional({ example: 1, description: 'Produtores excluídos.' })
  producers?: number;

  @ApiPropertyOptional({ example: 3, description: 'Propriedades excluídas em cascata.' })
  properties?: number;

  @ApiPropertyOptional({ example: 89, description: 'Culturas excluídas em cascata.' })
  crops?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Safras excluídas. Presente apenas ao excluir a própria safra — nunca ao excluir um ' +
      'produtor ou uma propriedade, porque a safra é compartilhada e não pertence a eles.',
  })
  harvests?: number;
}

/** Counts returned by every delete, so the caller sees the blast radius (FR-034). */
export class DeletionReportDto {
  @ApiProperty({
    type: DeletionCountsDto,
    example: { producers: 1, properties: 3, crops: 89 },
  })
  deleted!: DeletionCountsDto;
}
