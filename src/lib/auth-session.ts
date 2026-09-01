import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'ts_auth_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type AuthSession = {
  id: number;
  login: string;
  role: 'admin' | 'customer' | 'driver';
  inspection_point_id?: number | null;
  exp: number;
};

type AuthSessionRow = {
  id: number;
  login: string;
  role: 'admin' | 'customer' | 'driver';
  inspection_point_id?: number | null;
  expires_at: string;
};

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createSessionToken() { return randomBytes(32).toString('base64url'); }
export function hashSessionToken(token: string) { return createHash('sha256').update(token, 'utf8').digest('hex'); }

export async function createServerSession(userId: number, token: string, expiresAt: Date) {
  const { error } = await getServerSupabase().rpc('create_auth_session', {
    p_user_id: userId,
    p_token_hash: hashSessionToken(token),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Не удалось создать серверную сессию: ${error.message}`);
}

export async function revokeServerSession(token: string) {
  if (!token) return;
  const { error } = await getServerSupabase()
    .from('auth_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', hashSessionToken(token))
    .is('revoked_at', null);
  if (error) throw new Error(`Не удалось завершить серверную сессию: ${error.message}`);
}

export async function getSessionFromToken(token: string): Promise<AuthSession | null> {
  if (!token) return null;
  const { data, error } = await getServerSupabase().rpc('get_auth_session', { p_token_hash: hashSessionToken(token) });
  if (error || !data?.length) return null;
  const row = data[0] as AuthSessionRow;
  const exp = Math.floor(new Date(row.expires_at).getTime() / 1000);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
  if (!['admin', 'customer', 'driver'].includes(row.role)) return null;
  return { id: row.id, login: row.login, role: row.role, inspection_point_id: row.inspection_point_id ?? null, exp };
}

export async function getSessionFromRequest(request: NextRequest): Promise<AuthSession | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? getSessionFromToken(token) : null;
}
