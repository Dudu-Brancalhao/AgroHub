import { INestApplication, LoggerService, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { buildValidationPipeOptions } from '../../src/common/validation/validation-pipe.options';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FakePrismaService } from './fake-prisma';

export interface TestApp {
  app: INestApplication;
  prisma: FakePrismaService;
  moduleRef: TestingModule;
}

/**
 * Boots the real AppModule with only PrismaService swapped out.
 *
 * Everything the request actually passes through is genuine: the global prefix, the
 * ValidationPipe built by the same factory main.ts uses, both APP_GUARDs, and the exception
 * filter. A suite that assembled its own pipe would prove nothing about the configured one.
 */
export async function createTestApp(
  extraImports: unknown[] = [],
  logger: LoggerService | false = false,
): Promise<TestApp> {
  const prisma = new FakePrismaService();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extraImports as never[])],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication({ logger });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(buildValidationPipeOptions()));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return { app, prisma, moduleRef };
}
