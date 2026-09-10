import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BEARER_SCHEME } from '../common/swagger/document.config';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

/**
 * HTTP entry point only (Constitution II): no parameters, no body, delegate and return.
 *
 * Note what is NOT here: no @UseGuards and no @Public(). The global JwtAuthGuard from feature 001
 * denies by default, so this route is protected without a line of authentication code - the whole
 * of FR-001.
 */
@ApiTags('Painel')
@ApiBearerAuth(BEARER_SCHEME)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna os números consolidados do cadastro',
    description:
      'Devolve, em uma única chamada, tudo que o painel precisa.\n\n' +
      'O que cada número significa:\n' +
      '- totals.farms — quantidade de propriedades cadastradas.\n' +
      '- totals.hectares — soma da área total de todas as propriedades.\n' +
      '- byState — HECTARES por unidade federativa. Fecha exatamente com totals.hectares.\n' +
      '- byCrop — QUANTIDADE DE REGISTROS de cultura, não hectares.\n' +
      '- byLandUse — hectares divididos entre área agricultável, vegetação e área não ' +
      'classificada. Fecha exatamente com totals.hectares. A categoria unclassified só aparece ' +
      'quando sobra área não classificada.\n\n' +
      'Cada distribuição informa a própria unidade no campo unit. Categorias com valor zero nunca ' +
      'aparecem. As categorias vêm ordenadas do maior para o menor valor, com desempate pelo key, ' +
      'de modo que duas chamadas iguais devolvem exatamente a mesma ordem.\n\n' +
      'Culturas com grafias diferentes viram uma categoria: Soja, soja e SOJA são a mesma ' +
      'cultura, e o rótulo exibido é a grafia mais usada. Já Soja e Soya continuam sendo duas.\n\n' +
      'Uma propriedade sem safra ou sem cultura conta em totals e em byState, mas não aparece em ' +
      'byCrop.\n\n' +
      'Não há filtros nesta versão. Cadastro vazio devolve 200 com zeros e listas vazias.',
  })
  @ApiOkResponse({ description: 'Números consolidados do cadastro', type: DashboardSummaryDto })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, expirado ou inválido',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Falha ao montar o painel. O motivo fica no log, associado ao requestId.',
    type: ErrorResponseDto,
  })
  getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }
}
