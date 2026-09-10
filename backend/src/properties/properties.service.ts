import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import { CropsRepository, PropertiesRepository } from './properties.repository';
import { HarvestsRepository } from '../harvests/harvests.repository';
import { ProducersRepository } from '../producers/producers.repository';
import { AREA_RULE_MESSAGE, areasAreConsistent } from './area.rule';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateCropDto } from './dto/create-crop.dto';
import {
  CropResponseDto,
  PropertyDetailDto,
  PropertyResponseDto,
  groupCropsByHarvest,
} from './entities/property.entity';
import { DeletionReportDto } from '../producers/entities/producer.entity';

const PRODUCER_NOT_FOUND = 'Produtor não encontrado.';
const PROPERTY_NOT_FOUND = 'Propriedade não encontrada.';
const HARVEST_NOT_FOUND = 'Safra não encontrada.';
const CROP_NOT_FOUND = 'Cultura não encontrada.';
const CROP_DUPLICATE = 'Esta cultura já está registrada para esta fazenda nesta safra.';

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly repository: PropertiesRepository,
    private readonly producersRepository: ProducersRepository,
  ) {}

  async create(
    producerId: string,
    dto: CreatePropertyDto,
    actorId: string,
  ): Promise<PropertyResponseDto> {
    const producer = await this.producersRepository.findById(producerId);
    if (!producer) {
      // 404 on the path, not a validation error about a field: the parent is addressed by the
      // URL, so its absence is a missing resource (FR-018).
      throw new NotFoundException(PRODUCER_NOT_FOUND);
    }

    this.assertAreasConsistent(dto);

    const property = await this.repository.create({
      producerId,
      farmName: dto.farmName,
      city: dto.city,
      state: dto.state,
      totalArea: dto.totalArea,
      arableArea: dto.arableArea,
      vegetationArea: dto.vegetationArea,
    });

    this.logger.log(
      { propertyId: property.id, producerId, actorId, event: 'property.created' },
      'property created',
    );

    return PropertyResponseDto.fromEntity(property);
  }

  async findOne(id: string): Promise<PropertyDetailDto> {
    const property = await this.repository.findByIdDetailed(id);
    if (!property) {
      throw new NotFoundException(PROPERTY_NOT_FOUND);
    }
    return PropertyResponseDto.fromEntityDetailed(property);
  }

  async listByProducer(producerId: string): Promise<PropertyResponseDto[]> {
    const producer = await this.producersRepository.findById(producerId);
    if (!producer) {
      throw new NotFoundException(PRODUCER_NOT_FOUND);
    }
    const properties = await this.repository.listByProducer(producerId);
    return properties.map(PropertyResponseDto.fromEntity);
  }

  /**
   * Load, merge, validate — in that order (FR-014).
   *
   * The rule runs against the record as it WILL BE, not against the payload. A request of
   * `{"totalArea": 80}` carries one perfectly valid number; only the stored 60 + 30 reveals that
   * it breaks the invariant. Validating the payload alone accepts it and corrupts the row, which
   * is the single most likely way FR-013 gets bypassed after it is implemented
   * (research.md R-009).
   */
  async update(id: string, dto: UpdatePropertyDto, actorId: string): Promise<PropertyResponseDto> {
    const current = await this.requireProperty(id);

    const merged = {
      totalArea: dto.totalArea ?? current.totalArea,
      arableArea: dto.arableArea ?? current.arableArea,
      vegetationArea: dto.vegetationArea ?? current.vegetationArea,
    };

    this.assertAreasConsistent(merged, dto);

    const property = await this.repository.update(id, {
      ...(dto.farmName !== undefined ? { farmName: dto.farmName } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.totalArea !== undefined ? { totalArea: dto.totalArea } : {}),
      ...(dto.arableArea !== undefined ? { arableArea: dto.arableArea } : {}),
      ...(dto.vegetationArea !== undefined ? { vegetationArea: dto.vegetationArea } : {}),
    });

    this.logger.log({ propertyId: id, actorId, event: 'property.updated' }, 'property updated');

    return PropertyResponseDto.fromEntity(property);
  }

  async remove(id: string, actorId: string): Promise<DeletionReportDto> {
    await this.requireProperty(id);
    const deleted = await this.repository.removeWithReport(id);

    this.logger.warn(
      { propertyId: id, actorId, event: 'property.deleted', deleted },
      'property deleted with cascade',
    );

    return { deleted };
  }

  private async requireProperty(id: string): Promise<Property> {
    const property = await this.repository.findById(id);
    if (!property) {
      throw new NotFoundException(PROPERTY_NOT_FOUND);
    }
    return property;
  }

  /**
   * Reports the failure against whichever area field the caller actually sent, so the message
   * lands on a field they can see. On create all three are present; on update the offending
   * field may be the only one submitted.
   */
  private assertAreasConsistent(
    areas: { totalArea: Prisma.Decimal; arableArea: Prisma.Decimal; vegetationArea: Prisma.Decimal },
    submitted?: UpdatePropertyDto,
  ): void {
    if (areasAreConsistent(areas)) {
      return;
    }

    const field =
      submitted === undefined
        ? 'arableArea'
        : submitted.totalArea !== undefined
          ? 'totalArea'
          : submitted.arableArea !== undefined
            ? 'arableArea'
            : 'vegetationArea';

    throw new BadRequestException({
      message: 'Os dados enviados são inválidos.',
      details: [{ field, message: AREA_RULE_MESSAGE }],
    });
  }
}

@Injectable()
export class CropsService {
  private readonly logger = new Logger(CropsService.name);

  constructor(
    private readonly repository: CropsRepository,
    private readonly propertiesRepository: PropertiesRepository,
    private readonly harvestsRepository: HarvestsRepository,
  ) {}

  /**
   * A crop has two parents and both must exist.
   *
   * The property is addressed by the URL, so its absence is a 404 on the path - the convention
   * feature 002 established. The harvest arrives in the body, so its absence is a 404 raised from
   * a field, which is the one place this feature bends that convention (research.md R-003).
   */
  async create(propertyId: string, dto: CreateCropDto, actorId: string) {
    const property = await this.propertiesRepository.findById(propertyId);
    if (!property) {
      throw new NotFoundException(PROPERTY_NOT_FOUND);
    }

    const harvest = await this.harvestsRepository.findById(dto.harvestId);
    if (!harvest) {
      throw new NotFoundException(HARVEST_NOT_FOUND);
    }

    try {
      const crop = await this.repository.create(propertyId, dto.harvestId, dto.name);

      this.logger.log(
        { cropId: crop.id, propertyId, harvestId: dto.harvestId, actorId, event: 'crop.created' },
        'crop created',
      );

      return CropResponseDto.fromEntity(crop);
    } catch (error) {
      // The duplicate check IS the composite unique on (propertyId, harvestId, nameNormalized).
      // A pre-flight lookup would race (FR-013).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          { propertyId, harvestId: dto.harvestId, event: 'crop.duplicate' },
          'crop rejected: already recorded for this property and harvest',
        );
        throw new ConflictException(CROP_DUPLICATE);
      }
      throw error;
    }
  }

  async listByProperty(propertyId: string) {
    const property = await this.propertiesRepository.findById(propertyId);
    if (!property) {
      throw new NotFoundException(PROPERTY_NOT_FOUND);
    }
    return groupCropsByHarvest(await this.repository.listByProperty(propertyId));
  }

  async listByHarvest(harvestId: string) {
    const harvest = await this.harvestsRepository.findById(harvestId);
    if (!harvest) {
      throw new NotFoundException(HARVEST_NOT_FOUND);
    }
    const crops = await this.repository.listByHarvest(harvestId);
    return crops.map(CropResponseDto.fromEntity);
  }

  async remove(id: string, actorId: string): Promise<DeletionReportDto> {
    const crop = await this.repository.findById(id);
    if (!crop) {
      throw new NotFoundException(CROP_NOT_FOUND);
    }
    await this.repository.remove(id);
    this.logger.warn({ cropId: id, actorId, event: 'crop.deleted' }, 'crop deleted');
    return { deleted: { crops: 1 } };
  }
}
