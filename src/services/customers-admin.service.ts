import { supabase } from "@/lib/supabase";
import { DatabaseCustomer } from "../types/database.types";

export const CUSTOMERS_PAGE_SIZE = 10;

interface FetchCustomersParams { currentPage: number; search?: string; }

function escapeForOrFilter(value: string): string {
  return value.replace(/[,.:()]/g, "\\$&");
}

export async function fetchCustomers({ currentPage, search = "" }: FetchCustomersParams) {
  const from = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
  const to = from + CUSTOMERS_PAGE_SIZE - 1;
  let query = supabase.from("customers").select("*", { count: "exact" });

  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());
    const conditions = `name.ilike.%${cleanSearch}%,unp.ilike.%${cleanSearch}%,contract_number.ilike.%${cleanSearch}%,number.ilike.%${cleanSearch}%`;
    query = query.or(conditions);
  }

  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) {
    console.error("Ошибка при получении заказчиков:", error);
    throw error;
  }

  return { customers: (data as DatabaseCustomer[]) || [], totalCount: count || 0 };
}

/** Проверяет, занят ли номер заказчика. При редактировании текущая запись исключается. */
export async function checkCustomerNumber(number: string, excludeId?: number | null) {
  const normalized = String(number ?? "").trim();
  if (!normalized) return { exists: false, error: null };

  let query = supabase.from("customers").select("id, name, number").eq("number", normalized).limit(1);
  if (excludeId != null) query = query.neq("id", excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Ошибка проверки номера заказчика:", error);
    return { exists: false, error };
  }

  return { exists: !!data, customer: data ?? null, error: null };
}

export async function createCustomer(newCustomer: Omit<DatabaseCustomer, "id" | "created_at">) {
  const number = String(newCustomer.number ?? "").trim();
  const name = String(newCustomer.name ?? "").trim();

  if (!number) return { data: null, error: { message: "Номер заказчика обязателен." } };
  if (!name) return { data: null, error: { message: "Название заказчика обязательно." } };

  const numberCheck = await checkCustomerNumber(number);
  if (numberCheck.error) return { data: null, error: numberCheck.error };
  if (numberCheck.exists) {
    return { data: null, error: { message: `Заказчик с номером ${number} уже существует.` } };
  }

  const { data, error } = await supabase.rpc("create_customer_with_user", {
    p_number: number,
    p_name: name,
    p_type: newCustomer.type ?? null,
    p_unp: newCustomer.unp ?? null,
    p_address: newCustomer.address ?? null,
    p_phone: newCustomer.phone ?? null,
    p_email: newCustomer.email ?? null,
    p_contact_person: newCustomer.contact_person ?? null,
    p_bank_name: newCustomer.bank_name ?? null,
    p_bank_account: newCustomer.bank_account ?? null,
    p_bank_bic: newCustomer.bank_bic ?? null,
    p_contract_number: newCustomer.contract_number ?? null,
    p_contract_date: newCustomer.contract_date ?? null,
    p_registration_number: newCustomer.registration_number ?? null,
    p_registration_date: newCustomer.registration_date ?? null,
    p_director_name: newCustomer.director_name ?? null,
  });

  if (error) {
    console.error("Ошибка при создании заказчика:", error);
    return { data: null, error };
  }

  return { data: data as DatabaseCustomer, error: null };
}

export async function updateCustomer(id: number, updates: Partial<DatabaseCustomer>) {
  if ("number" in updates) {
    const number = String(updates.number ?? "").trim();
    if (!number) return { data: null, error: { message: "Номер заказчика обязателен." } };

    const numberCheck = await checkCustomerNumber(number, id);
    if (numberCheck.error) return { data: null, error: numberCheck.error };
    if (numberCheck.exists) return { data: null, error: { message: `Заказчик с номером ${number} уже существует.` } };
  }

  if ("name" in updates && !String(updates.name ?? "").trim()) {
    return { data: null, error: { message: "Название заказчика обязательно." } };
  }

  const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single();
  if (error) {
    console.error("Ошибка при обновлении заказчика:", error);
    return { data: null, error };
  }

  return { data: data as DatabaseCustomer, error: null };
}

export async function deleteCustomerRecord(id: number, userId?: number | null) {
  const { error: customerError } = await supabase.from("customers").delete().eq("id", id);
  if (customerError) {
    console.error("Ошибка при удалении заказчика:", customerError);
    return { error: customerError };
  }

  if (userId) {
    const { error: userError } = await supabase.from("users").delete().eq("id", userId);
    if (userError) {
      console.error("Ошибка при удалении связанного пользователя:", userError);
      return { error: userError };
    }
  }

  return { error: null };
}