/** The shape JwtStrategy.validate() attaches to the request. Never carries password material. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Claims carried by an issued access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}
