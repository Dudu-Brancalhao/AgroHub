import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prunes expired rate-limit rows.
 *
 * Not housekeeping. `login_attempts` gains a row on every failed login, and unauthenticated
 * callers control that rate — left unpruned it is the fastest-growing table in the system and a
 * denial-of-service surface. The window also doubles as the retention limit for the attempted
 * addresses the table holds.
 */
@Injectable()
export class ThrottleCleanupService {
  private readonly logger = new Logger(ThrottleCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async prune(): Promise<void> {
    const windowMinutes = this.configService.getOrThrow<number>('loginAttempt.windowMinutes');
    const cutoff = new Date(Date.now() - windowMinutes * 60_000);

    const attempts = await this.prisma.loginAttempt.deleteMany({
      where: { attemptedAt: { lt: cutoff } },
    });
    const records = await this.prisma.throttleRecord.deleteMany({
      where: { expiresAt: { lt: new Date() }, blockedUntil: null },
    });

    this.logger.log(
      { loginAttempts: attempts.count, throttleRecords: records.count, event: 'throttle.pruned' },
      'pruned expired rate-limit rows',
    );
  }
}
