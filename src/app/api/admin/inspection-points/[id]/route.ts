import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";
import type { NextRequest } from "next/server";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request as NextRequest);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Некорректный пункт осмотра" }, { status: 400 });
    const body = await request.json();
    const payload = {
      ...(body?.name?.trim() ? { name: body.name.trim() } : {}),
      address: String(body?.address ?? "").trim(),
      medic_surname: String(body?.medic_surname ?? "").trim(),
      mechanic_surname: String(body?.mechanic_surname ?? "").trim(),
      medical_exam_price: Math.max(0, Number(body?.medical_exam_price) || 0),
      mechanic_exam_price: Math.max(0, Number(body?.mechanic_exam_price) || 0),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await getServerSupabase().from("inspection_points").update(payload).eq("id", id).select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Пункт осмотра не найден" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Ошибка сохранения пункта осмотра:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить пункт осмотра" }, { status: 500 });
  }
}
