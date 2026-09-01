import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request as import("next/server").NextRequest);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  try {
    const body = await request.json();
    const number = String(body?.number ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!number) return NextResponse.json({ error: "Номер заказчика обязателен." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Название заказчика обязательно." }, { status: 400 });

    const db = getServerSupabase();
    const { data: duplicate, error: duplicateError } = await db.from("customers").select("id").eq("number", number).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return NextResponse.json({ error: `Заказчик с номером ${number} уже существует.` }, { status: 409 });

    const passwordHash = await bcrypt.hash(number, 12);
    const { data, error } = await db.rpc("create_customer_with_user", {
      p_number: number,
      p_name: name,
      p_password_hash: passwordHash,
      p_type: body?.type ?? null,
      p_unp: body?.unp ?? null,
      p_address: body?.address ?? null,
      p_phone: body?.phone ?? null,
      p_email: body?.email ?? null,
      p_contact_person: body?.contact_person ?? null,
      p_bank_name: body?.bank_name ?? null,
      p_bank_account: body?.bank_account ?? null,
      p_bank_bic: body?.bank_bic ?? null,
      p_contract_number: body?.contract_number ?? null,
      p_contract_date: body?.contract_date ?? null,
      p_registration_number: body?.registration_number ?? null,
      p_registration_date: body?.registration_date ?? null,
      p_director_name: body?.director_name ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Ошибка создания заказчика:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать заказчика" }, { status: 500 });
  }
}
