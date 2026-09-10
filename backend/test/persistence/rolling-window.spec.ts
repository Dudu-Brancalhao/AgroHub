import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { LoginAttemptRepository } from '../../src/auth/login-attempt.repository';
import { LoginAttemptService } from '../../src/auth/login-attempt.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * FR-020 and FR-024 against real Postgres.
 *
 * Two things are verified here that the in-memory fake cannot show: that the
 * (email_key, attempted_at) query returns correct counts across the window boundary, and that a
 * counter written through one connection is visible to another - which is what "shared across
 * instances" actually means (research.md R-009).
 */
describe('Rolling window and shared counters (FR-020, FR-024)', () => {
  const url = process.env.PERSISTENCE_DATABASE_URL ?? process.env.DATABASE_URL;

  const clientA = new PrismaClient({ datasources: { db: { url } } });
  const clientB = new PrismaClient({ datasources: { db: { url } } });

  const config = {
    getOrThrow: (key: string) => (key === 'loginAttempt.maxAttempts' ? 5 : 15),
  } as unknown as ConfigService;

  const repositoryA = new LoginAttemptRepository(clientA as unknown as PrismaService);
  const repositoryB = new LoginAttemptRepository(clientB as unknown as PrismaService);
  const serviceB = new LoginAttemptService(repositoryB, config);

  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

  beforeAll(async () => {
    await Promise.all([clientA.$connect(), clientB.$connect()]);
  });

  afterAll(async () => {
    await Promise.all([clientA.$disconnect(), clientB.$disconnect()]);
  });

  beforeEach(async () => {
    await clientA.loginAttempt.deleteMany();
  });

  async function seed(emailKey: string, ages: number[]): Promise<void> {
    await clientA.loginAttempt.createMany({
      data: ages.map((minutes) => ({ emailKey, attemptedAt: minutesAgo(minutes) })),
    });
  }

  it('counts only failures inside the window', async () => {
    await seed('janela@agrohub.com.br', [1, 5, 14, 16, 30]);

    const inWindow = await repositoryA.countSince('janela@agrohub.com.br', minutesAgo(15));
    expect(inWindow).toBe(3);
  });

  it('distinguishes 14-minute-old failures from 16-minute-old ones', async () => {
    await seed('borda@agrohub.com.br', [14, 14, 14, 14, 14]);
    await expect(serviceB.check('borda@agrohub.com.br')).resolves.toMatchObject({ limited: true });

    await clientA.loginAttempt.deleteMany();
    await seed('borda@agrohub.com.br', [16, 16, 16, 16, 16]);
    await expect(serviceB.check('borda@agrohub.com.br')).resolves.toMatchObject({ limited: false });
  });

  // FR-024: a limit that resets because a different instance served the request is no limit.
  it('sees counters written through a different connection', async () => {
    const email = 'compartilhado@agrohub.com.br';

    for (let i = 0; i < 5; i += 1) {
      await repositoryA.record(email);
    }

    await expect(serviceB.check(email)).resolves.toMatchObject({ limited: true });
  });

  it('clears the counter for one identifier without touching others', async () => {
    await seed('alvo@agrohub.com.br', [1, 2, 3, 4, 5]);
    await seed('outro@agrohub.com.br', [1, 2, 3, 4, 5]);

    await repositoryA.deleteForEmail('alvo@agrohub.com.br');

    await expect(serviceB.check('alvo@agrohub.com.br')).resolves.toMatchObject({ limited: false });
    await expect(serviceB.check('outro@agrohub.com.br')).resolves.toMatchObject({ limited: true });
  });

  it('prunes rows older than the window', async () => {
    await seed('limpeza@agrohub.com.br', [1, 20, 40]);

    const removed = await repositoryA.deleteOlderThan(minutesAgo(15));
    expect(removed).toBe(2);
    expect(await clientA.loginAttempt.count()).toBe(1);
  });
});
