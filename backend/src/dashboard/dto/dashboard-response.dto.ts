import { ApiProperty } from '@nestjs/swagger';

export type BreakdownUnit = 'hectares' | 'count';

export class CategoryDto {
  @ApiProperty({
    description:
      'Identificador estável da categoria. Sigla da UF para estados, forma normalizada do nome ' +
      'para culturas, e arable/vegetation/unclassified para uso do solo. Use para agrupar.',
    example: 'soja',
  })
  key!: string;

  @ApiProperty({
    description:
      'Texto para exibição. Para culturas é a grafia mais usada entre as variantes do mesmo nome.',
    example: 'Soja',
  })
  label!: string;

  @ApiProperty({
    description:
      'Hectares (texto, 2 casas decimais) quando a unidade é hectares; contagem (inteiro) quando ' +
      'a unidade é count.',
    oneOf: [{ type: 'string' }, { type: 'integer' }],
    example: '1200.11',
  })
  value!: string | number;
}

export class BreakdownDto {
  @ApiProperty({
    enum: ['hectares', 'count'],
    description:
      'O que o value de cada categoria representa. Declarado explicitamente para que um ' +
      'consumidor nunca precise adivinhar se 300 são 300 hectares ou 300 registros.',
  })
  unit!: BreakdownUnit;

  @ApiProperty({
    type: [CategoryDto],
    description:
      'Ordenadas do maior para o menor valor, com desempate pelo key. Lista vazia quando não há ' +
      'nada a exibir. Nunca contém categoria com valor zero.',
  })
  categories!: CategoryDto[];
}

export class TotalsDto {
  @ApiProperty({ minimum: 0, description: 'Quantidade de propriedades cadastradas.', example: 4 })
  farms!: number;

  @ApiProperty({
    type: String,
    description:
      'Soma da área total de todas as propriedades, em hectares. Devolvido como texto para ' +
      'preservar a precisão exata — 1725.47 interpretado como número de ponto flutuante não é ' +
      'exatamente 1725,47.',
    example: '1725.47',
  })
  hectares!: string;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: TotalsDto })
  totals!: TotalsDto;

  @ApiProperty({
    type: BreakdownDto,
    description: 'Hectares por unidade federativa. Fecha exatamente com totals.hectares.',
  })
  byState!: BreakdownDto;

  @ApiProperty({
    type: BreakdownDto,
    description:
      'Quantidade de registros de cultura. NÃO fecha com totals.farms — conta plantios, e uma ' +
      'mesma propriedade pode contribuir várias vezes.',
  })
  byCrop!: BreakdownDto;

  @ApiProperty({
    type: BreakdownDto,
    description:
      'Hectares por uso do solo. Fecha exatamente com totals.hectares. A categoria unclassified ' +
      'só aparece quando sobra área não classificada.',
  })
  byLandUse!: BreakdownDto;
}
