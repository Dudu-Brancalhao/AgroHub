import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaThrottlerStorage } from './prisma-throttler.storage';

const RATE_LIMITED = 'Muitas tentativas. Tente novamente em alguns minutos.';

/**
 * A stricter, register-only request limit on top of the global per-origin one.
 *
 * Why registration needs its own, tighter bucket: the 409 on a duplicate address is an
 * account-existence oracle. Login was deliberately built so it cannot be used to discover which
 * addresses are registered (identical messages, dummy-hash timing parity, identical 429s), and
 * registration gives the same fact away for one request per address - no password guess needed.
 *
 * At the global 20/min this is ~28,800 addresses per day per origin. At 5/min it is ~7,200, and
 * nobody legitimate creates accounts in series, so the cost lands entirely on the attacker.
 *
 * This does not remove the oracle - only enumeration by another channel would - but it makes
 * farming it four times more expensive without touching the flow for real users.
 *
 * Written as a purpose-built guard rather than a second @nestjs/throttler entry because named
 * throttlers apply to every route unless individually skipped, which would mean annotating every
 * present and future controller to opt out. It shares PrismaThrottlerStorage, so the counter is
 * still shared across instances (FR-024).
 */
@Injectable()
export class RegisterRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RegisterRateLimitGuard.name);

  constructor(
    private readonly storage: PrismaThrottlerStorage,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.ip ?? request.socket?.remoteAddress ?? 'unknown';

    const ttlMs = this.configService.getOrThrow<number>('registerThrottle.ttlSeconds') * 1000;
    const limit = this.configService.getOrThrow<number>('registerThrottle.limit');

    const record = await this.storage.increment(origin, ttlMs, limit, ttlMs, 'register');

    if (record.isBlocked || record.totalHits > limit) {
      const retryAfterSeconds = Math.max(1, record.timeToBlockExpire || record.timeToExpire);

      this.logger.warn(
        { origin, hits: record.totalHits, limit, retryAfterSeconds, limiter: 'register' },
        'registration rate limit engaged',
      );

      // Same status, same message, same header as every other limit, so a caller cannot tell
      // which limiter fired (FR-023).
      throw new HttpException(
        { message: RATE_LIMITED, retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
