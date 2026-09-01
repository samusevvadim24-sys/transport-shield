import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";

function dateValue(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

async function requireAdmin(request: Request) {
  const session = await getSessionFromRequest(request as import("next/server").NextRequest);
  return session?.role === "admin" ? session : null;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Недостаточно прав для изменения водителя" }, { status: 403 });
    }

    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Некорректный ID водителя" }, { status: 400 });
    }

    const body = await request.json();
    const db = getServerSupabase();

    const { data: driver, error: lookupError } = await db
      .from("drivers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!driver) return NextResponse.json({ error: "Водитель не найден" }, { status: 404 });

    const scope = body?.inspection_scope || "both";
    if (!["medical", "mechanic", "both"].includes(scope)) {
      return NextResponse.json({ error: "Некорректный тип осмотра водителя" }, { status: 400 });
    }

    const customerId = Number(body?.customer_id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "Некорректный заказчик" }, { status: 400 });
    }

    const driverPayload = {
      name: String(body?.name ?? "").trim(),
      car_brand: String(body?.car_brand ?? "").trim(),
      car_number: String(body?.car_number ?? "").trim(),
      customer_id: customerId,
      driver_id: String(body?.driver_id ?? "").trim() || null,
      insurance_expiry: dateValue(body?.insurance_expiry),
      license_expiry: dateValue(body?.license_expiry),
      license_number: String(body?.license_number ?? "").trim() || null,
      medical_expiry: dateValue(body?.medical_expiry),
      tech_inspection_expiry: dateValue(body?.tech_inspection_expiry),
      inspection_scope: scope,
    };

    const { data, error } = await db
      .from("drivers")
      .update(driverPayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Не удалось сохранить изменения водителя" }, { status: 500 });

    const login = String(body?.login ?? body?.driver_id ?? "").trim();
    const rawPassword = String(body?.password ?? "").trim();
    const userPayload: Record<string, string> = {};
    if (login) userPayload.login = login;
    if (rawPassword) userPayload.password_hash = await bcrypt.hash(rawPassword, 12);

    if (Object.keys(userPayload).length && driver.user_id != null) {
      const { error: userError } = await db
        .from("users")
        .update(userPayload)
        .eq("id", Number(driver.user_id));
      if (userError) throw userError;
    }

    // Blacklist is part of the driver record in the current schema.
    // If the column exists, update it directly with service-role access.
    if (body?.is_blacklisted !== undefined) {
      const { error: blacklistError } = await db
        .from("drivers")
        .update({ is_blacklisted: Boolean(body.is_blacklisted) })
        .eq("id", id);
      if (blacklistError) {
        // Older schemas may not have this column. The main driver update
        // is already complete, so don't turn a successful edit into a 500.
        console.warn("Не удалось обновить blacklist водителя:", blacklistError.message);
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Ошибка обновления водителя:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить данные водителя" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Недостаточно прав для удаления водителя" }, { status: 403 });
    }

    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Некорректный ID водителя" }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: driver, error: lookupError } = await db
      .from("drivers")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!driver) return NextResponse.json({ error: "Водитель не найден" }, { status: 404 });

    const { error: deleteError } = await db.from("drivers").delete().eq("id", id);
    if (deleteError) throw deleteError;

    if (driver.user_id != null) {
      const { error: userDeleteError } = await db
        .from("users")
        .delete()
        .eq("id", Number(driver.user_id));
      if (userDeleteError) throw userDeleteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ошибка удаления водителя:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить водителя" },
      { status: 500 },
    );
  }
}
