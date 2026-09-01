import { supabase } from "@/lib/supabase";
import { DatabaseCustomer } from "../types/database.types";

export const CUSTOMERS_PAGE_SIZE = 10;
interface FetchCustomersParams { currentPage: number; search?: string; }
function escapeForOrFilter(value: string): string { return value.replace(/[,.:()]/g, "\\$&"); }

export async function fetchCustomers({ currentPage, search = "" }: FetchCustomersParams) {
  const from = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
  const to = from + CUSTOMERS_PAGE_SIZE - 1;
  let query = supabase.from("customers").select("*", { count: "exact" });
  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());
    query = query.or(`name.ilike.%${cleanSearch}%,unp.ilike.%${cleanSearch}%,contract_number.ilike.%${cleanSearch}%,number.ilike.%${cleanSearch}%`);
  }
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) throw error;
  return { customers: (data as DatabaseCustomer[]) || [], totalCount: count || 0 };
}

export async function checkCustomerNumber(number: string, excludeId?: number | null) {
  const normalized = String(number ?? "").trim();
  if (!normalized) return { exists: false, error: null };
  let query = supabase.from("customers").select("id, name, number").eq("number", normalized).limit(1);
  if (excludeId != null) query = query.neq("id", excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return { exists: false, error };
  return { exists: !!data, customer: data ?? null, error: null };
}

export async function createCustomer(newCustomer: Omit<DatabaseCustomer, "id" | "created_at">) {
  const number = String(newCustomer.number ?? "").trim();
  const name = String(newCustomer.name ?? "").trim();
  if (!number) return { data: null, error: { message: "Номер заказчика обязателен." } };
  if (!name) return { data: null, error: { message: "Название заказчика обязательно." } };
  const numberCheck = await checkCustomerNumber(number);
  if (numberCheck.error) return { data: null, error: numberCheck.error };
  if (numberCheck.exists) return { data: null, error: { message: `Заказчик с номером ${number} уже существует.` } };

  try {
    const response = await fetch("/api/admin/customers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCustomer),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body.error || "Не удалось создать заказчика" } };
    return { data: body.data as DatabaseCustomer, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
  }
}

export async function updateCustomer(id: number, updates: Partial<DatabaseCustomer>) {
  if ("number" in updates) {
    const number = String(updates.number ?? "").trim();
    if (!number) return { data: null, error: { message: "Номер заказчика обязателен." } };
    const numberCheck = await checkCustomerNumber(number, id);
    if (numberCheck.error) return { data: null, error: numberCheck.error };
    if (numberCheck.exists) return { data: null, error: { message: `Заказчик с номером ${number} уже существует.` } };
  }
  if ("name" in updates && !String(updates.name ?? "").trim()) return { data: null, error: { message: "Название заказчика обязательно." } };
  try {
    const response = await fetch(`/api/admin/customers/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body.error || "Не удалось обновить заказчика" } };
    return { data: body.data as DatabaseCustomer, error: null };
  } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
}

export async function deleteCustomerRecord(id: number) {
  try {
    const response = await fetch(`/api/admin/customers/${id}`, { method: "DELETE", credentials: "include" });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { error: null } : { error: { message: body.error || "Не удалось удалить заказчика" } };
  } catch (error) { return { error: { message: error instanceof Error ? error.message : String(error) } }; }
}

export async function topUpCustomerBalance(customerId: number, amount: number, description = "Пополнение баланса") {
  try {
    const response = await fetch(`/api/admin/customers/${customerId}/top-up`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, description: description.trim() || "Пополнение баланса" }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { balance: null, error: { message: body.error || "Не удалось пополнить баланс" } };
    return { balance: Number(body.balance), error: null };
  } catch (error) { return { balance: null, error: { message: error instanceof Error ? error.message : String(error) } };
  }
}
