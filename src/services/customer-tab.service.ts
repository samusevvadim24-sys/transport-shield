/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { Inspection } from "../types/database.types";
import { fetchSystemSettings } from "./settings.service";

export const PAGE_SIZE = 30;
const MIN_SYSTOLIC = 90;
const MAX_SYSTOLIC = 140;
const MIN_DIASTOLIC = 60;
const MAX_DIASTOLIC = 90;

function isBloodPressureWithinNormalRange(s: number | null, d: number | null) {
  return s != null && d != null && s >= MIN_SYSTOLIC && s <= MAX_SYSTOLIC && d >= MIN_DIASTOLIC && d <= MAX_DIASTOLIC;
}

function usableExaminerName(value: any): string {
  const s = String(value ?? "").trim();
  return s && !/^\d+$/.test(s) ? s : "";
}

export const formatInspectionItem = (item: any): Inspection => {
  let medicalTimeFormatted = "—";
  let mechanicTimeFormatted = "—";
  let generalTimeFormatted = "—";

  if (item.medical_date) {
    const d = new Date(item.medical_date);
    medicalTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  if (item.mechanic_date) {
    const d = new Date(item.mechanic_date);
    mechanicTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  const targetDateStr = item.requested_at || item.created_at;
  if (targetDateStr) {
    const d = new Date(targetDateStr);
    generalTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  const medicalDone = !!item.medical_date && ["Допущен", "Не допущен"].includes(item.medical_status);
  const mechanicDone = !!item.mechanic_date && ["Допущен", "Не допущен"].includes(item.mechanic_status);
  const medicalExaminer = medicalDone
    ? (usableExaminerName(item.medical_examiner_name) || usableExaminerName(item.medical_examiner?.login) || "Медик")
    : "—";
  const mechanicExaminer = mechanicDone
    ? (usableExaminerName(item.mechanic_examiner_name) || usableExaminerName(item.mechanic_examiner?.login) || "Механик")
    : "—";

  return {
    docId: String(item.id),
    id: item.drivers?.driver_id ? `${item.drivers.driver_id}_${item.id}` : item.id,
    driver: item.drivers?.name || "Не указан",
    customer: item.drivers?.customers?.name || "Не указан",
    date: generalTimeFormatted,
    dateISO: targetDateStr,
    status: item.overall_status || "Ожидание",
    documents: {
      license: item.drivers?.license_number || "—",
      licenseExpires: item.drivers?.license_expiry || "—",
      medical: item.drivers?.medical_expiry || "—",
      inspection: item.drivers?.tech_inspection_expiry || "—",
    },
    car: { number: item.drivers?.car_number || "—", brand: item.drivers?.car_brand || "—" },
    medic: medicalExaminer,
    medicTime: medicalTimeFormatted,
    medicStatus: item.medical_status || "Ожидание",
    alcohol: item.breathalyzer_value ?? null,
    bloodPressureSystolic: item.blood_pressure_systolic ?? null,
    bloodPressureDiastolic: item.blood_pressure_diastolic ?? null,
    drugIntoxication: Boolean(item.drug_intoxication),
    mechanic: mechanicExaminer,
    mechanicTime: mechanicTimeFormatted,
    mechanicStatus: item.mechanic_status || "Ожидание",
    inspectionScope: item.inspection_scope || "both",
    isBlacklisted: item.drivers?.is_blacklisted === true,
    mechanicReasons: item.mechanic_issues || [],
    medicalExaminerId: item.medical_examiner_id ?? null,
    mechanicExaminerId: item.mechanic_examiner_id ?? null,
    inspectionPointId: item.inspection_point_id ?? item.drivers?.inspection_point_id ?? null,
  };
};

async function resolveConfiguredExaminer(value: any): Promise<{ id: number | null; name: string }> {
  const raw = String(value ?? "").trim();
  if (!raw) return { id: null, name: "" };
  if (!/^\d+$/.test(raw)) return { id: null, name: raw };
  const id = Number(raw);
  const { data } = await supabase.from("users").select("id,login").eq("id", id).maybeSingle();
  return { id: Number.isFinite(id) ? id : null, name: usableExaminerName(data?.login) || "" };
}

async function getConfiguredExaminers(pointId: number | null) {
  if (!pointId) return { medic: { id: null, name: "" }, mechanic: { id: null, name: "" } };
  const settings = await fetchSystemSettings(pointId);
  return {
    medic: await resolveConfiguredExaminer(settings.medic_surname),
    mechanic: await resolveConfiguredExaminer(settings.mechanic_surname),
  };
}

function buildDateRange(startDateFilter: string, endDateFilter: string) {
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (startDateFilter) {
    const [y, m, d] = startDateFilter.split("-").map(Number);
    startIso = new Date(y, m - 1, d, 0, 0, 0).toISOString();
  }
  if (endDateFilter) {
    const [y, m, d] = endDateFilter.split("-").map(Number);
    endIso = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
  }
  return { startIso, endIso };
}

function applySearchFilter(query: any, term: string) {
  if (!term.trim()) return query;
  const clean = term.trim();
  return query.not("drivers", "is", null).or(
    `name.ilike.%${clean}%,car_number.ilike.%${clean}%,driver_id.ilike.%${clean}%,license_number.ilike.%${clean}%`,
    { foreignTable: "drivers" }
  );
}

function applyJournalFilters(query: any, statusFilter: string, startIso: string | null, endIso: string | null) {
  if (["Допущен", "Не допущен", "Явиться"].includes(statusFilter)) {
    query = query.eq("overall_status", statusFilter);
    if (startIso) query = query.gte("completed_at", startIso);
    if (endIso) query = query.lt("completed_at", endIso);
    return query;
  }
  if (statusFilter === "Ожидание") {
    query = query.eq("overall_status", "Ожидание");
    if (startIso) query = query.gte("requested_at", startIso);
    if (endIso) query = query.lt("requested_at", endIso);
    return query;
  }
  if (startIso && endIso) {
    return query.or(`and(completed_at.gte."${startIso}",completed_at.lt."${endIso}"),and(overall_status.eq.Ожидание,requested_at.gte."${startIso}",requested_at.lt."${endIso}")`);
  }
  if (startIso) return query.or(`completed_at.gte."${startIso}",and(overall_status.eq.Ожидание,requested_at.gte."${startIso}")`);
  if (endIso) return query.or(`completed_at.lt."${endIso}",and(overall_status.eq.Ожидание,requested_at.lt."${endIso}")`);
  return query;
}

interface FetchInspectionsParams {
  currentPage: number;
  statusFilter: string;
  startDateFilter: string;
  endDateFilter: string;
  search: string;
}

const baseSelect = `*, drivers!inspections_driver_id_fkey (id, driver_id, name, license_number, license_expiry, medical_expiry, tech_inspection_expiry, car_brand, car_number, inspection_scope, is_blacklisted, inspection_point_id, customers ( name )), medical_examiner:users!inspections_medical_examiner_id_fkey (id, login), mechanic_examiner:users!inspections_mechanic_examiner_id_fkey (id, login)`;

// Журнал общий: текущий inspection_point_id администратора здесь намеренно не используется.
export async function fetchInspectionsData({ currentPage, statusFilter, startDateFilter, endDateFilter, search }: FetchInspectionsParams) {
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { startIso, endIso } = buildDateRange(startDateFilter, endDateFilter);

  let query = supabase.from("inspections").select(baseSelect, { count: "exact" });
  query = applyJournalFilters(query, statusFilter, startIso, endIso);
  query = applySearchFilter(query, search)
    .order("completed_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("fetchInspectionsData:", error);
    return { formatted: [], totalCount: count ?? 0 };
  }
  return { formatted: (data || []).map(formatInspectionItem), totalCount: count ?? 0 };
}

export async function fetchStatusCounts({ startDateFilter, endDateFilter, search }: { startDateFilter: string; endDateFilter: string; search: string }) {
  const { startIso, endIso } = buildDateRange(startDateFilter, endDateFilter);
  let ids: (string | number)[] | null = null;

  if (search.trim()) {
    const { data, error } = await supabase.from("drivers").select("id").or(`name.ilike.%${search.trim()}%,car_number.ilike.%${search.trim()}%,driver_id.ilike.%${search.trim()}%,license_number.ilike.%${search.trim()}%`);
    if (error) return { "Все": 0, "Допущен": 0, "Ожидание": 0, "Не допущен": 0, "Явиться": 0 };
    ids = (data || []).map((d: any) => d.id);
    if (!ids.length) return { "Все": 0, "Допущен": 0, "Ожидание": 0, "Не допущен": 0, "Явиться": 0 };
  }

  const get = async (status: string | null) => {
    let q = supabase.from("inspections").select("id", { count: "exact", head: true });
    q = applyJournalFilters(q, status ?? "Все", startIso, endIso);
    if (ids) q = q.in("driver_id", ids);
    const { count } = await q;
    return count ?? 0;
  };

  const [all, approved, pending, rejected, summon] = await Promise.all([
    get(null), get("Допущен"), get("Ожидание"), get("Не допущен"), get("Явиться"),
  ]);
  return { "Все": all, "Допущен": approved, "Ожидание": pending, "Не допущен": rejected, "Явиться": summon };
}

// Realtime-журнал должен уметь получить запись независимо от пункта администратора.
export async function fetchSingleInspection(recordId: string | number) {
  const { data, error } = await supabase.from("inspections").select(baseSelect).eq("id", recordId).maybeSingle();
  if (error || !data) return null;
  return formatInspectionItem(data);
}

async function getInspectionForAction(docId: string | number) {
  return supabase
    .from("inspections")
    .select("inspection_scope,blood_pressure_systolic,blood_pressure_diastolic,breathalyzer_value,drug_intoxication,medical_status,mechanic_status,inspection_point_id")
    .eq("id", docId)
    .maybeSingle();
}

export async function updateInspectionMedical(docId: string, now: string, alcoholVal: number, systolic: number | null, diastolic: number | null, drugIntoxication: boolean) {
  const { data: current, error } = await getInspectionForAction(docId);
  if (error || !current) return { data: null, error: error ?? new Error("Не найдена запись осмотра") };
  if (current.inspection_scope === "mechanic") {
    return supabase.from("inspections").update({ medical_status: "Не требуется" }).eq("id", docId);
  }

  const ok = alcoholVal === 0 && !drugIntoxication && isBloodPressureWithinNormalRange(systolic, diastolic);
  const examiners = await getConfiguredExaminers(Number(current.inspection_point_id) || null);
  return supabase.from("inspections").update({
    medical_status: ok ? "Допущен" : "Не допущен",
    medical_date: now,
    breathalyzer_value: alcoholVal,
    blood_pressure_systolic: systolic,
    blood_pressure_diastolic: diastolic,
    drug_intoxication: drugIntoxication,
    medical_examiner_id: examiners.medic.id,
    medical_examiner_name: examiners.medic.name,
  }).eq("id", docId);
}

export async function updateInspectionApprove(docId: string, now: string) {
  const { data: current, error } = await getInspectionForAction(docId);
  if (error || !current) return { data: null, error: error ?? new Error("Не найдена запись осмотра") };
  const examiners = await getConfiguredExaminers(Number(current.inspection_point_id) || null);

  if (current.inspection_scope === "medical") {
    const ok = isBloodPressureWithinNormalRange(current.blood_pressure_systolic ?? 120, current.blood_pressure_diastolic ?? 80)
      && (current.breathalyzer_value ?? 0) === 0 && current.drug_intoxication !== true;
    return supabase.from("inspections").update({
      overall_status: ok ? "Допущен" : "Не допущен",
      medical_status: ok ? "Допущен" : "Не допущен",
      mechanic_status: "Не требуется",
      medical_date: now,
      mechanic_date: null,
      completed_at: now,
      breathalyzer_value: current.breathalyzer_value ?? 0,
      blood_pressure_systolic: current.blood_pressure_systolic ?? 120,
      blood_pressure_diastolic: current.blood_pressure_diastolic ?? 80,
      drug_intoxication: current.drug_intoxication === true,
      mechanic_issues: null,
      medical_examiner_id: examiners.medic.id,
      mechanic_examiner_id: null,
      medical_examiner_name: examiners.medic.name,
      mechanic_examiner_name: null,
    }).eq("id", docId);
  }

  if (current.inspection_scope === "mechanic") {
    return supabase.from("inspections").update({
      overall_status: "Допущен",
      medical_status: "Не требуется",
      mechanic_status: "Допущен",
      medical_date: null,
      mechanic_date: now,
      completed_at: now,
      mechanic_issues: [],
      medical_examiner_id: null,
      mechanic_examiner_id: examiners.mechanic.id,
      medical_examiner_name: null,
      mechanic_examiner_name: examiners.mechanic.name,
    }).eq("id", docId);
  }

  let s = current.blood_pressure_systolic;
  let d = current.blood_pressure_diastolic;
  if (s == null || d == null) { s = 120; d = 80; }
  const ok = isBloodPressureWithinNormalRange(s, d) && (current.breathalyzer_value ?? 0) === 0 && current.drug_intoxication !== true;

  return supabase.from("inspections").update({
    overall_status: ok ? "Допущен" : "Не допущен",
    medical_status: ok ? "Допущен" : "Не допущен",
    mechanic_status: ok ? "Допущен" : "Не допущен",
    medical_date: now,
    mechanic_date: now,
    completed_at: now,
    breathalyzer_value: current.breathalyzer_value ?? 0,
    blood_pressure_systolic: s,
    blood_pressure_diastolic: d,
    drug_intoxication: current.drug_intoxication === true,
    mechanic_issues: ok ? [] : ["Медицинские показатели не соответствуют норме"],
    medical_examiner_id: examiners.medic.id,
    mechanic_examiner_id: examiners.mechanic.id,
    medical_examiner_name: examiners.medic.name,
    mechanic_examiner_name: examiners.mechanic.name,
  }).eq("id", docId);
}

export async function updateInspectionReject(docId: string, now: string, _alcoholVal: number, issuesList: string[], _medStatus: string, _mechStatus: string, _overallStatus: string) {
  const { data: current, error } = await getInspectionForAction(docId);
  if (error || !current) return { data: null, error: error ?? new Error("Не найдена запись осмотра") };
  const mechStatus = issuesList.length ? "Не допущен" : "Допущен";
  const examiners = await getConfiguredExaminers(Number(current.inspection_point_id) || null);

  if (current.inspection_scope === "medical") {
    return supabase.from("inspections").update({
      overall_status: current.medical_status === "Допущен" ? "Допущен" : "Не допущен",
      mechanic_status: "Не требуется",
      mechanic_date: null,
      mechanic_issues: null,
      mechanic_examiner_id: null,
      mechanic_examiner_name: null,
      completed_at: now,
    }).eq("id", docId);
  }

  if (current.inspection_scope === "mechanic") {
    return supabase.from("inspections").update({
      overall_status: mechStatus,
      medical_status: "Не требуется",
      mechanic_status: mechStatus,
      mechanic_date: now,
      completed_at: now,
      mechanic_issues: issuesList,
      medical_date: null,
      breathalyzer_value: null,
      blood_pressure_systolic: null,
      blood_pressure_diastolic: null,
      drug_intoxication: false,
      medical_examiner_id: null,
      mechanic_examiner_id: examiners.mechanic.id,
      medical_examiner_name: null,
      mechanic_examiner_name: examiners.mechanic.name,
    }).eq("id", docId);
  }

  return supabase.from("inspections").update({
    overall_status: current.medical_status === "Допущен" && mechStatus === "Допущен" ? "Допущен" : "Не допущен",
    mechanic_status: mechStatus,
    mechanic_date: now,
    completed_at: now,
    mechanic_issues: issuesList,
    mechanic_examiner_id: examiners.mechanic.id,
    mechanic_examiner_name: examiners.mechanic.name,
  }).eq("id", docId);
}

export async function updateInspectionReset(docId: string) {
  return supabase.from("inspections").update({
    overall_status: "Ожидание",
    medical_status: "Ожидание",
    mechanic_status: "Ожидание",
    medical_date: null,
    mechanic_date: null,
    completed_at: null,
    breathalyzer_value: null,
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    drug_intoxication: false,
    mechanic_issues: [],
    medical_examiner_id: null,
    mechanic_examiner_id: null,
    medical_examiner_name: null,
    mechanic_examiner_name: null,
  }).eq("id", docId);
}

export async function deleteInspectionRecord(docId: string) {
  return supabase.from("inspections").delete().eq("id", docId);
}

export async function updateInspectionSummon(docId: string, _now: string) {
  return supabase.from("inspections").update({
    overall_status: "Явиться",
    medical_status: "Явиться",
    mechanic_status: "Явиться",
    medical_date: null,
    mechanic_date: null,
    completed_at: null,
    breathalyzer_value: null,
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    drug_intoxication: false,
    mechanic_issues: [],
    medical_examiner_id: null,
    mechanic_examiner_id: null,
    medical_examiner_name: null,
    mechanic_examiner_name: null,
  }).eq("id", docId);
}
