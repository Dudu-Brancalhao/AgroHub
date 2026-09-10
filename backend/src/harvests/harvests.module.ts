import { Module } from '@nestjs/common';
import { HarvestsController } from './harvests.controller';
import { HarvestsService } from './harvests.service';
import { HarvestsRepository } from './harvests.repository';

/**
 * A module of its own, rather than living inside PropertiesModule.
 *
 * Keeping harvest handling under properties would preserve exactly the misconception this feature
 * removes: that a harvest is something a property has.
 */
@Module({
  controllers: [HarvestsController],
  providers: [HarvestsService, HarvestsRepository],
  exports: [HarvestsRepository],
})
export class HarvestsModule {}
