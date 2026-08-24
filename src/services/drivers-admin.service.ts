/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";

export const DRIVERS_PAGE_SIZE = 10;

interface FetchDriversParams {
  currentPage: number;
  search?: string;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error && "message" in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(String(error));
}

function escapeForOrFilter(value: string): string {
  return value.replace(/[,.:()]/g, "\\$&");
}

// 1. Получение списка водителей с пагинацией и поиском
export async function fetchDrivers({
  currentPage,
  search = "",
}: FetchDriversParams) {
  const from = (currentPage - 1) * DRIVERS_PAGE_SIZE;
  const to = from + DRIVERS_PAGE_SIZE - 1;

  let query = supabase.from("drivers").select(
    `
      *,
      user:users!drivers_userId_fkey (*),
      customer:customers (*)
    `,
    { count: "exact" }
  );

  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());
    const conditions =
      `name.ilike.%${cleanSearch}%,` +
      `car_brand.ilike.%${cleanSearch}%,` +
      `car_number.ilike.%${cleanSearch}%,` +
      `driver_id.ilike.%${cleanSearch}%,` +
      `license_number.ilike.%${cleanSearch}%`;

    query = query.or(conditions);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Ошибка при получении водителей:", error);
    throw error;
  }

  return {
    drivers: (data as Driver[]) || [],
    totalCount: count || 0,
  };
}

// 2. Получение списка заказчиков для выпадающего списка
export async function fetchDriverCustomers(): Promise<CustomerOption[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Ошибка при загрузке заказчиков для водителей:", error);
    return [];
  }

  return (data as CustomerOption[]) || [];
}

// 3. Создание водителя (совместно с пользователем в таблице users)
export async function createDriver(formData: DriverFormData) {
  try {
    if (!String(formData.name ?? "").trim()) {
      return { data: null, error: { message: "ФИО водителя обязательно." } };
    }
    if (!String(formData.login ?? "").trim()) {
      return { data: null, error: { message: "Логин обязателен." } };
    }
    if (!String(formData.password ?? "").trim()) {
      return { data: null, error: { message: "Пароль обязателен." } };
    }

    // Создаем пользователя
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        login: formData.login,
        password: formData.password,
        role: "driver",
      })
      .select()
      .maybeSingle();

    if (userError) return { data: null, error: userError };
    if (!userData) return { data: null, error: { message: "Не удалось создать пользователя." } };

    // Создаем водителя
    const { data: driverData, error: driverError } = await supabase
      .from("drivers")
      .insert({
        name: formData.name,
        car_brand: formData.car_brand,
        car_number: formData.car_number,
        customer_id: Number(formData.customer_id),
        user_id: userData.id,
        driver_id: formData.driver_id || null,
        insurance_expiry: formData.insurance_expiry || null,
        license_expiry: formData.license_expiry || null,
        license_number: formData.license_number || null,
        medical_expiry: formData.medical_expiry || null,
        tech_inspection_expiry: formData.tech_inspection_expiry || null,
      })
      .select()
      .maybeSingle();

    if (driverError) {
      // Откат создания пользователя при ошибке водителя
      await supabase.from("users").delete().eq("id", userData.id);
      return { data: null, error: driverError };
    }

    return { data: driverData, error: null };
  } catch (err) {
    return { data: null, error: { message: toError(err).message } };
  }
}

// 4. Обновление водителя
export async function updateDriver(
  id: string | number,
  formData: DriverFormData,
  userId?: number | null
) {
  try {
    if (userId) {
      const userUpdates: Record<string, any> = { login: formData.login };
      if (formData.password && formData.password.trim() !== "") {
        userUpdates.password = formData.password;
      }

      const { error: userError } = await supabase
        .from("users")
        .update(userUpdates)
        .eq("id", userId);

      if (userError) return { data: null, error: userError };
    }

    const { data, error } = await supabase
      .from("drivers")
      .update({
        name: formData.name,
        car_brand: formData.car_brand,
        car_number: formData.car_number,
        customer_id: Number(formData.customer_id),
        driver_id: formData.driver_id || null,
        insurance_expiry: formData.insurance_expiry || null,
        license_expiry: formData.license_expiry || null,
        license_number: formData.license_number || null,
        medical_expiry: formData.medical_expiry || null,
        tech_inspection_expiry: formData.tech_inspection_expiry || null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) return { data: null, error };

    return { data, error: null };
  } catch (err) {
    return { data: null, error: { message: toError(err).message } };
  }
}

// 5. Удаление водителя и связанного пользователя
export async function deleteDriverRecord(
  id: string | number,
  userId?: number | null
) {
  try {
    const { error: driverError } = await supabase
      .from("drivers")
      .delete()
      .eq("id", id);

    if (driverError) {
      return { error: driverError };
    }

    if (userId) {
      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);

      if (userError) {
        console.error("Ошибка при удалении связанного пользователя водителя:", userError);
      }
    }

    return { error: null };
  } catch (err) {
    return { error: { message: toError(err).message } };
  }
}