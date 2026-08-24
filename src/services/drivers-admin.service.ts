/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { AuthService } from "@/services/auth.service";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";

export const DRIVERS_PAGE_SIZE = 10;
interface FetchDriversParams { currentPage: number; search?: string; }

function toError(error: unknown): Error { if (error instanceof Error) return error; if (typeof error === "object" && error && "message" in error) return new Error(String((error as { message: unknown }).message)); return new Error(String(error)); }
function escapeForOrFilter(value: string): string { return value.replace(/[,.:()]/g, "\\$&"); }

export async function fetchDrivers({ currentPage, search = "" }: FetchDriversParams) {
  const from = (currentPage - 1) * DRIVERS_PAGE_SIZE; const to = from + DRIVERS_PAGE_SIZE - 1;
  let query = supabase.from("drivers").select(`*, user:users!drivers_userId_fkey (*), customer:customers (*)`, { count: "exact" });
  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());
    const conditions = `name.ilike.%${cleanSearch}%,car_brand.ilike.%${cleanSearch}%,car_number.ilike.%${cleanSearch}%,driver_id.ilike.%${cleanSearch}%,license_number.ilike.%${cleanSearch}%`;
    const { data: matchingCustomers, error: customerSearchError } = await supabase.from("customers").select("id").ilike("name", `%${cleanSearch}%`);
    if (customerSearchError) console.error("Ошибка поиска заказчика для водителей:", customerSearchError);
    if (matchingCustomers?.length) query = query.or(`${conditions},customer_id.in.(${matchingCustomers.map((c) => c.id).join(",")})`); else query = query.or(conditions);
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
    for (const row of drivers ?? []) {
      const value = String(row.driver_id ?? "");
      const match = value.match(new RegExp(`^${customerNumber}\\.(\\d+)$`));
      if (match) used.add(Number(match[1]));
    }
    for (let i = 1; i <= 999; i++) if (!used.has(i)) return { number: `${customerNumber}.${i}`, error: null };
    return { number: null, error: new Error("Для этого заказчика заняты все номера от 1 до 999.") };
  } catch (err) { return { number: null, error: toError(err) }; }
}

export async function createDriver(formData: DriverFormData) {
  try {
    if (!String(formData.name ?? "").trim()) return { data: null, error: { message: "ФИО водителя обязательно." } };
    if (!String(formData.password ?? "").trim()) return { data: null, error: { message: "Пароль обязателен." } };

    const nextNumber = await getNextDriverNumber(formData.customer_id);
    if (nextNumber.error || !nextNumber.number) return { data: null, error: { message: nextNumber.error?.message || "Не удалось определить номер водителя." } };

    const session = AuthService.getSession();
    if (!session || session.role !== "admin") {
      return { data: null, error: { message: "Не удалось определить текущего администратора. Войдите в систему заново." } };
    }

    // Пользователи хранятся только в public.users. Создание выполняется
    // через SECURITY DEFINER RPC, которая проверяет p_admin_id в public.users.
    const { data: userData, error: userError } = await supabase.rpc("create_driver_user", {
      p_admin_id: Number(session.id),
      p_login: nextNumber.number,
      p_password: String(formData.password).trim(),
    });

    if (userError) return { data: null, error: userError };
    if (!userData) return { data: null, error: { message: "Не удалось создать пользователя водителя." } };

    const { data: driverData, error: driverError } = await supabase.from("drivers").insert({
      name: formData.name, car_brand: formData.car_brand, car_number: formData.car_number, customer_id: Number(formData.customer_id), user_id: userData.id,
      driver_id: nextNumber.number, insurance_expiry: formData.insurance_expiry || null, license_expiry: formData.license_expiry || null,
      license_number: formData.license_number || null, medical_expiry: formData.medical_expiry || null, tech_inspection_expiry: formData.tech_inspection_expiry || null,
    }).select().maybeSingle();

    if (driverError) {
      // Не падаем на удалении пользователя, если RLS не разрешает удаление:
      // основная ошибка создания водителя должна быть возвращена вызывающему коду.
      console.error("Ошибка при создании записи водителя после создания users:", driverError);
      return { data: null, error: driverError };
    }

    return { data: driverData, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function updateDriver(id: string | number, formData: DriverFormData, userId?: number | null) {
  try {
    if (userId) {
      const userUpdates: Record<string, any> = { login: formData.login }; if (formData.password?.trim()) userUpdates.password = formData.password;
      const { error: userError } = await supabase.from("users").update(userUpdates).eq("id", userId); if (userError) return { data: null, error: userError };
    }
    const { data, error } = await supabase.from("drivers").update({ name: formData.name, car_brand: formData.car_brand, car_number: formData.car_number, customer_id: Number(formData.customer_id), driver_id: formData.driver_id || null, insurance_expiry: formData.insurance_expiry || null, license_expiry: formData.license_expiry || null, license_number: formData.license_number || null, medical_expiry: formData.medical_expiry || null, tech_inspection_expiry: formData.tech_inspection_expiry || null }).eq("id", id).select().maybeSingle();
    if (error) return { data: null, error }; return { data, error: null };
  } catch (err) { return { data: null, error: { message: toError(err).message } }; }
}

export async function deleteDriverRecord(id: string | number, userId?: number | null) {
  try {
    const { error: driverError } = await supabase.from("drivers").delete().eq("id", id); if (driverError) return { error: driverError };
    if (userId) { const { error: userError } = await supabase.from("users").delete().eq("id", userId); if (userError) console.error("Ошибка при удалении связанного пользователя водителя:", userError); }
    return { error: null };
  } catch (err) { return { error: { message: toError(err).message } }; }
}