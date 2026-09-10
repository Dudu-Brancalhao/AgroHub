import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser, JwtPayload } from './types/authenticated-user';

export interface IssuedToken {
  accessToken: string;
  expiresIn: number;
}

/**
 * Signs and verifies access tokens.
 *
 * `expiresIn` is configured once in JwtModule (auth.module.ts) rather than passed per call, so no
 * call site can accidentally mint a longer-lived token. The algorithm is pinned to HS256 on BOTH
 * sign and verify: leaving verification open is what permits algorithm-confusion forgery
 * (research.md R-004).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issue(user: AuthenticatedUser): Promise<IssuedToken> {
    const payload: JwtPayload = { sub: user.id, email: user.email, jti: randomUUID() };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, expiresIn: this.expiresInSeconds() };
  }

  async verify(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.secret'),
      algorithms: ['HS256'],
    });
  }

  /** Token lifetime in seconds, for the `expiresIn` field of the login response (FR-011). */
  expiresInSeconds(): number {
    const raw = this.configService.getOrThrow<string>('jwt.expiresIn');
    const match = /^(\d+)([smhd])?$/.exec(raw.trim());
    if (!match) {
      return 3600;
    }
    const value = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
