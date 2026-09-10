import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginAttemptRepository } from './login-attempt.repository';

export interface AttemptStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * The per-identifier failed-attempt limit (FR-020, FR-022).
 *
 * This is a service, not a guard, because it is a business rule: it counts FAILURES and resets on
 * success, and it keys on a field inside the validated request body. Constitution II puts business
 * rules in the service layer. The per-origin request-rate limit is the guard's job instead
 * (research.md R-006).
 */
@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);

  constructor(
    private readonly repository: LoginAttemptRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Counts failures inside a ROLLING window.
   *
   * A `failedCount` column with a `windowStartedAt` would implement a FIXED window, letting an
   * attacker fire 5 attempts at the end of one window and 5 more at the start of the next — 10
   * within seconds, which is the exact behaviour FR-020 exists to prevent.
   */
  async check(emailKey: string): Promise<AttemptStatus> {
    const windowMs = this.windowMinutes() * 60_000;
    const since = new Date(Date.now() - windowMs);
    const failures = await this.repository.countSince(emailKey, since);

    if (failures < this.maxAttempts()) {
      return { limited: false, retryAfterSeconds: 0 };
    }

    const oldest = await this.repository.oldestSince(emailKey, since);
    const unblocksAt = (oldest?.getTime() ?? Date.now()) + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((unblocksAt - Date.now()) / 1000));

    this.logger.warn(
      { emailKey, failures, retryAfterSeconds, limit: 'per-identifier' },
      'login rate limit engaged',
    );

    return { limited: true, retryAfterSeconds };
  }

  async recordFailure(emailKey: string): Promise<void> {
    await this.repository.record(emailKey);
  }

  /** FR-022: a successful login clears the identifier's failure count. */
  async clear(emailKey: string): Promise<void> {
    await this.repository.deleteForEmail(emailKey);
  }

  private maxAttempts(): number {
    return this.configService.getOrThrow<number>('loginAttempt.maxAttempts');
  }

  private windowMinutes(): number {
    return this.configService.getOrThrow<number>('loginAttempt.windowMinutes');
  }
}
