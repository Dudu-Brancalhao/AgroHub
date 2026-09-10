import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../../../src/auth/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeAll(async () => {
    const config = { getOrThrow: () => 4 } as unknown as ConfigService;
    service = new PasswordService(config);
    await service.onModuleInit();
  });

  it('produces a bcrypt hash', async () => {
    const hash = await service.hash('SenhaSegura1');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain('SenhaSegura1');
  });

  it('salts each hash individually, so identical passwords differ in storage', async () => {
    const [a, b] = await Promise.all([service.hash('SenhaSegura1'), service.hash('SenhaSegura1')]);
    expect(a).not.toBe(b);
    await expect(service.compare('SenhaSegura1', a)).resolves.toBe(true);
    await expect(service.compare('SenhaSegura1', b)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('SenhaSegura1');
    await expect(service.compare('SenhaErrada1', hash)).resolves.toBe(false);
  });

  it('compareWithDummy always reports failure but still does the work', async () => {
    await expect(service.compareWithDummy('qualquer')).resolves.toBe(false);
  });

  /**
   * The dummy hash must never be a real password's hash, and must not be a fixed constant that
   * could be recognised in a memory dump or a leaked build.
   */
  it('derives the dummy hash from a random value at startup', async () => {
    const other = new PasswordService({ getOrThrow: () => 4 } as unknown as ConfigService);
    await other.onModuleInit();

    const a = (service as unknown as { dummyHash: string }).dummyHash;
    const b = (other as unknown as { dummyHash: string }).dummyHash;

    expect(a).toMatch(/^\$2[aby]\$/);
    expect(a).not.toBe(b);
  });
});
