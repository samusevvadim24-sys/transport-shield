import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";
import type { NextRequest } from "next/server";

async function requireAdmin(request: Request) {
  const session = await getSessionFromRequest(request as NextRequest);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function PUT(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  try {
    const body = await request.json();
    const db = getServerSupabase();
    const hasPointFields = [
      "inspection_point_name", "inspection_point_address", "medic_surname",
      "mechanic_surname", "medical_exam_price", "mechanic_exam_price",
    ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const hasOrganizationFields = [
      "organization_name", "organization_address", "organization_bank_account",
      "organization_unp", "organization_phone", "organization_email",
      "organization_director_name",
    ].some((key) => Object.prototype.hasOwnProperty.call(body, key));

    if (!hasPointFields && !hasOrganizationFields) {
      return NextResponse.json({ error: "Нет данных для сохранения" }, { status: 400 });
    }

    const result: { point?: unknown; organization?: unknown } = {};

    if (hasPointFields) {
      const pointId = Number(body?.pointId ?? session.inspection_point_id);
      if (!Number.isInteger(pointId) || pointId <= 0) {
        return NextResponse.json({ error: "Для администратора не назначен пункт осмотра" }, { status: 400 });
      }

      const point = {
        ...(String(body?.inspection_point_name ?? "").trim()
          ? { name: String(body.inspection_point_name).trim() }
          : {}),
        address: String(body?.inspection_point_address ?? "").trim(),
        medic_surname: String(body?.medic_surname ?? "").trim(),
        mechanic_surname: String(body?.mechanic_surname ?? "").trim(),
        medical_exam_price: Math.max(0, Number(body?.medical_exam_price) || 0),
        mechanic_exam_price: Math.max(0, Number(body?.mechanic_exam_price) || 0),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db.from("inspection_points")
        .update(point)
        .eq("id", pointId)
        .select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price")
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Пункт осмотра не найден" }, { status: 404 });
      result.point = data;
    }

    if (hasOrganizationFields) {
      const organization = {
        id: 1,
        organization_name: String(body?.organization_name ?? "").trim(),
        organization_address: String(body?.organization_address ?? "").trim(),
        organization_bank_account: String(body?.organization_bank_account ?? "").trim(),
        organization_unp: String(body?.organization_unp ?? "").trim(),
        organization_phone: String(body?.organization_phone ?? "").trim(),
        organization_email: String(body?.organization_email ?? "").trim(),
        director_name: String(body?.organization_director_name ?? "").trim(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db.from("system_settings")
        .upsert(organization)
        .select("id,organization_name,organization_address,organization_bank_account,organization_unp,organization_phone,organization_email,director_name")
        .maybeSingle();
      if (error) throw error;
      result.organization = data;
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Ошибка сохранения настроек:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить настройки" }, { status: 500 });
  }
}
