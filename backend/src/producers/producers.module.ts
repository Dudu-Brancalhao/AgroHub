import { Module } from '@nestjs/common';
import { ProducersController } from './producers.controller';
import { ProducersService } from './producers.service';
import { ProducersRepository } from './producers.repository';

@Module({
  controllers: [ProducersController],
  providers: [ProducersService, ProducersRepository],
  exports: [ProducersRepository],
})
export class ProducersModule {}
