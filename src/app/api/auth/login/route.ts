import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import {
  createServerSession,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/auth-session';

 type UserRow = {
  id: number;
  login: string;
  password_hash: string | null;
  role: 'admin' | 'customer' | 'driver';
  inspection_point_id?: number | null;
};

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
      .select('id, login, password_hash, role, inspection_point_id')
      .eq('login', login)
      .maybeSingle<UserRow>();

    if (error) {
      console.error('Ошибка Supabase при авторизации:', error.message);
      return NextResponse.json({ error: 'Ошибка соединения с базой данных' }, { status: 500 });
    }

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    if (!['admin', 'customer', 'driver'].includes(user.role)) {
      return NextResponse.json({ error: 'Для пользователя не настроена роль' }, { status: 403 });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await createServerSession(user.id, token, expiresAt);

    const response = NextResponse.json({
      session: {
        id: user.id,
        login: user.login,
        role: user.role,
        inspection_point_id: user.inspection_point_id ?? null,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
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
