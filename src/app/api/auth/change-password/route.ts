import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { getServerSupabase } from '@/lib/server-supabase';
import type { NextRequest } from 'next/server';

type UserRow = {
  id: number;
  password_hash: string | null;
  role: 'admin' | 'customer' | 'driver';
};

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request as NextRequest);
    if (!session) return NextResponse.json({ error: 'Сессия не найдена' }, { status: 401 });

    const body = await request.json();
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Введите текущий и новый пароль' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Новый пароль должен содержать минимум 6 символов' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Новый пароль должен отличаться от текущего' }, { status: 400 });
    }

    const db = getServerSupabase();
    const userId = Number(session.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Некорректная сессия пользователя' }, { status: 401 });
    }

    const { data: user, error: readError } = await db
      .from('users')
      .select('id,password_hash,role')
      .eq('id', userId)
      .eq('role', session.role)
      .maybeSingle<UserRow>();

    if (readError) {
      console.error('Ошибка чтения пользователя при смене пароля:', readError);
      return NextResponse.json({ error: 'Ошибка соединения с базой данных' }, { status: 500 });
    }
    if (!user?.password_hash) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Текущий пароль указан неверно' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await db
      .from('users')
      .update({ password_hash: passwordHash, password: null })
      .eq('id', userId)
      .eq('role', session.role);

    if (updateError) {
      console.error('Ошибка обновления пароля:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ошибка API смены пароля:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Не удалось изменить пароль',
    }, { status: 500 });
  }
}
