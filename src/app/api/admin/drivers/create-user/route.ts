import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const body = await request.json();
    const login = typeof body?.login === 'string' ? body.login.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!login) return NextResponse.json({ error: 'Логин обязателен' }, { status: 400 });
    if (!password.trim()) return NextResponse.json({ error: 'Пароль обязателен' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.rpc('create_driver_user', {
      p_admin_id: Number(session.id),
      p_login: login,
      p_password_hash: passwordHash,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Ошибка создания пользователя водителя:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Не удалось создать пользователя' }, { status: 500 });
  }
}
