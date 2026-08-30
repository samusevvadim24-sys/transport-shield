import { supabase } from "@/lib/supabase";
import { AuthService } from "@/services/auth.service";
import type { InspectionPoint } from "@/types/database.types";

export interface SystemSettings {
  id: number;
  inspection_point_id: number | null;
  inspection_point_name: string;
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

const EMPTY: SystemSettings = {
  id: 1,
  inspection_point_id: null,
  inspection_point_name: "",
  medic_surname: "",
  mechanic_surname: "",
  medical_exam_price: 0.9,
  mechanic_exam_price: 0.9,
  organization_name: "",
  organization_address: "",
  organization_bank_account: "",
  organization_unp: "",
  organization_phone: "",
  organization_email: "",
  organization_director_name: "",
};

function currentAdminId(): number | null {
  if (typeof window === "undefined") return null;
  const session = AuthService.getSession();
  if (!session || session.role !== "admin") return null;
  const id = Number(session.id);
  return Number.isFinite(id) ? id : null;
}

export async function fetchInspectionPoints(): Promise<InspectionPoint[]> {
  const { data, error } = await supabase
    .from("inspection_points")
    .select("id,name,address,medic_last_name,mechanic_last_name,medical_inspection_price,mechanic_inspection_price")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    name: row.name ?? "",
    address: row.address ?? "",
    medic_last_name: row.medic_last_name ?? "",
    mechanic_last_name: row.mechanic_last_name ?? "",
    medical_inspection_price: Number(row.medical_inspection_price ?? 0.9),
    mechanic_inspection_price: Number(row.mechanic_inspection_price ?? 0.9),
  }));
}

export async function fetchAdminInspectionPointId(): Promise<number | null> {
  const adminId = currentAdminId();
  if (!adminId) return null;
  const { data, error } = await supabase.from("users").select("inspection_point_id").eq("id", adminId).eq("role", "admin").maybeSingle();
  if (error) throw error;
  const id = Number(data?.inspection_point_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function updateAdminInspectionPoint(pointId: number) {
  const adminId = currentAdminId();
  if (!adminId) return { error: new Error("Сессия администратора не найдена") };
  if (!Number.isFinite(pointId) || pointId <= 0) return { error: new Error("Некорректный пункт осмотра") };
  const { data, error } = await supabase.from("users").update({ inspection_point_id: pointId }).eq("id", adminId).eq("role", "admin").select("id,inspection_point_id").maybeSingle();
  if (error) return { error };
  if (!data) return { error: new Error("Не удалось назначить пункт осмотра администратору") };
  return { error: null };
}

export async function fetchSystemSettings(pointId?: number | null): Promise<SystemSettings> {
  let resolvedPointId = pointId ?? null;
  if (!resolvedPointId) resolvedPointId = await fetchAdminInspectionPointId();
  if (!resolvedPointId) resolvedPointId = 1;

  const [{ data: org, error: orgError }, { data: point, error: pointError }] = await Promise.all([
    supabase.from("system_settings").select("id,organization_name,organization_address,organization_bank_account,organization_unp,organization_phone,organization_email,director_name").eq("id", 1).maybeSingle(),
    supabase.from("inspection_points").select("id,name,address,medic_last_name,mechanic_last_name,medical_inspection_price,mechanic_inspection_price").eq("id", resolvedPointId).maybeSingle(),
  ]);
  if (orgError) throw orgError;
  if (pointError) throw pointError;
  if (!point) return EMPTY;

  return {
    id: Number(org?.id ?? 1),
    inspection_point_id: Number(point.id),
    inspection_point_name: point.name ?? "",
    medic_surname: point.medic_last_name ?? "",
    mechanic_surname: point.mechanic_last_name ?? "",
    medical_exam_price: Number(point.medical_inspection_price ?? 0.9),
    mechanic_exam_price: Number(point.mechanic_inspection_price ?? 0.9),
    organization_name: org?.organization_name ?? "",
    organization_address: org?.organization_address ?? "",
    organization_bank_account: org?.organization_bank_account ?? "",
    organization_unp: org?.organization_unp ?? "",
    organization_phone: org?.organization_phone ?? "",
    organization_email: org?.organization_email ?? "",
    organization_director_name: org?.director_name ?? "",
  };
}

export async function updateInspectionPointSettings(pointId: number, values: Pick<SystemSettings, "medic_surname" | "mechanic_surname" | "medical_exam_price" | "mechanic_exam_price"> & { address: string; name?: string }) {
  return supabase.from("inspection_points").update({
    name: values.name?.trim() || undefined,
    address: values.address.trim(),
    medic_last_name: values.medic_surname.trim(),
    mechanic_last_name: values.mechanic_surname.trim(),
    medical_inspection_price: Number(values.medical_exam_price) || 0,
    mechanic_inspection_price: Number(values.mechanic_exam_price) || 0,
    updated_at: new Date().toISOString(),
  }).eq("id", pointId);
}

export async function updateSystemSettings(values: Omit<SystemSettings, "id" | "inspection_point_id" | "inspection_point_name">) {
  return supabase.from("system_settings").upsert({
    id: 1,
    organization_name: values.organization_name.trim(),
    organization_address: values.organization_address.trim(),
    organization_bank_account: values.organization_bank_account.trim(),
    organization_unp: values.organization_unp.trim(),
    organization_phone: values.organization_phone.trim(),
    organization_email: values.organization_email.trim(),
    director_name: values.organization_director_name.trim(),
    updated_at: new Date().toISOString(),
  });
}

export async function updateAdminPassword(userId: number, currentPassword: string, newPassword: string) {
  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current) return { error: new Error("Введите текущий пароль") };
  if (!next) return { error: new Error("Введите новый пароль") };
  if (next.length < 6) return { error: new Error("Новый пароль должен содержать минимум 6 символов") };
  if (current === next) return { error: new Error("Новый пароль должен отличаться от текущего") };

  const { data: user, error: readError } = await supabase.from("users").select("id,password,role").eq("id", userId).eq("role", "admin").maybeSingle();
  if (readError) return { error: readError };
  if (!user) return { error: new Error("Администратор не найден") };
  if (user.password !== current) return { error: new Error("Текущий пароль указан неверно") };

  const { data: updatedUser, error: updateError } = await supabase.from("users").update({ password: next }).eq("id", userId).eq("role", "admin").select("id").maybeSingle();
  if (updateError) return { error: updateError };
  if (!updatedUser) return { error: new Error("Пароль не изменён: база данных не вернула обновлённую запись. Проверьте RLS для public.users.") };
  return { error: null };
}
