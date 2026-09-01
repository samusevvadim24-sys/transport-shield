import { supabase } from "@/lib/supabase";
import { AuthService } from "@/services/auth.service";
import type { InspectionPoint } from "@/types/database.types";

export interface SystemSettings {
  id: number;
  inspection_point_id: number | null;
  inspection_point_name: string;
  inspection_point_address: string;
  medic_surname: string;
  mechanic_surname: string;
  medical_exam_price: number;
  mechanic_exam_price: number;
  organization_name: string;
  organization_address: string;
  organization_bank_account: string;
  organization_unp: string;
  organization_phone: string;
  organization_email: string;
  organization_director_name: string;
}

const EMPTY: SystemSettings = { id: 1, inspection_point_id: null, inspection_point_name: "", inspection_point_address: "", medic_surname: "", mechanic_surname: "", medical_exam_price: 0.9, mechanic_exam_price: 0.9, organization_name: "", organization_address: "", organization_bank_account: "", organization_unp: "", organization_phone: "", organization_email: "", organization_director_name: "" };

async function currentAdminId() {
  if (typeof window === "undefined") return null;
  const session = await AuthService.getServerSession();
  if (!session || session.role !== "admin") return null;
  const id = Number(session.id);
  return Number.isFinite(id) ? id : null;
}

export async function fetchInspectionPoints(): Promise<InspectionPoint[]> {
  const { data, error } = await supabase.from("inspection_points").select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price").order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((point: any) => ({ id: Number(point.id), name: point.name ?? "", address: point.address ?? "", medic_surname: point.medic_surname ?? "", mechanic_surname: point.mechanic_surname ?? "", medical_exam_price: Number(point.medical_exam_price ?? 0.9), mechanic_exam_price: Number(point.mechanic_exam_price ?? 0.9) }));
}

export async function fetchAdminInspectionPointId() {
  const id = await currentAdminId();
  if (!id) return null;
  const { data, error } = await supabase.from("users").select("inspection_point_id").eq("id", id).eq("role", "admin").maybeSingle();
  if (error) throw error;
  const pointId = Number(data?.inspection_point_id);
  return Number.isFinite(pointId) && pointId > 0 ? pointId : null;
}

export async function updateAdminInspectionPoint(pointId: number) {
  const id = await currentAdminId();
  if (!id) return { error: new Error("Сессия администратора не найдена") };
  if (!Number.isFinite(pointId) || pointId <= 0) return { error: new Error("Некорректный пункт осмотра") };
  const { data, error } = await supabase.from("users").update({ inspection_point_id: pointId }).eq("id", id).eq("role", "admin").select("id,inspection_point_id").maybeSingle();
  if (error) return { error };
  if (!data) return { error: new Error("Не удалось назначить пункт осмотра администратору") };
  return { error: null };
}

export async function fetchSystemSettings(pointId?: number | null): Promise<SystemSettings> {
  const resolved = pointId ?? await fetchAdminInspectionPointId();
  if (!resolved) return { ...EMPTY };
  const [{ data: org, error: orgError }, { data: point, error: pointError }] = await Promise.all([
    supabase.from("system_settings").select("id,organization_name,organization_address,organization_bank_account,organization_unp,organization_phone,organization_email,director_name").eq("id", 1).maybeSingle(),
    supabase.from("inspection_points").select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price").eq("id", resolved).maybeSingle(),
  ]);
  if (orgError) throw orgError;
  if (pointError) throw pointError;
  if (!point) return { ...EMPTY, inspection_point_id: resolved };
  return { id: Number(org?.id ?? 1), inspection_point_id: Number(point.id), inspection_point_name: point.name ?? "", inspection_point_address: point.address ?? "", medic_surname: point.medic_surname ?? "", mechanic_surname: point.mechanic_surname ?? "", medical_exam_price: Number(point.medical_exam_price ?? 0.9), mechanic_exam_price: Number(point.mechanic_exam_price ?? 0.9), organization_name: org?.organization_name ?? "", organization_address: org?.organization_address ?? "", organization_bank_account: org?.organization_bank_account ?? "", organization_unp: org?.organization_unp ?? "", organization_phone: org?.organization_phone ?? "", organization_email: org?.organization_email ?? "", organization_director_name: org?.director_name ?? "" };
}

export async function updateInspectionPointSettings(pointId: number, values: { name?: string; address: string; medic_surname: string; mechanic_surname: string; medical_exam_price: number; mechanic_exam_price: number }) {
  if (!Number.isFinite(pointId) || pointId <= 0) return { data: null, error: new Error("Некорректный пункт осмотра") };
  const payload = { ...(values.name?.trim() ? { name: values.name.trim() } : {}), address: values.address.trim(), medic_surname: values.medic_surname.trim(), mechanic_surname: values.mechanic_surname.trim(), medical_exam_price: Math.max(0, Number(values.medical_exam_price) || 0), mechanic_exam_price: Math.max(0, Number(values.mechanic_exam_price) || 0), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("inspection_points").update(payload).eq("id", pointId).select("id,name,address,medic_surname,mechanic_surname,medical_exam_price,mechanic_exam_price").maybeSingle();
  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error("Настройки пункта не сохранены. Проверьте RLS/права UPDATE для inspection_points.") };
  return { data, error: null };
}

export async function updateSystemSettings(values: Pick<SystemSettings, "organization_name" | "organization_address" | "organization_bank_account" | "organization_unp" | "organization_phone" | "organization_email" | "organization_director_name">) {
  return supabase.from("system_settings").upsert({ id: 1, organization_name: values.organization_name.trim(), organization_address: values.organization_address.trim(), organization_bank_account: values.organization_bank_account.trim(), organization_unp: values.organization_unp.trim(), organization_phone: values.organization_phone.trim(), organization_email: values.organization_email.trim(), director_name: values.organization_director_name.trim(), updated_at: new Date().toISOString() });
}

export async function updateAdminPassword(userId: number, currentPassword: string, newPassword: string) {
  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current) return { error: new Error("Введите текущий пароль") };
  if (!next) return { error: new Error("Введите новый пароль") };
  if (next.length < 6) return { error: new Error("Новый пароль должен содержать минимум 6 символов") };
  if (current === next) return { error: new Error("Новый пароль должен отличаться от текущего") };

  const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ userId, currentPassword: current, newPassword: next }) });
  let body: { error?: string } = {};
  try { body = await response.json(); } catch { /* ignore invalid response */ }
  if (!response.ok) return { error: new Error(body.error || "Не удалось изменить пароль") };
  return { error: null };
}
