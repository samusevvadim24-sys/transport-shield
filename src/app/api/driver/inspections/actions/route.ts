import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";
import type { NextRequest } from "next/server";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request as NextRequest);
  if (!session || session.role !== "driver") return NextResponse.json({ error:"Недостаточно прав" }, {status:403});
  try {
    const body = await request.json();
    const action = String(body?.action ?? "");
    const driverId = Number(body?.driverDbId);
    if (!Number.isInteger(driverId) || driverId <= 0) return NextResponse.json({error:"Некорректный водитель"},{status:400});
    const sb = getServerSupabase();
    const { data: driver } = await sb.from("drivers").select("id,user_id,driver_id,inspection_scope").eq("id",driverId).maybeSingle();
    if (!driver) return NextResponse.json({error:"Водитель не найден"},{status:404});
    if (driver.user_id !== session.id && driver.driver_id !== session.login) return NextResponse.json({error:"Недостаточно прав"},{status:403});

    if (action === "acknowledge") {
      const inspectionId = Number(body?.inspectionId);
      if (!Number.isInteger(inspectionId)) return NextResponse.json({error:"Некорректный осмотр"},{status:400});
      const { error } = await sb.from("inspections").update({summon_acknowledged:true}).eq("id",inspectionId).eq("driver_id",driverId);
      if (error) throw error;
      return NextResponse.json({ok:true});
    }
    if (action === "create") {
      const scope = driver.inspection_scope || "both";
      const inspection: Record<string,unknown> = {driver_id:driverId,inspection_point_id:null,requested_at:new Date().toISOString(),overall_status:"Ожидание"};
      if (scope === "medical" || scope === "both") inspection.medical_status="Ожидание";
      if (scope === "mechanic" || scope === "both") inspection.mechanic_status="Ожидание";
      const {error} = await sb.from("inspections").insert([inspection]);
      if(error) throw error;
      return NextResponse.json({ok:true});
    }
    return NextResponse.json({error:"Неизвестное действие"},{status:400});
  } catch(error) {
    console.error("Ошибка операции водителя с осмотром:",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Не удалось выполнить операцию"},{status:500});
  }
}
