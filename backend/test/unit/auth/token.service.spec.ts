import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { TokenService } from '../../../src/auth/token.service';

const SECRET = 'a-secret-that-is-at-least-32-characters';

function buildService(expiresIn = '1h'): TokenService {
  const jwtService = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: expiresIn as jwt.SignOptions['expiresIn'], algorithm: 'HS256' },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const config = {
    getOrThrow: (key: string) => (key === 'jwt.secret' ? SECRET : expiresIn),
  } as unknown as ConfigService;

  return new TokenService(jwtService, config);
}

describe('TokenService', () => {
  const user = { id: 'user-1', email: 'produtor@agrohub.com.br' };

  it('issues a verifiable token carrying sub, email and jti', async () => {
    const service = buildService();
    const { accessToken, expiresIn } = await service.issue(user);

    expect(expiresIn).toBe(3600);

    const payload = await service.verify(accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.jti).toEqual(expect.any(String));
  });

  it('rejects a tampered payload', async () => {
    const service = buildService();
    const { accessToken } = await service.issue(user);
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', email: 'attacker@x.com', jti: 'f' }),
    ).toString('base64url');

    await expect(service.verify(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow();
  });

  it('rejects an expired token (FR-018)', async () => {
    const service = buildService('-1s');
    const { accessToken } = await service.issue(user);
    await expect(service.verify(accessToken)).rejects.toThrow(/expired/i);
  });

  it('rejects a token signed with a different secret', async () => {
    const service = buildService();
    const forged = jwt.sign({ sub: user.id, email: user.email, jti: 'x' }, 'another-secret-value', {
      algorithm: 'HS256',
    });
    await expect(service.verify(forged)).rejects.toThrow();
  });

  /**
   * Algorithm confusion. Without algorithms: ['HS256'] pinned on the VERIFY side, a token is
   * trusted to nominate how it should be checked - the classic alg:none forgery.
   */
  it('rejects a token that nominates a different algorithm', async () => {
    const service = buildService();
    const unsigned =
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
      '.' +
      Buffer.from(JSON.stringify({ sub: user.id, email: user.email, jti: 'x' })).toString(
        'base64url',
      ) +
      '.';

    await expect(service.verify(unsigned)).rejects.toThrow();
  });

  it.each([
    ['1h', 3600],
    ['30m', 1800],
    ['7d', 604800],
    ['45s', 45],
    ['900', 900],
  ])('converts %s to %i seconds for the response', (raw, expected) => {
    expect(buildService(raw as string).expiresInSeconds()).toBe(expected);
  });
});
