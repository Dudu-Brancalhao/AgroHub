import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The only place Prisma is touched for LoginAttempt (Constitution II). */
@Injectable()
export class LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(emailKey: string): Promise<void> {
    await this.prisma.loginAttempt.create({ data: { emailKey } });
  }

  async countSince(emailKey: string, since: Date): Promise<number> {
    return this.prisma.loginAttempt.count({
      where: { emailKey, attemptedAt: { gt: since } },
    });
  }

  async oldestSince(emailKey: string, since: Date): Promise<Date | null> {
    const row = await this.prisma.loginAttempt.findFirst({
      where: { emailKey, attemptedAt: { gt: since } },
      orderBy: { attemptedAt: 'asc' },
      select: { attemptedAt: true },
    });
    return row?.attemptedAt ?? null;
  }

  async deleteForEmail(emailKey: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({ where: { emailKey } });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.loginAttempt.deleteMany({
      where: { attemptedAt: { lt: cutoff } },
    });
    return count;
  }
}
