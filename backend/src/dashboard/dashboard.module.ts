import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

/**
 * Kept separate from ProducersModule and PropertiesModule on purpose: the dashboard reads across
 * producers, properties, harvests and crops at once, so folding it into any one of them would make
 * that module the owner of a concern spanning all of them. It is also entirely read-only, and a
 * separate module makes that visible at a glance.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
