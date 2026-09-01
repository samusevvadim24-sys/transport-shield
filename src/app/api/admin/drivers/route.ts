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

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request as import("next/server").NextRequest);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const customerId = Number(body?.customer_id);
    const driverNumber = String(body?.driver_id ?? "").trim();
    const rawPassword = String(body?.password ?? "");
    const scope = body?.inspection_scope || "both";

    if (!name) return NextResponse.json({ error: "ФИО водителя обязательно." }, { status: 400 });
    if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ error: "Некорректный заказчик" }, { status: 400 });
    if (!driverNumber) return NextResponse.json({ error: "Номер водителя обязателен." }, { status: 400 });
    if (!rawPassword.trim()) return NextResponse.json({ error: "Пароль обязателен." }, { status: 400 });
    if (!["medical", "mechanic", "both"].includes(scope)) return NextResponse.json({ error: "Некорректный тип осмотра водителя" }, { status: 400 });

    const db = getServerSupabase();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const { data: userData, error: userError } = await db.rpc("create_driver_user", {
      p_admin_id: Number(session.id),
      p_login: driverNumber,
      p_password: passwordHash,
    });
    if (userError) throw userError;
    if (!userData?.id) throw new Error("Не удалось создать пользователя водителя.");

    const { data: driverData, error: driverError } = await db.rpc("create_driver_record", {
      p_admin_id: Number(session.id),
      p_user_id: Number(userData.id),
      p_name: name,
      p_car_brand: String(body?.car_brand ?? "").trim(),
      p_car_number: String(body?.car_number ?? "").trim(),
      p_customer_id: customerId,
      p_driver_id: driverNumber,
      p_insurance_expiry: dateValue(body?.insurance_expiry) ?? "",
      p_license_expiry: dateValue(body?.license_expiry) ?? "",
      p_license_number: String(body?.license_number ?? "").trim(),
      p_medical_expiry: dateValue(body?.medical_expiry) ?? "",
      p_tech_inspection_expiry: dateValue(body?.tech_inspection_expiry) ?? "",
    });
    if (driverError) throw driverError;
    if (!driverData?.id) throw new Error("Не удалось создать запись водителя.");

    const driverId = Number(driverData.id);
    const { error: scopeError } = await db.from("drivers").update({ inspection_scope: scope }).eq("id", driverId);
    if (scopeError) throw scopeError;

    if (body?.is_blacklisted !== undefined) {
      const { error: blacklistError } = await db.rpc("set_driver_blacklist", {
        p_admin_id: Number(session.id),
        p_driver_id: driverId,
        p_is_blacklisted: Boolean(body.is_blacklisted),
      });
      if (blacklistError) throw blacklistError;
    }

    return NextResponse.json({ data: driverData }, { status: 201 });
  } catch (error) {
    console.error("Ошибка создания водителя:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать водителя" },
      { status: 500 },
    );
  }
}
