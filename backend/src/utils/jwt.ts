import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  email: string;
  systemRole?: string;
  jti?: string;
}

export function signAccessToken(payload: JwtPayload) {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any, jwtid: randomUUID() };
  return jwt.sign(payload, env.JWT_SECRET as Secret, opts);
}

export function signRefreshToken(payload: JwtPayload) {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any, jwtid: randomUUID() };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, opts);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET as Secret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as JwtPayload;
}
