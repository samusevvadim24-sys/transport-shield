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
    const password = typeof body?.password === 'string' ? body.password : '';
    const passwordHash = password.trim() ? await bcrypt.hash(password, 12) : null;

    const { data, error } = await supabase.rpc('update_driver_record', {
      p_admin_id: Number(session.id),
      p_car_brand: String(body?.car_brand ?? '').trim(),
      p_car_number: String(body?.car_number ?? '').trim(),
      p_customer_id: Number(body?.customer_id),
      p_driver_code: String(body?.driver_id ?? '').trim(),
      p_driver_id: Number(body?.driver_id_record),
      p_inspection_scope: body?.inspection_scope || 'both',
      p_insurance_expiry: body?.insurance_expiry || null,
      p_license_expiry: body?.license_expiry || null,
      p_license_number: String(body?.license_number ?? '').trim(),
      p_login: String(body?.login ?? body?.driver_id ?? '').trim(),
      p_medical_expiry: body?.medical_expiry || null,
      p_name: String(body?.name ?? '').trim(),
      p_password_hash: passwordHash,
      p_tech_inspection_expiry: body?.tech_inspection_expiry || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Ошибка обновления водителя:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Не удалось обновить водителя' }, { status: 500 });
  }
}
