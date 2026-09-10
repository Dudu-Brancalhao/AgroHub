import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '../../../src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../src/auth/types/authenticated-user';

type ParamFactory = (data: unknown, ctx: ExecutionContext) => AuthenticatedUser | undefined;

/**
 * Reaches the factory Nest actually calls at request time.
 *
 * createParamDecorator stores it in ROUTE_ARGS_METADATA on the decorated class, so applying the
 * decorator to a throwaway method and reading that metadata tests the real function rather than
 * a reimplementation of it.
 */
function paramFactory(): ParamFactory {
  class Probe {
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    handler(@CurrentUser() _user: AuthenticatedUser | undefined): void {}
  }

  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler') as Record<
    string,
    { factory: ParamFactory }
  >;

  return metadata[Object.keys(metadata)[0]].factory;
}

function contextWith(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('@CurrentUser', () => {
  const factory = paramFactory();

  it('returns the user the strategy attached to the request', () => {
    const user = { id: 'u1', email: 'produtor@agrohub.com.br' };
    expect(factory(undefined, contextWith({ user }))).toEqual(user);
  });

  it('returns undefined rather than fabricating a user when none is present', () => {
    // On a route that somehow escaped the guard, a fabricated user would be a
    // privilege-escalation path. The controller turns undefined into a 401.
    expect(factory(undefined, contextWith({}))).toBeUndefined();
  });
});
