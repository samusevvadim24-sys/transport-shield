import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";
import type { NextRequest } from "next/server";

const BP_OK = (s: number | null, d: number | null) => s != null && d != null && s >= 90 && s <= 140 && d >= 60 && d <= 90;

async function admin(request: Request) {
  const session = await getSessionFromRequest(request as NextRequest);
  return session?.role === "admin" ? session : null;
}

async function examiner(sb: ReturnType<typeof getServerSupabase>, value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { id: null as number | null, name: "" };
  if (!/^\d+$/.test(raw)) return { id: null as number | null, name: raw };
  const id = Number(raw);
  const { data } = await sb.from("users").select("id,login").eq("id", id).maybeSingle();
  return { id, name: data?.login || "" };
}

export async function POST(request: Request) {
  const session = await admin(request);
  if (!session) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body?.id ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if (!id || !action) return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });

    const sb = getServerSupabase();
    const { data: current, error: readError } = await sb.from("inspections")
      .select("inspection_scope,blood_pressure_systolic,blood_pressure_diastolic,breathalyzer_value,drug_intoxication,medical_status,mechanic_status,inspection_point_id")
      .eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Не найдена запись осмотра" }, { status: 404 });

    if (action === "delete") {
      const { error } = await sb.from("inspections").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "reset") {
      const { error } = await sb.from("inspections").update({ overall_status:"Ожидание", medical_status:"Ожидание", mechanic_status:"Ожидание", medical_date:null, mechanic_date:null, completed_at:null, breathalyzer_value:null, blood_pressure_systolic:null, blood_pressure_diastolic:null, drug_intoxication:false, mechanic_issues:[], medical_examiner_id:null, mechanic_examiner_id:null, medical_examiner_name:null, mechanic_examiner_name:null, inspection_point_id:null, summon:false, summon_acknowledged:false }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "summon") {
      const pointId = session.inspection_point_id ?? null;
      if (!pointId) return NextResponse.json({ error: "У администратора не назначен пункт осмотра" }, { status: 400 });
      const { data: point, error: pointError } = await sb.from("inspection_points").select("id").eq("id", pointId).maybeSingle();
      if (pointError) throw pointError;
      if (!point) return NextResponse.json({ error: "Пункт осмотра не найден" }, { status: 404 });
      const { error } = await sb.from("inspections").update({ inspection_point_id: pointId, overall_status:"Явиться", medical_status: current.inspection_scope === "mechanic" ? "Не требуется" : "Явиться", mechanic_status: current.inspection_scope === "medical" ? "Не требуется" : "Явиться", summon:true, summon_acknowledged:false }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "medical") {
      if (current.inspection_scope === "mechanic") {
        const { error } = await sb.from("inspections").update({ medical_status:"Не требуется" }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      const alcohol = Number(body?.alcoholVal ?? 0);
      const systolic = body?.systolic == null ? null : Number(body.systolic);
      const diastolic = body?.diastolic == null ? null : Number(body.diastolic);
      const drug = body?.drugIntoxication === true;
      const ok = alcohol === 0 && !drug && BP_OK(systolic, diastolic);
      const pointId = session.inspection_point_id ?? null;
      const point = pointId ? (await sb.from("inspection_points").select("medic_surname").eq("id", pointId).maybeSingle()).data : null;
      const ex = await examiner(sb, point?.medic_surname);
      const { error } = await sb.from("inspections").update({ medical_status:ok?"Допущен":"Не допущен", medical_date:body?.now || new Date().toISOString(), breathalyzer_value:alcohol, blood_pressure_systolic:systolic, blood_pressure_diastolic:diastolic, drug_intoxication:drug, medical_examiner_id:ex.id, medical_examiner_name:ex.name }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const pointId = session.inspection_point_id ?? null;
    if (!pointId) return NextResponse.json({ error: "У администратора не назначен пункт осмотра" }, { status: 400 });
    const point = (await sb.from("inspection_points").select("medic_surname,mechanic_surname").eq("id", pointId).maybeSingle()).data;
    const med = await examiner(sb, point?.medic_surname);
    const mech = await examiner(sb, point?.mechanic_surname);
    const now = body?.now || new Date().toISOString();

    if (action === "approve") {
      const summonReset = { summon:false, summon_acknowledged:false, inspection_point_id: current.inspection_point_id ?? pointId };
      if (current.inspection_scope === "medical") {
        const ok = BP_OK(current.blood_pressure_systolic ?? 120, current.blood_pressure_diastolic ?? 80) && (current.breathalyzer_value ?? 0) === 0 && current.drug_intoxication !== true;
        const { error } = await sb.from("inspections").update({ overall_status:ok?"Допущен":"Не допущен", medical_status:ok?"Допущен":"Не допущен", mechanic_status:"Не требуется", medical_date:now, mechanic_date:null, completed_at:now, medical_examiner_id:med.id, mechanic_examiner_id:null, medical_examiner_name:med.name, mechanic_examiner_name:null, ...summonReset }).eq("id", id); if(error) throw error; return NextResponse.json({ok:true});
      }
      if (current.inspection_scope === "mechanic") {
        const { error } = await sb.from("inspections").update({ overall_status:"Допущен", medical_status:"Не требуется", mechanic_status:"Допущен", medical_date:null, mechanic_date:now, completed_at:now, mechanic_issues:[], medical_examiner_id:null, mechanic_examiner_id:mech.id, medical_examiner_name:null, mechanic_examiner_name:mech.name, ...summonReset }).eq("id", id); if(error) throw error; return NextResponse.json({ok:true});
      }
      const s = current.blood_pressure_systolic ?? 120, d = current.blood_pressure_diastolic ?? 80;
      const ok = BP_OK(s,d) && (current.breathalyzer_value ?? 0) === 0 && current.drug_intoxication !== true;
      const { error } = await sb.from("inspections").update({ overall_status:ok?"Допущен":"Не допущен", medical_status:ok?"Допущен":"Не допущен", mechanic_status:ok?"Допущен":"Не допущен", medical_date:now, mechanic_date:now, completed_at:now, blood_pressure_systolic:s, blood_pressure_diastolic:d, mechanic_issues:ok?[]:["Медицинские показатели не соответствуют норме"], medical_examiner_id:med.id, mechanic_examiner_id:mech.id, medical_examiner_name:med.name, mechanic_examiner_name:mech.name, ...summonReset }).eq("id", id); if(error) throw error; return NextResponse.json({ok:true});
    }

    if (action === "reject") {
      const issues = Array.isArray(body?.issuesList) ? body.issuesList.map(String) : [];
      const mechStatus = issues.length ? "Не допущен" : "Допущен";
      const patch: Record<string, unknown> = { completed_at:now, mechanic_issues:issues, mechanic_status:mechStatus, mechanic_examiner_id:mech.id, mechanic_examiner_name:mech.name, summon:false, summon_acknowledged:false, inspection_point_id: current.inspection_point_id ?? pointId };
      if (current.inspection_scope === "medical") Object.assign(patch,{ overall_status:current.medical_status === "Допущен" ? "Допущен" : "Не допущен", mechanic_status:"Не требуется", mechanic_date:null, mechanic_issues:null, mechanic_examiner_id:null, mechanic_examiner_name:null, medical_examiner_id:med.id, medical_examiner_name:med.name });
      else if (current.inspection_scope === "mechanic") Object.assign(patch,{ overall_status:mechStatus, medical_status:"Не требуется", mechanic_date:now, medical_date:null, breathalyzer_value:null, blood_pressure_systolic:null, blood_pressure_diastolic:null, drug_intoxication:false, medical_examiner_id:null, medical_examiner_name:null });
      else Object.assign(patch,{ overall_status:current.medical_status === "Допущен" && mechStatus === "Допущен" ? "Допущен" : "Не допущен", mechanic_date:now });
      const { error } = await sb.from("inspections").update(patch).eq("id", id); if(error) throw error; return NextResponse.json({ok:true});
    }

    return NextResponse.json({ error:"Неизвестное действие" }, { status:400 });
  } catch (error) {
    console.error("Ошибка операции с осмотром:", error);
    return NextResponse.json({ error:error instanceof Error ? error.message : "Не удалось выполнить операцию" }, { status:500 });
  }
}
