import { NextRequest, NextResponse } from 'next/server';
import { revokeServerSession, SESSION_COOKIE } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) await revokeServerSession(token);
  } catch (error) {
    console.error('Ошибка завершения серверной сессии:', error);
    // The cookie is still cleared below so the browser cannot keep using it.
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
