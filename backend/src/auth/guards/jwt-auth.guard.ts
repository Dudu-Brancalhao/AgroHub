import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Registered as an APP_GUARD, so every route is protected unless it carries @Public().
 *
 * getAllAndOverride (rather than get) checks handler then class, which lets a controller be
 * opened wholesale while an individual handler stays protected.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Passport throws its own UnauthorizedException carrying the English string "Unauthorized",
   * which then flows through our envelope to the caller. Every other message this API returns is
   * pt-BR (Constitution VIII), so the default is replaced here.
   *
   * The message stays deliberately uniform across every rejection reason — absent header,
   * malformed token, wrong signature, expired token. Distinguishing them would tell an attacker
   * which part of a forged credential to fix next; the real reason is available in the log under
   * the requestId the caller was given.
   */
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Autenticação necessária.');
    }
    return user;
  }
}
