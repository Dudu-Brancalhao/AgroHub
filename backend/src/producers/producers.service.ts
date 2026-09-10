import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Producer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProducersRepository } from './producers.repository';
import {
  DeletionReportDto,
  ProducerDetailDto,
  ProducerResponseDto,
} from './entities/producer.entity';
import { CreateProducerDto } from './dto/create-producer.dto';
import { UpdateProducerDto } from './dto/update-producer.dto';
import { QueryProducerDto } from './dto/query-producer.dto';
import { PagedResult } from '../common/dto/pagination.dto';
import { detectDocumentType } from '../common/validation/document';
import { PropertyResponseDto } from '../properties/entities/property.entity';

const DOCUMENT_TAKEN = 'Já existe um produtor cadastrado com este documento.';
const NOT_FOUND = 'Produtor não encontrado.';

@Injectable()
export class ProducersService {
  private readonly logger = new Logger(ProducersService.name);

  constructor(
    private readonly repository: ProducersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateProducerDto, actorId: string): Promise<ProducerResponseDto> {
    try {
      const producer = await this.repository.create({
        document: dto.document,
        documentType: detectDocumentType(dto.document),
        name: dto.name,
      });

      // Logs carry the id, never the document: CPF is personal data under the LGPD and a log
      // aggregator is exactly where it must not accumulate (FR-038).
      this.logger.log(
        { producerId: producer.id, actorId, event: 'producer.created' },
        'producer created',
      );

      return ProducerResponseDto.fromEntity(producer);
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async findOne(id: string): Promise<ProducerResponseDto> {
    const producer = await this.repository.findById(id);
    if (!producer) {
      throw new NotFoundException(NOT_FOUND);
    }
    return ProducerResponseDto.fromEntity(producer);
  }

  /** FR-028: the producer with its properties and crops, grouped by harvest, in one response. */
  async findOneDetailed(id: string): Promise<ProducerDetailDto> {
    const producer = await this.repository.findByIdDetailed(id);
    if (!producer) {
      throw new NotFoundException(NOT_FOUND);
    }
    return {
      ...ProducerResponseDto.fromEntity(producer),
      properties: producer.properties.map((property) =>
        PropertyResponseDto.fromEntityDetailed(property),
      ),
    };
  }

  async list(query: QueryProducerDto): Promise<PagedResult<ProducerResponseDto>> {
    const [rows, total] = await this.repository.list({
      search: query.search,
      skip: query.skip,
      take: query.pageSize,
    });

    return {
      data: rows.map(ProducerResponseDto.fromEntity),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async update(id: string, dto: UpdateProducerDto, actorId: string): Promise<ProducerResponseDto> {
    await this.requireExisting(id);

    try {
      const producer = await this.repository.update(id, {
        ...(dto.document !== undefined
          ? { document: dto.document, documentType: detectDocumentType(dto.document) }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      });

      this.logger.log(
        { producerId: id, actorId, event: 'producer.updated' },
        'producer updated',
      );

      return ProducerResponseDto.fromEntity(producer);
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  /**
   * Deletes the producer and everything beneath it (FR-030).
   *
   * The counts are taken INSIDE the transaction, before the delete. They cannot come from the
   * cascade itself: Postgres reports only rows removed from the target table, so a cascade that
   * removed 89 crops still reports 1. Reading and deleting in one transaction is what makes the
   * reported numbers true rather than approximately true (research.md R-004).
   */
  async remove(id: string, actorId: string): Promise<DeletionReportDto> {
    await this.requireExisting(id);

    const report = await this.prisma.$transaction(async (tx) => {
      const properties = await tx.property.count({ where: { producerId: id } });
      // Crops are reached directly now, and harvests are not counted at all: they are not beneath
      // a producer, and reporting `harvests: 0` would imply the operation considered them
      // (research.md R-008).
      const crops = await tx.crop.count({ where: { property: { producerId: id } } });

      // One statement; the database cascade removes the descendants atomically.
      await tx.producer.delete({ where: { id } });

      return { producers: 1, properties, crops };
    });

    this.logger.warn(
      { producerId: id, actorId, event: 'producer.deleted', deleted: report },
      'producer deleted with cascade',
    );

    return { deleted: report };
  }

  private async requireExisting(id: string): Promise<Producer> {
    const producer = await this.repository.findById(id);
    if (!producer) {
      throw new NotFoundException(NOT_FOUND);
    }
    return producer;
  }

  /**
   * The duplicate check IS the unique constraint. A pre-flight findByDocument would be a
   * check-then-insert race: two simultaneous requests both see "available" and both insert
   * (FR-008).
   */
  private translateConflict(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      this.logger.warn({ event: 'producer.document.duplicate' }, 'producer rejected: document taken');
      return new ConflictException(DOCUMENT_TAKEN);
    }
    return error;
  }
}
