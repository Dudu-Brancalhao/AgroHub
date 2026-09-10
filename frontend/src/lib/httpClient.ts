import { env } from '../config/env';

/**
 * The only module in this codebase that calls `fetch` (Principle II; the ESLint config enforces
 * it). Four responsibilities and no more:
 *
 *   1. prefix and serialise
 *   2. authorise
 *   3. normalise failures into a typed ApiError
 *   4. signal a dead session on 401
 *
 * It does not retry, cache, or transform domain data. Parsing decimal strings into integers
 * belongs to each feature's api.ts, at the edge where a DTO becomes a client model.
 */

export type FieldError = { field: string; message: string };

/**
 * A failure a screen can render directly.
 *
 * Carries only what the user or a support conversation needs. The envelope's `error`, `path` and
 * `timestamp` are deliberately dropped here so they cannot leak into the interface (SC-006);
 * `requestId` survives because it is what correlates a user-visible message to the backend log
 * line (Principle VI).
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: FieldError[];
  readonly requestId?: string;

  constructor(statusCode: number, message: string, details?: FieldError[], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }

  /** True when the failure names specific fields, so a form can mark them all at once. */
  get isValidation(): boolean {
    return Array.isArray(this.details) && this.details.length > 0;
  }
}

/**
 * A failure as it travels through Redux.
 *
 * A plain object, not the ApiError class: the store's serializability check rejects class
 * instances, and rightly — non-serialisable state breaks devtools time travel and persistence.
 * Screens that need per-field attribution (FR-030, FR-037) read `details` from the rejected
 * action; slices keep only `message` (contracts/store.md).
 */
export type ApiFailure = {
  statusCode: number;
  message: string;
  details?: FieldError[];
};

export function toFailure(error: unknown, fallback: string): ApiFailure {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      ...(error.details && { details: error.details }),
    };
  }
  return { statusCode: 0, message: fallback };
}

const NETWORK_FAILURE_MESSAGE =
  'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.';
const UNKNOWN_FAILURE_MESSAGE = 'Algo deu errado. Tente novamente em instantes.';

type HttpClientConfig = {
  getToken: () => string | null;
  onUnauthorized: () => void;
};

let config: HttpClientConfig = {
  getToken: () => null,
  onUnauthorized: () => undefined,
};

/**
 * Wired once at start-up. Injected rather than imported so this module never depends on the
 * store — which would be a dependency pointing outward (Principle II) and a require cycle.
 */
export function configureHttpClient(next: HttpClientConfig): void {
  config = next;
}

export type QueryValue = string | number | boolean | undefined | null;

export type RequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Register and login are the only unauthenticated operations. */
  isPublic?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${env.apiBasePath}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) return undefined;

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = body as
    | { message?: unknown; details?: unknown; requestId?: unknown }
    | undefined;

  const message =
    typeof envelope?.message === 'string' && envelope.message.trim() !== ''
      ? envelope.message
      : UNKNOWN_FAILURE_MESSAGE;

  const details = Array.isArray(envelope?.details)
    ? (envelope.details as FieldError[])
    : undefined;

  const requestId = typeof envelope?.requestId === 'string' ? envelope.requestId : undefined;

  return new ApiError(status, message, details, requestId);
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { method, path, body, query, isPublic, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!isPublic) {
    const token = config.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (caught) {
    // An aborted request is the caller withdrawing, not a failure to report.
    if (caught instanceof DOMException && caught.name === 'AbortError') throw caught;
    throw new ApiError(0, NETWORK_FAILURE_MESSAGE);
  }

  const payload = await readBody(response);

  if (!response.ok) {
    // Centralised so the redirect happens once rather than in every thunk (FR-015).
    if (response.status === 401) config.onUnauthorized();
    throw toApiError(response.status, payload);
  }

  return payload as T;
}
