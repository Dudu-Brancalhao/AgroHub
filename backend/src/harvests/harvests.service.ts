import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Harvest, Prisma } from '@prisma/client';
import { HarvestsRepository } from './harvests.repository';
import { HarvestResponseDto } from './dto/harvest-response.dto';
import { CreateHarvestDto } from './dto/create-harvest.dto';

const NOT_FOUND = 'Safra não encontrada.';

@Injectable()
export class HarvestsService {
  private readonly logger = new Logger(HarvestsService.name);

  constructor(private readonly repository: HarvestsRepository) {}

  async create(dto: CreateHarvestDto, actorId: string): Promise<HarvestResponseDto> {
    try {
      const harvest = await this.repository.create(dto.year);

      this.logger.log(
        { harvestId: harvest.id, year: harvest.year, actorId, event: 'harvest.created' },
        'harvest created',
      );

      return HarvestResponseDto.fromEntity(harvest);
    } catch (error) {
      throw this.translateDuplicateYear(error, dto.year);
    }
  }

  async findAll(): Promise<HarvestResponseDto[]> {
    const harvests = await this.repository.findAll();
    return harvests.map(HarvestResponseDto.fromEntity);
  }

  async findOne(id: string): Promise<HarvestResponseDto> {
    return HarvestResponseDto.fromEntity(await this.requireHarvest(id));
  }

  /**
   * FR-009: correcting a harvest reaches every property with crops in it, and touches no property
   * record. That is the whole point of the season being shared — there is one row to correct.
   */
  async update(id: string, dto: CreateHarvestDto, actorId: string): Promise<HarvestResponseDto> {
    await this.requireHarvest(id);

    try {
      const harvest = await this.repository.update(id, dto.year);
      this.logger.log(
        { harvestId: id, year: harvest.year, actorId, event: 'harvest.updated' },
        'harvest updated',
      );
      return HarvestResponseDto.fromEntity(harvest);
    } catch (error) {
      throw this.translateDuplicateYear(error, dto.year);
    }
  }

  /**
   * Refuses while any crop references the harvest, and says how many are blocking (FR-010).
   *
   * This is the most consequential rule in the feature. A harvest is shared, so cascading here
   * would let one request erase a year across every farm in the registry — a far larger blast
   * radius than the per-property harvest it replaces. The database enforces it with RESTRICT; this
   * count exists so the caller is told what to clear first rather than just being refused.
   */
  async remove(id: string, actorId: string): Promise<{ deleted: { harvests: number } }> {
    await this.requireHarvest(id);

    const { deleted, blockingCrops } = await this.repository.removeIfUnused(id);

    if (!deleted) {
      this.logger.warn(
        { harvestId: id, actorId, blockingCrops, event: 'harvest.delete.refused' },
        'harvest deletion refused: crops still reference it',
      );
      // Singular and plural, because "existem 1 culturas" reads as broken Portuguese to the
      // stakeholders this message is written for (Constitution VIII), and a refusal is exactly
      // the moment someone reads it closely.
      const cultures =
        blockingCrops === 1 ? 'existe 1 cultura registrada' : `existem ${blockingCrops} culturas registradas`;
      throw new ConflictException(`Não é possível excluir esta safra: ${cultures} nela.`);
    }

    this.logger.warn({ harvestId: id, actorId, event: 'harvest.deleted' }, 'harvest deleted');

    return { deleted: { harvests: 1 } };
  }

  private async requireHarvest(id: string): Promise<Harvest> {
    const harvest = await this.repository.findById(id);
    if (!harvest) {
      throw new NotFoundException(NOT_FOUND);
    }
    return harvest;
  }

  /**
   * The duplicate check IS the unique constraint on the year. A pre-flight lookup would be a
   * check-then-insert race, exactly as it would be for a producer document.
   */
  private translateDuplicateYear(error: unknown, year: number): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      this.logger.warn({ year, event: 'harvest.year.duplicate' }, 'harvest rejected: year taken');
      return new ConflictException(`Já existe uma safra cadastrada para o ano ${year}.`);
    }
    return error;
  }
}
