import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";

async function requireAdmin(request: Request) {
  const session = await getSessionFromRequest(request as import("next/server").NextRequest);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const { data, error } = await getServerSupabase()
      .from("inspection_points")
      .select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price")
      .order("id", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ points: data ?? [], currentPointId: session.inspection_point_id ?? null });
  } catch (error) {
    console.error("Ошибка загрузки пунктов осмотра:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить пункты осмотра" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin(request);
    if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const body = await request.json();
    const pointId = Number(body?.pointId);
    if (!Number.isInteger(pointId) || pointId <= 0) {
      return NextResponse.json({ error: "Некорректный пункт осмотра" }, { status: 400 });
    }

    const { data, error } = await getServerSupabase()
      .from("users")
      .update({ inspection_point_id: pointId })
      .eq("id", session.id)
      .eq("role", "admin")
      .select("id,inspection_point_id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });

    return NextResponse.json({ ok: true, inspection_point_id: data.inspection_point_id });
  } catch (error) {
    console.error("Ошибка назначения пункта осмотра:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось назначить пункт осмотра" }, { status: 500 });
  }
}
