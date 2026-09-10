import { ApiError, configureHttpClient, request } from './httpClient';

const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response;
}

function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new Error('no body');
    },
  } as unknown as Response;
}

describe('httpClient', () => {
  let fetchMock: jest.Mock;
  let getToken: jest.Mock;
  let onUnauthorized: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    getToken = jest.fn().mockReturnValue('token-123');
    onUnauthorized = jest.fn();
    configureHttpClient({ getToken, onUnauthorized });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('prefixes every path with the API base path', async () => {
    await request({ method: 'GET', path: '/producers' });

    expect(fetchMock).toHaveBeenCalledWith('/api/producers', expect.anything());
  });

  it('serialises a JSON body and sets the content type', async () => {
    await request({ method: 'POST', path: '/producers', body: { name: 'José' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ name: 'José' }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('attaches the bearer token to protected requests', async () => {
    await request({ method: 'GET', path: '/producers' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('omits the bearer token on register and login', async () => {
    await request({ method: 'POST', path: '/auth/login', body: {}, isPublic: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'abc' }));

    await expect(request<{ id: string }>({ method: 'GET', path: '/producers/abc' })).resolves.toEqual(
      { id: 'abc' },
    );
  });

  it('returns undefined for a response with no body', async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));

    await expect(request({ method: 'DELETE', path: '/crops/abc' })).resolves.toBeUndefined();
  });

  it('reduces the error envelope to a typed ApiError, dropping the technical fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Documento já cadastrado.',
        details: [{ field: 'document', message: 'Documento já cadastrado.' }],
        path: '/api/producers',
        timestamp: '2026-09-09T14:32:11.421Z',
        requestId: '01J7X2K9QF3M8N4P',
      }),
    );

    const error = await request({ method: 'POST', path: '/producers', body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.statusCode).toBe(409);
    expect(apiError.message).toBe('Documento já cadastrado.');
    expect(apiError.details).toEqual([{ field: 'document', message: 'Documento já cadastrado.' }]);
    expect(apiError.requestId).toBe('01J7X2K9QF3M8N4P');

    // The technical identifier and path must never travel to a screen (SC-006).
    expect(Object.keys(apiError)).not.toContain('error');
    expect(Object.keys(apiError)).not.toContain('path');
  });

  it('synthesises a pt-BR fallback when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = (await request({ method: 'GET', path: '/dashboard' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
    expect(error.message).toMatch(/servidor/i);
  });

  it('synthesises a pt-BR fallback when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(emptyResponse(500));

    const error = (await request({ method: 'GET', path: '/dashboard' }).catch(
      (caught: unknown) => caught,
    )) as ApiError;

    expect(error.statusCode).toBe(500);
    expect(error.message).toBeTruthy();
  });

  it('signals a dead session on 401, once and centrally', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'Não autorizado.' }),
    );

    await request({ method: 'GET', path: '/dashboard' }).catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not signal a dead session for other failures', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { statusCode: 404, error: 'Not Found', message: 'Não encontrado.' }),
    );

    await request({ method: 'GET', path: '/producers/x' }).catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('appends query parameters, omitting empty ones', async () => {
    await request({
      method: 'GET',
      path: '/producers',
      query: { page: 2, search: '', pageSize: undefined },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/producers?page=2', expect.anything());
  });
});
