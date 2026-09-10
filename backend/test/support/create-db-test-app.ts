import { INestApplication, LoggerService, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { buildValidationPipeOptions } from '../../src/common/validation/validation-pipe.options';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface DbTestApp {
  app: INestApplication;
  prisma: PrismaClient;
  moduleRef: TestingModule;
  /** Wipes the feature's tables between tests. Order matters only for readability — the cascade
   *  would handle it — but being explicit documents the hierarchy. */
  truncate: () => Promise<void>;
  /** A bearer header for a freshly registered account, since every route requires one. */
  authHeader: () => Promise<string>;
}

/**
 * Boots the real AppModule against the disposable Postgres.
 *
 * Feature 001's integration tests use an in-memory Prisma fake; this feature does not, because the
 * behaviour under test IS the database — cascade rollback, composite unique constraints, paging
 * with totals. A fake that got cascade rollback subtly wrong would report green while production
 * created orphans (research.md R-008).
 */
export async function createDbTestApp(logger: LoggerService | false = false): Promise<DbTestApp> {
  const url = process.env.PERSISTENCE_DATABASE_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication({ logger });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(buildValidationPipeOptions()));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const truncate = async (): Promise<void> => {
    // crops precede harvests: the relation restricts rather than cascades now, so the order
    // matters even inside a single TRUNCATE ... CASCADE.
    //
    // throttle_records and login_attempts are cleared too: they are persistent rate-limit state
    // from feature 001, and a row left blocked by an earlier run would refuse this one before a
    // single assertion ran.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE crops, harvests, properties, producers, throttle_records, login_attempts RESTART IDENTITY CASCADE',
    );
  };

  let counter = 0;
  const authHeader = async (): Promise<string> => {
    counter += 1;
    const email = `operador${counter}-${Date.now()}@agrohub.com.br`;
    const credentials = { email, password: 'SenhaSegura1' };
    await request(app.getHttpServer()).post('/api/auth/register').send(credentials).expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);
    return `Bearer ${login.body.accessToken}`;
  };

  return { app, prisma, moduleRef, truncate, authHeader };
}
