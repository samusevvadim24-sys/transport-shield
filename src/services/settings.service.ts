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

const EMPTY: SystemSettings = {
  id: 1,
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

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("id, medic_last_name, mechanic_last_name, medical_inspection_price, mechanic_inspection_price, organization_name, organization_address, organization_bank_account, organization_unp, organization_phone, organization_email, director_name")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY;
  return {
    id: Number(data.id),
    medic_surname: data.medic_last_name ?? "",
    mechanic_surname: data.mechanic_last_name ?? "",
    medical_exam_price: Number(data.medical_inspection_price ?? 0.9),
    mechanic_exam_price: Number(data.mechanic_inspection_price ?? 0.9),
    organization_name: data.organization_name ?? "",
    organization_address: data.organization_address ?? "",
    organization_bank_account: data.organization_bank_account ?? "",
    organization_unp: data.organization_unp ?? "",
    organization_phone: data.organization_phone ?? "",
    organization_email: data.organization_email ?? "",
    organization_director_name: data.director_name ?? "",
  };
}

export async function updateSystemSettings(values: Omit<SystemSettings, "id">) {
  return supabase.from("system_settings").upsert({
    id: 1,
    medic_last_name: values.medic_surname.trim(),
    mechanic_last_name: values.mechanic_surname.trim(),
    medical_inspection_price: Number(values.medical_exam_price) || 0,
    mechanic_inspection_price: Number(values.mechanic_exam_price) || 0,
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

  const { data: user, error: readError } = await supabase
    .from("users")
    .select("id,password,role")
    .eq("id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (readError) return { error: readError };
  if (!user) return { error: new Error("Администратор не найден") };
  if (user.password !== current) return { error: new Error("Текущий пароль указан неверно") };

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({ password: next })
    .eq("id", userId)
    .eq("role", "admin")
    .select("id")
    .maybeSingle();

  if (updateError) return { error: updateError };
  if (!updatedUser) {
    return { error: new Error("Пароль не изменён: база данных не вернула обновлённую запись. Проверьте RLS для public.users.") };
  }
  return { error: null };
}
