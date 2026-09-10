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
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BEARER_SCHEME } from '../common/swagger/document.config';
import { CropsService, PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateCropDto } from './dto/create-crop.dto';
import {
  CropResponseDto,
  HarvestWithCropsDto,
  PropertyDetailDto,
  PropertyResponseDto,
} from './entities/property.entity';
import { DeletionReportDto } from '../producers/entities/producer.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

const UNAUTHORIZED = {
  description: 'Token ausente, expirado ou inválido',
  type: ErrorResponseDto,
};

@ApiTags('Propriedades')
@ApiBearerAuth(BEARER_SCHEME)
@ApiUnauthorizedResponse(UNAUTHORIZED)
@Controller()
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post('producers/:producerId/properties')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra uma propriedade para o produtor',
    description:
      'A soma de área agricultável e área de vegetação NÃO pode ultrapassar a área total. ' +
      'Usar exatamente toda a área é permitido; ultrapassar não.',
  })
  @ApiCreatedResponse({ description: 'Propriedade cadastrada', type: PropertyResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou regra de áreas violada', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Produtor não encontrado', type: ErrorResponseDto })
  create(
    @Param('producerId', ParseUUIDPipe) producerId: string,
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PropertyResponseDto> {
    return this.propertiesService.create(producerId, dto, user.id);
  }

  @Get('producers/:producerId/properties')
  @ApiOperation({
    summary: 'Lista as propriedades de um produtor',
    description: 'Um produtor sem propriedades devolve uma lista vazia — isso não é erro.',
  })
  @ApiOkResponse({ description: 'Propriedades do produtor', type: [PropertyResponseDto] })
  @ApiNotFoundResponse({ description: 'Produtor não encontrado', type: ErrorResponseDto })
  listByProducer(@Param('producerId', ParseUUIDPipe) producerId: string) {
    return this.propertiesService.listByProducer(producerId);
  }

  @Get('properties/:id')
  @ApiOperation({
    summary: 'Retorna uma propriedade com suas culturas',
    description:
      'As culturas vêm agrupadas por safra, apenas para facilitar a leitura. A safra não pertence ' +
      'à propriedade: ela é compartilhada por todo o cadastro, e o que liga as duas é a cultura.',
  })
  @ApiOkResponse({ description: 'Propriedade encontrada', type: PropertyDetailDto })
  @ApiNotFoundResponse({ description: 'Propriedade não encontrada', type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch('properties/:id')
  @ApiOperation({
    summary: 'Altera os dados de uma propriedade',
    description:
      'Campos omitidos permanecem inalterados, MAS a regra de áreas é verificada sobre o registro ' +
      'como ele ficará depois da alteração. Exemplo: uma propriedade com total 100 ha, ' +
      'agricultável 60 ha e vegetação 30 ha não aceita {"totalArea": 80}, porque 60 + 30 ' +
      'ultrapassaria os 80 ha resultantes.',
  })
  @ApiOkResponse({ description: 'Propriedade atualizada', type: PropertyResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou regra de áreas violada', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Propriedade não encontrada', type: ErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PropertyResponseDto> {
    return this.propertiesService.update(id, dto, user.id);
  }

  @Delete('properties/:id')
  @ApiOperation({
    summary: 'Exclui uma propriedade e suas culturas',
    description:
      'Exclusão permanente e em cascata. O produtor permanece. AS SAFRAS TAMBÉM PERMANECEM: uma ' +
      'safra é compartilhada por todo o cadastro e não pertence a esta propriedade, então a ' +
      'resposta não traz contagem de safras.',
  })
  @ApiOkResponse({ description: 'Propriedade e culturas excluídas', type: DeletionReportDto })
  @ApiNotFoundResponse({ description: 'Propriedade não encontrada', type: ErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeletionReportDto> {
    return this.propertiesService.remove(id, user.id);
  }
}

@ApiTags('Culturas')
@ApiBearerAuth(BEARER_SCHEME)
@ApiUnauthorizedResponse(UNAUTHORIZED)
@Controller()
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Post('properties/:propertyId/crops')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra uma cultura plantada por esta fazenda',
    description:
      'A cultura é o vínculo entre a fazenda e a safra: ela carrega as duas. A propriedade vem no ' +
      'caminho porque é ela que POSSUI a cultura — excluir a propriedade exclui suas culturas. ' +
      'A safra vem no corpo porque é compartilhada e não possui nada. A mesma cultura não pode ser ' +
      'registrada duas vezes para a MESMA fazenda na MESMA safra; a comparação ignora maiúsculas ' +
      'e acentos. Já a mesma cultura em safras diferentes, ou em fazendas diferentes, é permitida.',
  })
  @ApiCreatedResponse({ description: 'Cultura registrada', type: CropResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Propriedade ou safra não encontrada', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Cultura já registrada para esta fazenda nesta safra',
    type: ErrorResponseDto,
  })
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateCropDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cropsService.create(propertyId, dto, user.id);
  }

  @Get('properties/:propertyId/crops')
  @ApiOperation({
    summary: 'Lista o que esta fazenda plantou, em todas as safras',
    description:
      'As culturas vêm agrupadas por safra, da mais antiga para a mais recente. Uma fazenda que ' +
      'nunca plantou devolve uma lista vazia — isso não é erro.',
  })
  @ApiOkResponse({
    description: 'Culturas da propriedade, agrupadas por safra',
    type: [HarvestWithCropsDto],
  })
  @ApiNotFoundResponse({ description: 'Propriedade não encontrada', type: ErrorResponseDto })
  listByProperty(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.cropsService.listByProperty(propertyId);
  }

  @Get('harvests/:harvestId/crops')
  @ApiOperation({
    summary: 'Lista o que foi plantado nesta safra, em todas as fazendas',
    description:
      'Cada item informa a fazenda em propertyId, já que a safra é compartilhada e pode ter ' +
      'plantios de vários produtores.',
  })
  @ApiOkResponse({ description: 'Culturas da safra', type: [CropResponseDto] })
  @ApiNotFoundResponse({ description: 'Safra não encontrada', type: ErrorResponseDto })
  listByHarvest(@Param('harvestId', ParseUUIDPipe) harvestId: string) {
    return this.cropsService.listByHarvest(harvestId);
  }

  @Delete('crops/:id')
  @ApiOperation({ summary: 'Exclui uma cultura' })
  @ApiOkResponse({ description: 'Cultura excluída', type: DeletionReportDto })
  @ApiNotFoundResponse({ description: 'Cultura não encontrada', type: ErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeletionReportDto> {
    return this.cropsService.remove(id, user.id);
  }
}
