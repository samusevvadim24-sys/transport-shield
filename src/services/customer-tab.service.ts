/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { Inspection } from "../types/database.types";

export const PAGE_SIZE = 30;

const NORMAL_BLOOD_PRESSURE_VALUES = [
  [115, 75], [118, 76], [120, 78], [120, 80], [122, 79],
  [124, 80], [125, 82], [118, 78], [121, 80], [123, 81],
  [116, 76], [119, 79], [122, 80], [125, 80], [117, 77],
] as const;

const MIN_SYSTOLIC = 90;
const MAX_SYSTOLIC = 140;
const MIN_DIASTOLIC = 60;
const MAX_DIASTOLIC = 90;

function getRandomNormalBloodPressure(): readonly [number, number] {
  return NORMAL_BLOOD_PRESSURE_VALUES[
    Math.floor(Math.random() * NORMAL_BLOOD_PRESSURE_VALUES.length)
  ];
}

function isBloodPressureWithinNormalRange(systolic: number | null, diastolic: number | null): boolean {
  if (systolic == null || diastolic == null) return false;
  return systolic >= MIN_SYSTOLIC && systolic <= MAX_SYSTOLIC && diastolic >= MIN_DIASTOLIC && diastolic <= MAX_DIASTOLIC;
}

export const formatInspectionItem = (item: any): Inspection => {
  let medicalTimeFormatted = "—";
  if (item.medical_date) {
    const d = new Date(item.medical_date);
    medicalTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  let mechanicTimeFormatted = "—";
  if (item.mechanic_date) {
    const d = new Date(item.mechanic_date);
    mechanicTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  let generalTimeFormatted = "—";
  const targetDateStr = item.requested_at || item.created_at;
  if (targetDateStr) {
    const d = new Date(targetDateStr);
    generalTimeFormatted = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return {
    docId: String(item.id), id: item.drivers?.driver_id ? `${item.drivers.driver_id}_${item.id}` : item.id,
    driver: item.drivers?.name || "Не указан", customer: item.drivers?.customers?.name || "Не указан",
    date: generalTimeFormatted, dateISO: targetDateStr, status: item.overall_status || "Ожидание",
    documents: { license: item.drivers?.license_number || "—", licenseExpires: item.drivers?.license_expiry || "—", medical: item.drivers?.medical_expiry || "—", inspection: item.drivers?.tech_inspection_expiry || "—" },
    car: { number: item.drivers?.car_number || "—", brand: item.drivers?.car_brand || "—" },
    medic: "Медик", medicTime: medicalTimeFormatted, medicStatus: item.medical_status || "Ожидание",
    alcohol: item.breathalyzer_value ?? null, bloodPressureSystolic: item.blood_pressure_systolic ?? null,
    bloodPressureDiastolic: item.blood_pressure_diastolic ?? null, drugIntoxication: Boolean(item.drug_intoxication),
    mechanic: "Механик", mechanicTime: mechanicTimeFormatted, mechanicStatus: item.mechanic_status || "Ожидание", mechanicReasons: item.mechanic_issues || [],
  };
};

interface FetchInspectionsParams { currentPage: number; statusFilter: string; startDateFilter: string; endDateFilter: string; search: string; }

export async function fetchInspectionsData({ currentPage, statusFilter, startDateFilter, endDateFilter, search }: FetchInspectionsParams) {
  const from = (currentPage - 1) * PAGE_SIZE; const to = from + PAGE_SIZE - 1;
  let startIso: string | null = null; let endIso: string | null = null;
  if (startDateFilter) { const [y, m, d] = startDateFilter.split("-").map(Number); startIso = new Date(y, m - 1, d, 0, 0, 0).toISOString(); }
  if (endDateFilter) { const [y, m, d] = endDateFilter.split("-").map(Number); endIso = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString(); }
  const baseSelect = `*, drivers!inspections_driver_id_fkey (id, driver_id, name, license_number, license_expiry, medical_expiry, tech_inspection_expiry, car_brand, car_number, customers ( name ))`;
  const applySearchFilter = (query: any, searchTerm: string) => { if (!searchTerm) return query; const cleanSearch = searchTerm.trim(); return query.not('drivers', 'is', null).or(`name.ilike.%${cleanSearch}%,car_number.ilike.%${cleanSearch}%,driver_id.ilike.%${cleanSearch}%,license_number.ilike.%${cleanSearch}%`, { foreignTable: "drivers" }); };
  let query = supabase.from("inspections").select(baseSelect, { count: "exact" });
  if (statusFilter === "Допущен" || statusFilter === "Не допущен" || statusFilter === "Явиться") { query = query.eq("overall_status", statusFilter); if (startIso) query = query.gte("completed_at", startIso); if (endIso) query = query.lt("completed_at", endIso); }
  else if (statusFilter === "Ожидание") { query = query.eq("overall_status", "Ожидание"); if (startIso) query = query.gte("requested_at", startIso); if (endIso) query = query.lt("requested_at", endIso); }
  else { if (startIso && endIso) query = query.or(`and(completed_at.gte."${startIso}",completed_at.lt."${endIso}"),and(overall_status.eq.Ожидание,requested_at.gte."${startIso}",requested_at.lt."${endIso}")`); else if (startIso) query = query.or(`completed_at.gte."${startIso}",and(overall_status.eq.Ожидание,requested_at.gte."${startIso}")`); else if (endIso) query = query.or(`completed_at.lt."${endIso}",and(overall_status.eq.Ожидание,requested_at.lt."${endIso}")`); }
  query = applySearchFilter(query, search).order("completed_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).range(from, to);
  const { data, error, count } = await query;
  if (error) { console.error("Ошибка при загрузке осмотров:", error.message); if (error.code === 'PGRST103' || error.message.includes('Requested range not satisfiable')) return { formatted: [], totalCount: count ?? 0 }; return { formatted: [], totalCount: 0 }; }
  return { formatted: (data || []).map(formatInspectionItem), totalCount: count ?? 0 };
}

export async function fetchStatusCounts({ startDateFilter, endDateFilter, search }: { startDateFilter: string; endDateFilter: string; search: string }) {
  let startIso: string | null = null; let endIso: string | null = null;
  if (startDateFilter) { const [y, m, d] = startDateFilter.split("-").map(Number); startIso = new Date(y, m - 1, d, 0, 0, 0).toISOString(); }
  if (endDateFilter) { const [y, m, d] = endDateFilter.split("-").map(Number); endIso = new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString(); }
  let matchingDriverIds: (string | number)[] | null = null;
  if (search && search.trim()) { const cleanSearch = search.trim(); const { data: matchedDrivers, error: driversError } = await supabase.from("drivers").select("id").or(`name.ilike.%${cleanSearch}%,car_number.ilike.%${cleanSearch}%,driver_id.ilike.%${cleanSearch}%,license_number.ilike.%${cleanSearch}%`); if (driversError) { console.error("Ошибка при поиске водителей для счётчиков:", driversError.message); return { Все: 0, Допущен: 0, Ожидание: 0, "Не допущен": 0, "Явиться": 0 }; } matchingDriverIds = (matchedDrivers || []).map((d: any) => d.id); if (matchingDriverIds.length === 0) return { Все: 0, Допущен: 0, Ожидание: 0, "Не допущен": 0, "Явиться": 0 }; }
  const getCountForStatus = async (status: string | null) => { let query = supabase.from("inspections").select("id", { count: "exact", head: true }); if (status === "Допущен" || status === "Не допущен" || status === "Явиться") { query = query.eq("overall_status", status); if (startIso) query = query.gte("completed_at", startIso); if (endIso) query = query.lt("completed_at", endIso); } else if (status === "Ожидание") { query = query.eq("overall_status", "Ожидание"); if (startIso) query = query.gte("requested_at", startIso); if (endIso) query = query.lt("requested_at", endIso); } else { if (startIso && endIso) query = query.or(`and(completed_at.gte."${startIso}",completed_at.lt."${endIso}"),and(overall_status.eq.Ожидание,requested_at.gte."${startIso}",requested_at.lt."${endIso}")`); else if (startIso) query = query.or(`completed_at.gte."${startIso}",and(overall_status.eq.Ожидание,requested_at.gte."${startIso}")`); else if (endIso) query = query.or(`completed_at.lt."${endIso}",and(overall_status.eq.Ожидание,requested_at.lt."${endIso}")`); } if (matchingDriverIds) query = query.in("driver_id", matchingDriverIds); const { count, error } = await query; if (error) { console.error("Ошибка при подсчёте статусов:", error.message); return 0; } return count ?? 0; };
  const [all, approved, pending, rejected, summon] = await Promise.all([getCountForStatus(null), getCountForStatus("Допущен"), getCountForStatus("Ожидание"), getCountForStatus("Не допущен"), getCountForStatus("Явиться")]);
  return { Все: all, Допущен: approved, Ожидание: pending, "Не допущен": rejected, "Явиться": summon };
}

export async function fetchSingleInspection(recordId: string | number) { const { data, error } = await supabase.from("inspections").select(`*, drivers!inspections_driver_id_fkey (id, driver_id, name, license_number, license_expiry, medical_expiry, tech_inspection_expiry, car_brand, car_number, customers ( name ))`).eq("id", recordId).single(); if (error || !data) return null; return formatInspectionItem(data); }

export async function updateInspectionMedical(docId: string, now: string, alcoholVal: number, systolic: number | null, diastolic: number | null, drugIntoxication: boolean) {
  const pressureOk = isBloodPressureWithinNormalRange(systolic, diastolic);
  const medStatus = alcoholVal === 0 && !drugIntoxication && pressureOk ? "Допущен" : "Не допущен";
  return await supabase.from("inspections").update({ medical_status: medStatus, medical_date: now, breathalyzer_value: alcoholVal, blood_pressure_systolic: systolic, blood_pressure_diastolic: diastolic, drug_intoxication: drugIntoxication }).eq("id", docId);
}

export async function updateInspectionApprove(docId: string, now: string) {
  const { data: current, error: readError } = await supabase.from("inspections").select("blood_pressure_systolic,blood_pressure_diastolic,breathalyzer_value,drug_intoxication").eq("id", docId).single();
  if (readError || !current) return { data: null, error: readError ?? new Error("Не найдена запись осмотра") };

  let systolic = current.blood_pressure_systolic;
  let diastolic = current.blood_pressure_diastolic;
  if (systolic == null || diastolic == null) [systolic, diastolic] = getRandomNormalBloodPressure();

  const pressureOk = isBloodPressureWithinNormalRange(systolic, diastolic);
  const alcoholOk = (current.breathalyzer_value ?? 0) === 0;
  const drugsOk = current.drug_intoxication !== true;
  const medicalOk = pressureOk && alcoholOk && drugsOk;
  const overallStatus = medicalOk ? "Допущен" : "Не допущен";

  return await supabase.from("inspections").update({ overall_status: overallStatus, medical_status: medicalOk ? "Допущен" : "Не допущен", mechanic_status: medicalOk ? "Допущен" : "Не допущен", medical_date: now, mechanic_date: now, completed_at: now, breathalyzer_value: current.breathalyzer_value ?? 0.0, blood_pressure_systolic: systolic, blood_pressure_diastolic: diastolic, drug_intoxication: current.drug_intoxication === true, mechanic_issues: medicalOk ? [] : ["Медицинские показатели не соответствуют норме"] }).eq("id", docId);
}

export async function updateInspectionReject(docId: string, now: string, _alcoholVal: number, issuesList: string[], _medStatus: string, _mechStatus: string, _overallStatus: string) {
  const { data: current, error: readError } = await supabase.from("inspections").select("medical_status").eq("id", docId).single();
  if (readError || !current) return { data: null, error: readError ?? new Error("Не найдена запись осмотра") };
  const mechStatus = issuesList.length === 0 ? "Допущен" : "Не допущен";
  const overallStatus = current.medical_status === "Допущен" && mechStatus === "Допущен" ? "Допущен" : "Не допущен";
  return await supabase.from("inspections").update({ overall_status: overallStatus, mechanic_status: mechStatus, mechanic_date: now, completed_at: now, mechanic_issues: issuesList }).eq("id", docId);
}

export async function updateInspectionReset(docId: string) { return await supabase.from("inspections").update({ overall_status: "Ожидание", medical_status: "Ожидание", mechanic_status: "Ожидание", medical_date: null, mechanic_date: null, completed_at: null, breathalyzer_value: null, blood_pressure_systolic: null, blood_pressure_diastolic: null, drug_intoxication: false, mechanic_issues: [] }).eq("id", docId); }
export async function deleteInspectionRecord(docId: string) { return await supabase.from("inspections").delete().eq("id", docId); }
export async function updateInspectionSummon(docId: string, now: string) { return await supabase.from("inspections").update({ overall_status: "Явиться", medical_date: now, mechanic_date: now, completed_at: now }).eq("id", docId); }
