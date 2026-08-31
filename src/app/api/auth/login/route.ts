import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'ts_auth_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type UserRow = {
  id: number;
  login: string;
  password: string;
  role: 'admin' | 'customer' | 'driver';
  inspection_point_id?: number | null;
};

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET is not configured');
  return secret;
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const login = typeof body?.login === 'string' ? body.login.trim() : '';
    const password = typeof body?.password === 'string' ? body.password.trim() : '';

    if (!login || !password) {
      return NextResponse.json({ error: 'Введите логин и пароль' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Сервис авторизации не настроен' }, { status: 500 });
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, login, password, role, inspection_point_id')
      .eq('login', login)
      .maybeSingle<UserRow>();

    if (error) {
      console.error('Ошибка Supabase при авторизации:', error.message);
      return NextResponse.json({ error: 'Ошибка соединения с базой данных' }, { status: 500 });
    }

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    if (!['admin', 'customer', 'driver'].includes(user.role)) {
      return NextResponse.json({ error: 'Для пользователя не настроена роль' }, { status: 403 });
    }

    const payload = encode(JSON.stringify({
      id: user.id,
      login: user.login,
      role: user.role,
      inspection_point_id: user.inspection_point_id ?? null,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }));

    const value = `${payload}.${sign(payload)}`;
    const response = NextResponse.json({
      session: {
        id: user.id,
        login: user.login,
        role: user.role,
        inspection_point_id: user.inspection_point_id ?? null,
      },
    });

    response.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Ошибка API авторизации:', error);
    return NextResponse.json({ error: 'Не удалось выполнить вход' }, { status: 500 });
  }
}
