import { Module } from '@nestjs/common';
import { CropsController, PropertiesController } from './properties.controller';
import { CropsService, PropertiesService } from './properties.service';
import { CropsRepository, PropertiesRepository } from './properties.repository';
import { ProducersModule } from '../producers/producers.module';
import { HarvestsModule } from '../harvests/harvests.module';

/**
 * Properties and crops live together because the property OWNS the crop - a crop dies with its
 * farm. Harvests moved to their own module: they belong to nobody, and keeping them here would
 * preserve exactly the misconception this restructure removes.
 */
@Module({
  imports: [ProducersModule, HarvestsModule],
  controllers: [PropertiesController, CropsController],
  providers: [PropertiesService, CropsService, PropertiesRepository, CropsRepository],
  exports: [PropertiesRepository, CropsRepository],
})
export class PropertiesModule {}
