import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'ts_auth_session';

export type AuthSession = {
  id: number;
  login: string;
  role: 'admin' | 'customer' | 'driver';
  inspection_point_id?: number | null;
  exp: number;
};

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET is not configured');
  return secret;
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function decodeSessionValue(value: string): AuthSession | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(payload);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as AuthSession;

    if (!session?.id || !session?.login || !session?.role) return null;
    if (!['admin', 'customer', 'driver'].includes(session.role)) return null;
    if (!Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): AuthSession | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  return value ? decodeSessionValue(value) : null;
}
