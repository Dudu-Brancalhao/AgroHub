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
  Query,
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
import { ProducersService } from './producers.service';
import { CreateProducerDto } from './dto/create-producer.dto';
import { UpdateProducerDto } from './dto/update-producer.dto';
import { QueryProducerDto } from './dto/query-producer.dto';
import {
  DeletionReportDto,
  ProducerDetailDto,
  ProducerResponseDto,
} from './entities/producer.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * HTTP entry point only (Constitution II): parse, delegate, map.
 *
 * Note what is NOT here: no @UseGuards, no auth check of any kind. The global JwtAuthGuard from
 * feature 001 denies by default, and this controller does not carry @Public(), so every route is
 * protected. That is the whole of FR-001 (research.md R-007).
 */
@ApiTags('Produtores')
@ApiBearerAuth(BEARER_SCHEME)
@ApiUnauthorizedResponse({ description: 'Token ausente, expirado ou inválido', type: ErrorResponseDto })
@Controller('producers')
export class ProducersController {
  constructor(private readonly producersService: ProducersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra um novo produtor',
    description:
      'O documento é validado pelos dígitos verificadores — não basta ter o tamanho certo. ' +
      'Documentos formados por um único dígito repetido são recusados. Pontuação é ignorada.',
  })
  @ApiCreatedResponse({ description: 'Produtor cadastrado', type: ProducerResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Documento já cadastrado', type: ErrorResponseDto })
  create(
    @Body() dto: CreateProducerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProducerResponseDto> {
    return this.producersService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista produtores com paginação e busca',
    description:
      'A busca por nome ignora maiúsculas e acentos: procurar por "jose" encontra "José Antônio". ' +
      'A busca por documento aceita com ou sem pontuação.',
  })
  @ApiOkResponse({ description: 'Página de produtores' })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos', type: ErrorResponseDto })
  list(@Query() query: QueryProducerDto) {
    return this.producersService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retorna um produtor com suas propriedades e culturas',
    description:
      'As culturas de cada propriedade vêm agrupadas por safra, apenas para facilitar a leitura. ' +
      'A safra não pertence à propriedade: o agrupamento é montado a partir das culturas, que são ' +
      'o vínculo entre a fazenda e a safra compartilhada.',
  })
  @ApiOkResponse({
    description: 'Produtor com toda a sua árvore de registros',
    type: ProducerDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Produtor não encontrado', type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.producersService.findOneDetailed(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Altera nome e/ou documento de um produtor',
    description:
      'Campos omitidos permanecem inalterados. O documento, se enviado, passa pelas mesmas regras ' +
      'de validade e unicidade do cadastro.',
  })
  @ApiOkResponse({ description: 'Produtor atualizado', type: ProducerResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Produtor não encontrado', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Documento já cadastrado', type: ErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProducerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProducerResponseDto> {
    return this.producersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Exclui um produtor e tudo que pertence a ele',
    description:
      'EXCLUSÃO PERMANENTE E EM CASCATA. Remove o produtor, suas propriedades e as culturas ' +
      'dessas propriedades. AS SAFRAS PERMANECEM: uma safra é compartilhada por todo o cadastro e ' +
      'não pertence a este produtor, então a resposta não traz contagem de safras. Não há ' +
      'desfazer. A operação é atômica e a resposta informa quantos registros de cada tipo foram ' +
      'excluídos.',
  })
  @ApiOkResponse({ description: 'Produtor e descendentes excluídos', type: DeletionReportDto })
  @ApiNotFoundResponse({ description: 'Produtor não encontrado', type: ErrorResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeletionReportDto> {
    return this.producersService.remove(id, user.id);
  }
}
