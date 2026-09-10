import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BEARER_SCHEME } from '../common/swagger/document.config';
import { HarvestsService } from './harvests.service';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { HarvestResponseDto } from './dto/harvest-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DeletionReportDto } from '../producers/entities/producer.entity';

@ApiTags('Safras')
@ApiBearerAuth(BEARER_SCHEME)
@ApiUnauthorizedResponse({
  description: 'Token ausente, expirado ou inválido',
  type: ErrorResponseDto,
})
@Controller('harvests')
export class HarvestsController {
  constructor(private readonly harvestsService: HarvestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as safras disponíveis',
    description:
      'Cada safra aparece uma única vez, independentemente de quantas fazendas plantaram nela. ' +
      'A lista é naturalmente curta: um ano válido vai de 1900 até o ano que vem, então existem no ' +
      'máximo 128 safras possíveis.',
  })
  @ApiOkResponse({
    description: 'Safras cadastradas, da mais recente para a mais antiga',
    type: [HarvestResponseDto],
  })
  findAll(): Promise<HarvestResponseDto[]> {
    return this.harvestsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra uma safra',
    description:
      'A safra é criada uma vez para todo o cadastro. NÃO se informa propriedade: uma safra não ' +
      'pertence a ninguém, e é a cultura que liga a fazenda à safra. O ano identifica a safra, ' +
      'então não é possível cadastrar duas vezes o mesmo ano.',
  })
  @ApiCreatedResponse({ description: 'Safra cadastrada', type: HarvestResponseDto })
  @ApiBadRequestResponse({ description: 'Ano inválido', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Já existe uma safra para este ano', type: ErrorResponseDto })
  create(
    @Body() dto: CreateHarvestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HarvestResponseDto> {
    return this.harvestsService.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma safra' })
  @ApiOkResponse({ description: 'Safra encontrada', type: HarvestResponseDto })
  @ApiNotFoundResponse({ description: 'Safra não encontrada', type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<HarvestResponseDto> {
    return this.harvestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Corrige o ano de uma safra',
    description:
      'A correção vale imediatamente para TODAS as fazendas que plantaram nesta safra — é esse o ' +
      'ganho de a safra ser compartilhada. Nenhum registro de propriedade é tocado.',
  })
  @ApiOkResponse({ description: 'Safra atualizada', type: HarvestResponseDto })
  @ApiBadRequestResponse({ description: 'Ano inválido', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Safra não encontrada', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Já existe outra safra para este ano',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHarvestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HarvestResponseDto> {
    return this.harvestsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Exclui uma safra que não está em uso',
    description:
      'RECUSADA enquanto houver qualquer cultura registrada nesta safra, e a resposta informa ' +
      'quantas estão impedindo. A recusa é proposital: uma safra é compartilhada, então apagá-la ' +
      'em cascata apagaria as culturas de TODAS as fazendas do cadastro de uma só vez.',
  })
  @ApiOkResponse({ description: 'Safra excluída', type: DeletionReportDto })
  @ApiNotFoundResponse({ description: 'Safra não encontrada', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'A safra tem culturas registradas e não pode ser excluída',
    type: ErrorResponseDto,
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeletionReportDto> {
    return this.harvestsService.remove(id, user.id);
  }
}
