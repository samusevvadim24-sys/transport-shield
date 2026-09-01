import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        id: session.id,
        login: session.login,
        role: session.role,
        inspection_point_id: session.inspection_point_id ?? null,
      },
    });
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
