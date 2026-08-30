import bcryptjs from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface LoginBody {
  login?: unknown;
  password?: unknown;
}

const getServerSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase environment is not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

const isBcryptHash = (value: string) => /^\$2[aby]?\$\d{2}\$/.test(value);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const login = typeof body.login === 'string' ? body.login.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, login, password, role')
      .eq('login', login)
      .maybeSingle();

    if (error) {
      console.error('Ошибка Supabase при авторизации:', error.message);
      return NextResponse.json({ error: 'Ошибка соединения с базой данных' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    const storedPassword = String(user.password ?? '');
    let valid = false;

    if (isBcryptHash(storedPassword)) {
      valid = await bcryptjs.compare(password, storedPassword);
    } else {
      // Однократная обратная совместимость со старыми plaintext-паролями.
      // После успешной проверки сразу заменяем пароль на bcrypt-хеш.
      valid = storedPassword === password;
      if (valid) {
        const newHash = await bcryptjs.hash(password, 10);
        const { error: updateError } = await supabase
          .from('users')
          .update({ password: newHash })
          .eq('id', user.id);

        if (updateError) {
          console.error('Не удалось мигрировать пароль на bcrypt:', updateError.message);
          return NextResponse.json({ error: 'Не удалось обновить данные авторизации' }, { status: 500 });
        }
      }
    }

    if (!valid) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'customer' && user.role !== 'driver') {
      return NextResponse.json({ error: 'Для пользователя не настроена роль' }, { status: 403 });
    }

    return NextResponse.json({
      session: {
        id: user.id,
        login: user.login,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Ошибка серверной авторизации:', error);
    return NextResponse.json({ error: 'Не удалось выполнить вход' }, { status: 500 });
  }
}
