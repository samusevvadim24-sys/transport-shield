import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

type UserRow = {
  id: number;
  password_hash: string | null;
  role: 'admin' | 'customer' | 'driver';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : '';

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Некорректный пользователь' }, { status: 400 });
    }
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Введите текущий и новый пароль' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Новый пароль должен содержать минимум 6 символов' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Новый пароль должен отличаться от текущего' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Сервис авторизации не настроен' }, { status: 500 });
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: user, error: readError } = await supabase
      .from('users')
      .select('id,password_hash,role')
      .eq('id', userId)
      .eq('role', 'admin')
      .maybeSingle<UserRow>();

    if (readError) {
      console.error('Ошибка чтения администратора:', readError.message);
      return NextResponse.json({ error: 'Ошибка соединения с базой данных' }, { status: 500 });
    }
    if (!user?.password_hash) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Текущий пароль указан неверно' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, password: null })
      .eq('id', userId)
      .eq('role', 'admin')
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('Ошибка обновления пароля администратора:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    if (!updatedUser) {
      return NextResponse.json({ error: 'Пароль не изменён. Проверьте права доступа к пользователю.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ошибка API смены пароля:', error);
    return NextResponse.json({ error: 'Не удалось изменить пароль' }, { status: 500 });
  }
}
