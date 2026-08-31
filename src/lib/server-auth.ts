import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'ts_auth_session';

type ServerSession = {
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

function verifySignature(payload: string, signature: string) {
  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!verifySignature(payload, signature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ServerSession;
    if (!decoded?.id || !decoded?.login || !decoded?.role || !decoded?.exp) return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
