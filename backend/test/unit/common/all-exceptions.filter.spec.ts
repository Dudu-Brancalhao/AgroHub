import { ArgumentsHost, BadRequestException, ConflictException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';

function hostFor(method = 'POST', url = '/api/auth/login') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const getHeader = jest.fn().mockReturnValue(undefined);

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json, setHeader, getHeader }),
      getRequest: () => ({ method, url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, setHeader };
}

describe('AllExceptionsFilter (FR-025)', () => {
  const filter = new AllExceptionsFilter();

  it('never echoes an unexpected error message or stack to the caller', () => {
    const { host, status, json } = hostFor();
    const leaky = new Error('connect ECONNREFUSED postgresql://agrohub:hunter2@db:5432');

    filter.catch(leaky, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Erro interno. Tente novamente mais tarde.');

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('ECONNREFUSED');
    expect(body.stack).toBeUndefined();
  });

  it('emits the documented envelope shape with a correlating requestId', () => {
    const { host, json } = hostFor();
    filter.catch(new UnauthorizedException('E-mail ou senha inválidos.'), host);

    const body = json.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual([
      'error',
      'message',
      'path',
      'requestId',
      'statusCode',
      'timestamp',
    ]);
    expect(body.requestId).toEqual(expect.any(String));
  });

  it('preserves aggregated validation details', () => {
    const { host, json } = hostFor();
    filter.catch(
      new BadRequestException({
        message: 'Os dados enviados são inválidos.',
        details: [
          { field: 'email', message: 'Informe um e-mail válido.' },
          { field: 'password', message: 'A senha é obrigatória.' },
        ],
      }),
      host,
    );

    expect(json.mock.calls[0][0].details).toHaveLength(2);
  });

  it('passes through a 409 with its pt-BR message', () => {
    const { host, status, json } = hostFor();
    filter.catch(new ConflictException('Já existe uma conta cadastrada com este e-mail.'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json.mock.calls[0][0].error).toBe('Conflict');
  });

  it('sets Retry-After on a 429 carrying a computed retry window (FR-023)', () => {
    const { host, setHeader } = hostFor();
    const limited = new BadRequestException({ message: 'x', retryAfterSeconds: 743 });
    Object.defineProperty(limited, 'status', { value: HttpStatus.TOO_MANY_REQUESTS });
    jest.spyOn(limited, 'getStatus').mockReturnValue(HttpStatus.TOO_MANY_REQUESTS);

    filter.catch(limited, host);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '743');
  });
});
