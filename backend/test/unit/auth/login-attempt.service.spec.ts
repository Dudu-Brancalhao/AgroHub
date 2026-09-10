import { ConfigService } from '@nestjs/config';
import { LoginAttemptRepository } from '../../../src/auth/login-attempt.repository';
import { LoginAttemptService } from '../../../src/auth/login-attempt.service';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

/** Repository backed by a plain array, so the window arithmetic is what is under test. */
function repositoryWith(timestamps: Date[]): LoginAttemptRepository {
  return {
    countSince: async (_key: string, since: Date) => timestamps.filter((t) => t > since).length,
    oldestSince: async (_key: string, since: Date) =>
      timestamps.filter((t) => t > since).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    record: jest.fn(),
    deleteForEmail: jest.fn(),
  } as unknown as LoginAttemptRepository;
}

const config = {
  getOrThrow: (key: string) => (key === 'loginAttempt.maxAttempts' ? MAX_ATTEMPTS : WINDOW_MINUTES),
} as unknown as ConfigService;

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

describe('LoginAttemptService (FR-020)', () => {
  it('permits attempts below the threshold', async () => {
    const service = new LoginAttemptService(repositoryWith([minutesAgo(1), minutesAgo(2)]), config);
    await expect(service.check('a@b.com')).resolves.toMatchObject({ limited: false });
  });

  it('limits once the threshold is reached inside the window', async () => {
    const service = new LoginAttemptService(repositoryWith([1, 2, 3, 4, 5].map(minutesAgo)), config);

    const status = await service.check('a@b.com');
    expect(status.limited).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  /**
   * These two cases are why failures are stored as timestamped rows rather than a counter column.
   *
   * A FIXED window would let an attacker fire 5 attempts at the end of one window and 5 more at
   * the start of the next - 10 within seconds. The cases differ only in how old the failures are,
   * and they must produce different answers.
   */
  describe('rolling window', () => {
    it('counts 5 failures from 14 minutes ago as still inside the window', async () => {
      const service = new LoginAttemptService(
        repositoryWith([14, 14, 14, 14, 14].map(minutesAgo)),
        config,
      );
      await expect(service.check('a@b.com')).resolves.toMatchObject({ limited: true });
    });

    it('lets 5 failures from 16 minutes ago fall out of the window', async () => {
      const service = new LoginAttemptService(
        repositoryWith([16, 16, 16, 16, 16].map(minutesAgo)),
        config,
      );
      await expect(service.check('a@b.com')).resolves.toMatchObject({ limited: false });
    });

    it('bases retry time on when the OLDEST failure leaves the window', async () => {
      const service = new LoginAttemptService(
        repositoryWith([10, 3, 2, 1, 1].map(minutesAgo)),
        config,
      );

      const { retryAfterSeconds } = await service.check('a@b.com');
      // Oldest is 10 minutes old, so roughly 5 minutes of the 15-minute window remain.
      expect(retryAfterSeconds).toBeGreaterThan(4 * 60);
      expect(retryAfterSeconds).toBeLessThanOrEqual(5 * 60 + 2);
    });
  });

  it('clears the count on success (FR-022)', async () => {
    const repository = repositoryWith([]);
    const service = new LoginAttemptService(repository, config);

    await service.clear('a@b.com');
    expect(repository.deleteForEmail).toHaveBeenCalledWith('a@b.com');
  });
});
