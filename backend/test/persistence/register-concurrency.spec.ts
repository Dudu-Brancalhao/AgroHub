import { PrismaClient } from '@prisma/client';

/**
 * FR-002 under concurrency.
 *
 * This is the one guarantee a faked repository cannot verify, because the guarantee IS the unique
 * constraint. Mocking it would produce a test that passes while the real behaviour is broken -
 * worse than no test at all (research.md R-009).
 *
 * Requires the disposable Postgres:
 *   docker compose -f docker-compose.test.yml up -d
 */
describe('Unique email constraint under concurrency (FR-002)', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.PERSISTENCE_DATABASE_URL ?? process.env.DATABASE_URL } },
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('creates exactly one account when N registrations race for the same address', async () => {
    const email = 'corrida@agrohub.com.br';
    const attempts = 10;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        prisma.user.create({ data: { email, passwordHash: '$2b$04$placeholder' } }),
      ),
    );

    const created = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(attempts - 1);

    const rows = await prisma.user.count({ where: { email } });
    expect(rows).toBe(1);
  });

  it('rejects the loser with P2002, which is what the 409 path depends on', async () => {
    const email = 'duplicado@agrohub.com.br';
    await prisma.user.create({ data: { email, passwordHash: '$2b$04$placeholder' } });

    await expect(
      prisma.user.create({ data: { email, passwordHash: '$2b$04$outro' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('treats differently-cased addresses as distinct at the DB layer', async () => {
    // Normalisation is the application's job (FR-004); Postgres compares case-sensitively. This
    // records the division of responsibility - if normalisation were ever dropped from the DTO,
    // the constraint alone would NOT save us.
    await prisma.user.create({
      data: { email: 'caso@agrohub.com.br', passwordHash: '$2b$04$a' },
    });
    await expect(
      prisma.user.create({ data: { email: 'CASO@agrohub.com.br', passwordHash: '$2b$04$b' } }),
    ).resolves.toBeDefined();
  });
});
