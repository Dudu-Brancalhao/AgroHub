import { request } from '../../lib/httpClient';
import type { AuthUser, Credentials, LoginResponse } from './types';

/** Operations 1–3 (contracts/api-client.md). Register and login are the only public calls. */

export function register(credentials: Credentials): Promise<AuthUser> {
  return request<AuthUser>({
    method: 'POST',
    path: '/auth/register',
    body: credentials,
    isPublic: true,
  });
}

export function login(credentials: Credentials): Promise<LoginResponse> {
  return request<LoginResponse>({
    method: 'POST',
    path: '/auth/login',
    body: credentials,
    isPublic: true,
  });
}

/** Confirms a rehydrated token is still good before protected content is painted. */
export function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>({ method: 'GET', path: '/auth/me' });
}
