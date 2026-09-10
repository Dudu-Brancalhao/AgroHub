/** Mirrors the backend's auth DTOs (contracts/api-client.md operations 1–3). */

export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type Credentials = {
  email: string;
  password: string;
};

/** What `POST /api/auth/login` returns. */
export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds from now. Converted to an absolute `expiresAt` before storing. */
  expiresIn: number;
  user: AuthUser;
};

/**
 * The client's own session model.
 *
 * `expiresAt` rather than `expiresIn`: a relative lifetime stops meaning anything once it has
 * been sitting in localStorage across a reload (research.md R-007).
 */
export type Session = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: AuthUser;
};
