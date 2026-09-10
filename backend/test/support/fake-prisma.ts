import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';

interface LoginAttemptRow {
  id: string;
  emailKey: string;
  attemptedAt: Date;
}

interface ThrottleRow {
  key: string;
  hits: number;
  expiresAt: Date;
  blockedUntil: Date | null;
}

/**
 * In-memory stand-in for PrismaService, used by the tier-1 integration suite.
 *
 * Lets those tests exercise the REAL HTTP stack — routing, the global ValidationPipe, both
 * guards, the exception filter, the controllers, the services — with no database and no
 * container, so they are deterministic and fast (research.md R-009).
 *
 * It deliberately reproduces one database behaviour rather than mocking it away: `user.create`
 * throws a genuine P2002 on a duplicate email, because the 409 path depends on that error code.
 * The guarantee that the constraint actually holds under CONCURRENCY is not something this fake
 * can prove, which is exactly why test/persistence/ exists.
 */
export class FakePrismaService {
  private users = new Map<string, User>();
  private attempts: LoginAttemptRow[] = [];
  private throttles = new Map<string, ThrottleRow>();

  reset(): void {
    this.users.clear();
    this.attempts = [];
    this.throttles.clear();
  }

  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  user = {
    create: async ({ data }: { data: { email: string; passwordHash: string } }): Promise<User> => {
      const existing = [...this.users.values()].find((u) => u.email === data.email);
      if (existing) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['email'] },
        });
      }
      const now = new Date();
      const user: User = {
        id: randomUUID(),
        email: data.email,
        passwordHash: data.passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(user.id, user);
      return user;
    },

    findUnique: async ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<User | null> => {
      if (where.id) {
        return this.users.get(where.id) ?? null;
      }
      if (where.email) {
        return [...this.users.values()].find((u) => u.email === where.email) ?? null;
      }
      return null;
    },
  };

  loginAttempt = {
    create: async ({ data }: { data: { emailKey: string } }): Promise<LoginAttemptRow> => {
      const row = { id: randomUUID(), emailKey: data.emailKey, attemptedAt: new Date() };
      this.attempts.push(row);
      return row;
    },

    count: async ({
      where,
    }: {
      where: { emailKey: string; attemptedAt: { gt: Date } };
    }): Promise<number> =>
      this.attempts.filter(
        (a) => a.emailKey === where.emailKey && a.attemptedAt > where.attemptedAt.gt,
      ).length,

    findFirst: async ({
      where,
    }: {
      where: { emailKey: string; attemptedAt: { gt: Date } };
    }): Promise<{ attemptedAt: Date } | null> => {
      const matches = this.attempts
        .filter((a) => a.emailKey === where.emailKey && a.attemptedAt > where.attemptedAt.gt)
        .sort((a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime());
      return matches[0] ? { attemptedAt: matches[0].attemptedAt } : null;
    },

    deleteMany: async ({
      where,
    }: {
      where: { emailKey?: string; attemptedAt?: { lt: Date } };
    }): Promise<{ count: number }> => {
      const before = this.attempts.length;
      this.attempts = this.attempts.filter((a) => {
        if (where.emailKey !== undefined) return a.emailKey !== where.emailKey;
        if (where.attemptedAt !== undefined) return a.attemptedAt >= where.attemptedAt.lt;
        return false;
      });
      return { count: before - this.attempts.length };
    },
  };

  throttleRecord = {
    findUnique: async ({ where }: { where: { key: string } }): Promise<ThrottleRow | null> =>
      this.throttles.get(where.key) ?? null,

    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { key: string };
      create: ThrottleRow;
      update: Partial<ThrottleRow>;
    }): Promise<ThrottleRow> => {
      const existing = this.throttles.get(where.key);
      const row = existing ? { ...existing, ...update } : { ...create };
      this.throttles.set(where.key, row);
      return row;
    },

    update: async ({
      where,
      data,
    }: {
      where: { key: string };
      data: { hits?: { increment: number }; blockedUntil?: Date | null };
    }): Promise<ThrottleRow> => {
      const row = this.throttles.get(where.key);
      if (!row) {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        });
      }
      if (data.hits?.increment) row.hits += data.hits.increment;
      if (data.blockedUntil !== undefined) row.blockedUntil = data.blockedUntil;
      this.throttles.set(where.key, row);
      return row;
    },

    deleteMany: async (): Promise<{ count: number }> => ({ count: 0 }),
  };
}
