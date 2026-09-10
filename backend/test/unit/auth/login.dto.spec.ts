import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from '../../../src/auth/dto/login.dto';

const failingFields = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(LoginDto, payload)).map((e) => e.property);

describe('LoginDto (FR-012, FR-014)', () => {
  it('accepts a valid pair', () => {
    expect(failingFields({ email: 'a@b.com.br', password: 'qualquer' })).toHaveLength(0);
  });

  it('normalises the email like registration does', () => {
    const dto = plainToInstance(LoginDto, { email: ' A@B.COM ', password: 'x' });
    expect(dto.email).toBe('a@b.com');
  });

  it.each([
    ['missing password', { email: 'a@b.com' }],
    ['empty password', { email: 'a@b.com', password: '' }],
    ['missing email', { password: 'x' }],
    ['empty body', {}],
  ])('rejects %s before any account lookup', (_label, payload) => {
    expect(failingFields(payload).length).toBeGreaterThan(0);
  });

  // Login must NOT re-apply the registration password policy: doing so would reject a valid
  // legacy password and tell an attacker which password shapes exist.
  it('does not apply the registration password policy at login', () => {
    expect(failingFields({ email: 'a@b.com', password: 'short' })).toHaveLength(0);
  });
});
