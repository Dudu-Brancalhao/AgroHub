import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * Reads the user that JwtStrategy.validate() attached to the request.
 *
 * Returns undefined rather than fabricating a user when none is present: on a route that somehow
 * escaped the guard, a fabricated user would be a privilege-escalation path.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return (request as Request & { user?: AuthenticatedUser }).user;
  },
);
