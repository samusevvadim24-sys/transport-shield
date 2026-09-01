/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { AuthService } from "@/services/auth.service";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";

export const DRIVERS_PAGE_SIZE = 10;
interface FetchDriversParams { currentPage: number; search?: string; }
function toError(error: unknown): Error { if (error instanceof Error) return error; if (typeof error === "object" && error && "message" in error) return new Error(String((error as { message: unknown }).message)); return new Error(String(error)); }
function escapeForOrFilter(value: string): string { return value.replace(/[,.:()]/g, "\\$&"); }
function toDateValue(value: unknown): string | null { const text = String(value ?? "").trim(); if (!text) return null; const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return match ? `${match[3]}-${match[2]}-${match[1]}` : text; }

export async function fetchDrivers({ currentPage, search = "" }: FetchDriversParams) {
  const from = (currentPage - 1) * DRIVERS_PAGE_SIZE; const to = from + DRIVERS_PAGE_SIZE - 1;
  let query = supabase.from("drivers").select(`*, user:users!drivers_userId_fkey (*), customer:customers (*)`, { count: "exact" });
  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());
    const conditions = `name.ilike.%${cleanSearch}%,car_brand.ilike.%${cleanSearch}%,car_number.ilike.%${cleanSearch}%,driver_id.ilike.%${cleanSearch}%,license_number.ilike.%${cleanSearch}%`;
    const { data: matchingCustomers, error: customerSearchError } = await supabase.from("customers").select("id").ilike("name", `%${cleanSearch}%`);
    if (customerSearchError) console.error("Ошибка поиска заказчика для водителей:", customerSearchError);
    if (matchingCustomers?.length) query = query.or(`${conditions},customer_id.in.(${matchingCustomers.map((c) => c.id).join(",")})`);
    else query = query.or(conditions);
  }
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) throw error;
  return { drivers: (data as Driver[]) || [], totalCount: count || 0 };
}

export async function fetchDriverCustomers(): Promise<CustomerOption[]> {
  const { data, error } = await supabase.from("customers").select("id, name, number").order("name", { ascending: true });
  if (error) { console.error("Ошибка при загрузке заказчиков для водителей:", error); return []; }
  return (data as CustomerOption[]) || [];
}

export async function getNextDriverNumber(customerId: string | number): Promise<{ number: string | null; error: Error | null }> {
  try {
    const { data: customer, error: customerError } = await supabase.from("customers").select("number").eq("id", Number(customerId)).maybeSingle();
    if (customerError) return { number: null, error: customerError };
    const customerNumber = String(customer?.number ?? "").trim();
    if (!customerNumber) return { number: null, error: new Error("У выбранного заказчика не указан номер.") };
    const { data: drivers, error } = await supabase.from("drivers").select("driver_id").eq("customer_id", Number(customerId));
    if (error) return { number: null, error };
    const used = new Set<number>();
    for (const row of drivers ?? []) { const value = String(row.driver_id ?? ""); const match = value.match(new RegExp(`^${customerNumber}\\.(\\d+)$`)); if (match) used.add(Number(match[1])); }
    for (let i = 1; i <= 999; i++) if (!used.has(i)) return { number: `${customerNumber}.${i}`, error: null };
    return { number: null, error: new Error("Для этого заказчика заняты все номера от 1 до 999.") };
  } catch (err) { return { number: null, error: toError(err) }; }
}

async function getCurrentAdmin() {
  const session = await AuthService.getServerSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function createDriver(formData: DriverFormData) {
  try {
    if (!String(formData.name ?? "").trim()) return { data: null, error: { message: "ФИО водителя обязательно." } };
    const rawPassword = String(formData.password ?? "");
    if (!rawPassword.trim()) return { data: null, error: { message: "Пароль обязателен." } };
    const nextNumber = await getNextDriverNumber(formData.customer_id);
    if (nextNumber.error || !nextNumber.number) return { data: null, error: { message: nextNumber.error?.message || "Не удалось определить номер водителя." } };
    const session = await getCurrentAdmin();
    if (!session) return { data: null, error: { message: "Не удалось определить текущего администратора. Войдите в систему заново." } };
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const { data: userData, error: userError } = await supabase.rpc("create_driver_user", { p_admin_id: Number(session.id), p_login: nextNumber.number, p_password: passwordHash });
    if (userError) return { data: null, error: userError };
    if (!userData) return { data: null, error: { message: "Не удалось создать пользователя водителя." } };
    const { data: driverData, error: driverError } = await supabase.rpc("create_driver_record", {
      p_admin_id: Number(session.id), p_user_id: Number(userData.id), p_name: String(formData.name).trim(), p_car_brand: String(formData.car_brand ?? "").trim(), p_car_number: String(formData.car_number ?? "").trim(), p_customer_id: Number(formData.customer_id), p_driver_id: nextNumber.number,
      p_insurance_expiry: toDateValue(formData.insurance_expiry) ?? "", p_license_expiry: toDateValue(formData.license_expiry) ?? "", p_license_number: String(formData.license_number ?? "").trim(), p_medical_expiry: toDateValue(formData.medical_expiry) ?? "", p_tech_inspection_expiry: toDateValue(formData.tech_inspection_expiry) ?? ""
    });
    if (driverError) { console.error("Ошибка при создании записи водителя:", driverError); await supabase.from("users").delete().eq("id", Number(userData.id)); return { data: null, error: driverError }; }
    if (!driverData) { await supabase.from("users").delete().eq("id", Number(userData.id)); return { data: null, error: { message: "Не удалось создать запись водителя." } }; }
    const createdDriverId = Number((driverData as any).id);
    if (Number.isFinite(createdDriverId)) {
      const { error: scopeError } = await supabase.from("drivers").update({ inspection_scope: formData.inspection_scope || "both" }).eq("id", createdDriverId);
      if (scopeError) return { data: null, error: scopeError };
      if (formData.is_blacklisted !== undefined) {
        const { error: blacklistError } = await supabase.rpc("set_driver_blacklist", { p_admin_id: Number(session.id), p_driver_id: createdDriverId, p_is_blacklisted: Boolean(formData.is_blacklisted) });
        if (blacklistError) return { data: null, error: blacklistError };
      }
    }
    return { data: driverData, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function updateDriver(id: string | number, formData: DriverFormData, userId?: number | null) {
  try {
    const session = await getCurrentAdmin();
    if (!session) return { data: null, error: { message: "Не удалось определить текущего администратора. Войдите в систему заново." } };
    let passwordHash: string | null = null;
    const rawPassword = String(formData.password ?? "");
    if (rawPassword.trim()) passwordHash = await bcrypt.hash(rawPassword, 12);
    const { data, error } = await supabase.rpc("update_driver_record", {
      p_admin_id: Number(session.id), p_driver_id: Number(id), p_name: String(formData.name ?? "").trim(), p_car_brand: String(formData.car_brand ?? "").trim(), p_car_number: String(formData.car_number ?? "").trim(), p_customer_id: Number(formData.customer_id), p_driver_code: String(formData.driver_id ?? "").trim(), p_insurance_expiry: toDateValue(formData.insurance_expiry), p_license_expiry: toDateValue(formData.license_expiry), p_license_number: String(formData.license_number ?? "").trim(), p_medical_expiry: toDateValue(formData.medical_expiry), p_tech_inspection_expiry: toDateValue(formData.tech_inspection_expiry), p_inspection_scope: formData.inspection_scope || "both", p_login: String(formData.login ?? formData.driver_id ?? "").trim(), p_password: passwordHash
    });
    if (error) return { data: null, error };
    if (!data) return { data: null, error: { message: "Сервер не вернул обновлённую запись водителя." } };
    if (formData.is_blacklisted !== undefined) { const { error: blacklistError } = await supabase.rpc("set_driver_blacklist", { p_admin_id: Number(session.id), p_driver_id: Number(id), p_is_blacklisted: Boolean(formData.is_blacklisted) }); if (blacklistError) return { data: null, error: blacklistError }; }
    return { data, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function deleteDriverRecord(id: string | number, _userId?: number | null) {
  try {
    const session = await getCurrentAdmin();
    if (!session) return { error: { message: "Недостаточно прав для удаления водителя. Войдите как администратор." } };
    const { error } = await supabase.rpc("delete_driver_record", { p_admin_id: Number(session.id), p_driver_id: Number(id) });
    if (error) return { error };
    return { error: null };
  } catch (err) { return { error: { message: toError(err).message } }; }
}