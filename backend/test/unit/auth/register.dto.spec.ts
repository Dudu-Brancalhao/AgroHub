import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from '../../../src/auth/dto/register.dto';

function check(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, payload);
  return { dto, errors: validateSync(dto) };
}

const failingFields = (payload: Record<string, unknown>) =>
  check(payload).errors.map((e) => e.property);

describe('RegisterDto', () => {
  it('accepts a valid pair', () => {
    expect(check({ email: 'a@b.com.br', password: 'SenhaSegura1' }).errors).toHaveLength(0);
  });

  it('normalises the email by trimming and lowercasing (FR-004)', () => {
    const { dto } = check({ email: '  PRODUTOR@AgroHub.com.BR  ', password: 'SenhaSegura1' });
    expect(dto.email).toBe('produtor@agrohub.com.br');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(failingFields({ email: 'a@b.com', password: 'Ab1' })).toContain('password');
  });

  it.each([
    ['no digit', 'SenhaSemNumero'],
    ['no letter', '12345678'],
  ])('rejects a password with %s', (_label, password) => {
    expect(failingFields({ email: 'a@b.com', password })).toContain('password');
  });

  /**
   * The case this exists for: bcrypt truncates at 72 BYTES. A password of accented characters
   * reaches 72 bytes well before 72 characters, and everything past the cut is silently
   * discarded — so two different passwords would authenticate the same account.
   */
  it('measures the password limit in bytes, not characters', () => {
    const multibyte = 'ç'.repeat(40) + 'a1'; // 42 characters, 82 bytes
    expect(multibyte.length).toBeLessThan(72);
    expect(Buffer.byteLength(multibyte, 'utf8')).toBeGreaterThan(72);

    expect(failingFields({ email: 'a@b.com', password: multibyte })).toContain('password');
  });

  it('accepts a 72-byte password at the boundary', () => {
    const exact = 'a1' + 'b'.repeat(70); // exactly 72 bytes
    expect(Buffer.byteLength(exact, 'utf8')).toBe(72);
    expect(failingFields({ email: 'a@b.com', password: exact })).not.toContain('password');
  });

  it.each([['joao@'], ['joao agrohub.com.br'], ['joao@@agrohub'], ['']])(
    'rejects malformed email %p',
    (email) => {
      expect(failingFields({ email, password: 'SenhaSegura1' })).toContain('email');
    },
  );

  it('reports every failing field at once (FR-013)', () => {
    expect(failingFields({ email: 'nope', password: 'x' }).sort()).toEqual(['email', 'password']);
  });
});
