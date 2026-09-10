import { AuthService } from '../../../src/auth/auth.service';
import { PasswordService } from '../../../src/auth/password.service';
import { TokenService } from '../../../src/auth/token.service';
import { LoginAttemptService } from '../../../src/auth/login-attempt.service';
import { UsersRepository } from '../../../src/users/users.repository';

/**
 * FR-010. The natural implementation returns early when the account lookup misses, so a wrong
 * password costs a ~250ms bcrypt comparison and an unknown email costs ~2ms. That gap is
 * measurable over a handful of requests and turns login into an account-existence oracle,
 * defeating FR-009's identical message entirely (research.md R-003).
 *
 * Asserting on the CALL rather than on wall-clock timing keeps this deterministic in CI, where
 * timing assertions are flaky. What it pins down is the branch that must not be skipped.
 */
describe('Login timing parity on the account-miss path', () => {
  const compare = jest.fn().mockResolvedValue(false);
  const compareWithDummy = jest.fn().mockResolvedValue(false);

  const passwordService = { compare, compareWithDummy } as unknown as PasswordService;
  const tokenService = {} as TokenService;

  const loginAttemptService = {
    check: jest.fn().mockResolvedValue({ limited: false, retryAfterSeconds: 0 }),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  } as unknown as LoginAttemptService;

  beforeEach(() => jest.clearAllMocks());

  function serviceWith(user: unknown) {
    const usersRepository = {
      findByEmail: jest.fn().mockResolvedValue(user),
    } as unknown as UsersRepository;
    return new AuthService(usersRepository, passwordService, tokenService, loginAttemptService);
  }

  it('still runs a bcrypt comparison when no account matches', async () => {
    const service = serviceWith(null);

    await expect(service.validateCredentials('fantasma@agrohub.com.br', 'x')).rejects.toThrow();

    expect(compareWithDummy).toHaveBeenCalledTimes(1);
    expect(compare).not.toHaveBeenCalled();
  });

  it('runs a real comparison when an account matches', async () => {
    const service = serviceWith({ id: '1', email: 'a@b.com', passwordHash: '$2b$04$hash' });

    await expect(service.validateCredentials('a@b.com', 'x')).rejects.toThrow();

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compareWithDummy).not.toHaveBeenCalled();
  });

  it('records a failure on both paths, so the limiter sees attacks on unknown emails too', async () => {
    await expect(serviceWith(null).validateCredentials('ghost@x.com', 'y')).rejects.toThrow();
    expect(loginAttemptService.recordFailure).toHaveBeenCalledWith('ghost@x.com');
  });

  it('throws the identical message on both paths (FR-009)', async () => {
    const miss = await serviceWith(null)
      .validateCredentials('ghost@x.com', 'y')
      .catch((e: Error) => e.message);
    const wrong = await serviceWith({ id: '1', email: 'a@b.com', passwordHash: '$2b$04$h' })
      .validateCredentials('a@b.com', 'y')
      .catch((e: Error) => e.message);

    expect(miss).toBe(wrong);
  });
});
