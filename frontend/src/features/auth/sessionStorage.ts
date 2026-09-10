import type { LoginResponse, Session } from './types';

/**
 * The session token's only home outside the store.
 *
 * localStorage rather than memory because FR-013 requires the session to survive a reload and the
 * backend issues a bearer token with no refresh endpoint — an in-memory token would force a
 * re-login on every refresh. Rather than sessionStorage because that is per-tab, so opening a
 * link in a new tab would demand a fresh sign-in for no security gain against the threat that
 * actually applies (XSS reads either).
 *
 * The genuinely stronger option is an httpOnly cookie, which the backend would have to set
 * instead of returning a bearer token — backend work, out of scope here (research.md R-007).
 */

export const SESSION_STORAGE_KEY = 'agrohub.session';

/** Converts the API's relative `expiresIn` into an absolute instant that survives a reload. */
export function toSession(response: LoginResponse): Session {
  return {
    accessToken: response.accessToken,
    tokenType: response.tokenType,
    expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
    user: response.user,
  };
}

export function isExpired(session: Session, now: number = Date.now()): boolean {
  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isNaN(expiresAt) || expiresAt <= now;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null &&
    typeof candidate.user.email === 'string'
  );
}

/**
 * Reads the stored session, discarding anything unusable.
 *
 * An already-expired token is dropped here rather than sent, so start-up never issues a request
 * that is guaranteed to 401.
 */
export function readSession(): Session | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    // A browser configured to block site data throws on access rather than returning null.
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed) || isExpired(parsed)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function writeSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage being unavailable degrades the session to this tab's lifetime; it must never
    // break signing in.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to do — the session is already gone from the store, which is what gates the UI.
  }
}
