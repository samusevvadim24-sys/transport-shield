import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      // Проверка сессии не должна удалять cookie: временная ошибка проверки
      // или устаревший серверный ответ не должна превращаться в logout.
      return NextResponse.json({ authenticated: false }, { status: 401 });
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
