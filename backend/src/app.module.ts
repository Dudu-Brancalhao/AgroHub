import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlingModule } from './throttling/throttling.module';
import { ProducersModule } from './producers/producers.module';
import { PropertiesModule } from './properties/properties.module';
import { HarvestsModule } from './harvests/harvests.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaThrottlerStorage } from './throttling/prisma-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Fail fast. The app must not start with a missing or too-short JWT_SECRET.
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel') ?? 'info',
          // Mechanical backstop to FR-025, alongside never passing these to a logger in the
          // first place. Belt and braces: one of the two will still be there after a refactor.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'password',
              'passwordHash',
              'accessToken',
              // Feature 002: CPF/CNPJ is personal data under the LGPD, and a log aggregator is
              // exactly where it must not accumulate. Producers are logged by id (FR-038).
              'document',
              'nameSearch',
              'cpf',
              'cnpj',
              '*.document',
              '*.nameSearch',
              '*.password',
              '*.passwordHash',
              '*.accessToken',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ThrottlingModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlingModule],
      inject: [ConfigService, PrismaThrottlerStorage],
      useFactory: (config: ConfigService, storage: PrismaThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('throttle.ttlSeconds') * 1000,
            limit: config.getOrThrow<number>('throttle.limit'),
          },
        ],
        storage,
      }),
    }),
    AuthModule,
    ProducersModule,
    PropertiesModule,
    HarvestsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters. ThrottlerGuard runs first so an unauthenticated flood is refused before any
    // token work happens; JwtAuthGuard then denies everything not marked @Public()
    // (research.md R-007).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
