import { supabase } from "@/lib/supabase";

export interface SystemSettings {
  id: number;
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

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase.from("system_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as SystemSettings;
}

export async function updateSystemSettings(values: Omit<SystemSettings, "id">) {
  return supabase.from("system_settings").upsert({ id: 1, ...values, updated_at: new Date().toISOString() });
}

export async function updateAdminPassword(userId: number, currentPassword: string, newPassword: string) {
  const { data: user, error: readError } = await supabase.from("users").select("id,password,role").eq("id", userId).eq("role", "admin").single();
  if (readError || !user) return { error: new Error("Администратор не найден") };
  if (user.password !== currentPassword) return { error: new Error("Текущий пароль указан неверно") };
  if (newPassword.trim().length < 6) return { error: new Error("Новый пароль должен содержать минимум 6 символов") };
  const { error } = await supabase.from("users").update({ password: newPassword.trim() }).eq("id", userId).eq("role", "admin");
  return { error };
}
