/* eslint-disable @typescript-eslint/no-explicit-any */
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
    const { data: matchingCustomers } = await supabase.from("customers").select("id").ilike("name", `%${cleanSearch}%`);
    if (matchingCustomers?.length) query = query.or(`${conditions},customer_id.in.(${matchingCustomers.map((c) => c.id).join(",")})`); else query = query.or(conditions);
  }
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) throw error;
  return { drivers: (data as Driver[]) || [], totalCount: count || 0 };
}

export async function fetchDriverCustomers(): Promise<CustomerOption[]> {
  const { data, error } = await supabase.from("customers").select("id, name, number").order("name", { ascending: true });
  if (error) return [];
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
    for (const row of drivers ?? []) { const match = String(row.driver_id ?? "").match(new RegExp(`^${customerNumber}\\.(\\d+)$`)); if (match) used.add(Number(match[1])); }
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
    if (!(await getCurrentAdmin())) return { data: null, error: { message: "Не удалось определить текущего администратора. Войдите в систему заново." } };

    const payload = {
      ...formData,
      name: String(formData.name).trim(),
      driver_id: nextNumber.number,
      customer_id: Number(formData.customer_id),
      car_brand: String(formData.car_brand ?? "").trim(),
      car_number: String(formData.car_number ?? "").trim(),
      license_number: String(formData.license_number ?? "").trim(),
      insurance_expiry: toDateValue(formData.insurance_expiry),
      license_expiry: toDateValue(formData.license_expiry),
      medical_expiry: toDateValue(formData.medical_expiry),
      tech_inspection_expiry: toDateValue(formData.tech_inspection_expiry),
    };
    const response = await fetch("/api/admin/drivers", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body.error || "Не удалось создать водителя" } };
    return { data: body.data ?? null, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function updateDriver(id: string | number, formData: DriverFormData, _userId?: number | null) {
  try {
    if (!(await getCurrentAdmin())) return { data: null, error: { message: "Не удалось определить текущего администратора. Войдите в систему заново." } };
    const payload = {
      name: String(formData.name ?? "").trim(), car_brand: String(formData.car_brand ?? "").trim(), car_number: String(formData.car_number ?? "").trim(),
      customer_id: Number(formData.customer_id), driver_id: String(formData.driver_id ?? "").trim(),
      insurance_expiry: toDateValue(formData.insurance_expiry), license_expiry: toDateValue(formData.license_expiry), license_number: String(formData.license_number ?? "").trim(),
      medical_expiry: toDateValue(formData.medical_expiry), tech_inspection_expiry: toDateValue(formData.tech_inspection_expiry), inspection_scope: formData.inspection_scope || "both",
      login: String(formData.login ?? formData.driver_id ?? "").trim(), password: String(formData.password ?? "").trim(),
      is_blacklisted: formData.is_blacklisted,
    };
    const response = await fetch(`/api/admin/drivers/${Number(id)}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body.error || "Не удалось обновить данные водителя" } };
    return { data: body.data ?? null, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function deleteDriverRecord(id: string | number, _userId?: number | null) {
  try {
    if (!(await getCurrentAdmin())) return { error: { message: "Недостаточно прав для удаления водителя. Войдите как администратор." } };
    const response = await fetch(`/api/admin/drivers/${Number(id)}`, { method: "DELETE", credentials: "include" });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { error: null } : { error: { message: body.error || "Не удалось удалить водителя" } };
  } catch (err) { return { error: { message: toError(err).message } }; }
}
