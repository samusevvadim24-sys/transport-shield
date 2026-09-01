import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";

async function admin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  return session?.role === "admin" ? session : null;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await admin(request);
  if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Некорректный ID заказчика" }, { status: 400 });
    const body = await request.json();
    const updates = { ...body };
    delete updates.id;
    delete updates.created_at;
    delete updates.user_id;
    const db = getServerSupabase();
    if (updates.number !== undefined) {
      const number = String(updates.number ?? "").trim();
      if (!number) return NextResponse.json({ error: "Номер заказчика обязателен." }, { status: 400 });
      const { data: duplicate, error: duplicateError } = await db.from("customers").select("id").eq("number", number).neq("id", id).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) return NextResponse.json({ error: `Заказчик с номером ${number} уже существует.` }, { status: 409 });
      updates.number = number;
    }
    if (updates.name !== undefined) {
      updates.name = String(updates.name ?? "").trim();
      if (!updates.name) return NextResponse.json({ error: "Название заказчика обязательно." }, { status: 400 });
    }
    const { data, error } = await db.from("customers").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Ошибка обновления заказчика:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить заказчика" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await admin(request);
  if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Некорректный ID заказчика" }, { status: 400 });
    const db = getServerSupabase();
    const { data: customer, error: lookupError } = await db.from("customers").select("id,user_id").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!customer) return NextResponse.json({ error: "Заказчик не найден" }, { status: 404 });
    const { error } = await db.from("customers").delete().eq("id", id);
    if (error) throw error;
    if (customer.user_id != null) await db.from("users").delete().eq("id", Number(customer.user_id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ошибка удаления заказчика:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить заказчика" }, { status: 500 });
  }
}
