import { supabase } from "@/lib/supabase";
import { DatabaseCustomer, DatabaseCustomerBalanceTransaction } from "../types/database.types";

export type CustomerInspectionCharge = DatabaseCustomerBalanceTransaction & {
  driver_name: string | null;
  car_brand: string | null;
  car_number: string | null;
};

export async function findCustomerForHistory(name: string, number?: string | null) {
  let query = supabase.from("customers").select("*").eq("name", name).limit(1);
  if (number) query = query.eq("number", number);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Ошибка поиска заказчика для истории:", error);
    return { customer: null as DatabaseCustomer | null, error };
  }

  return { customer: (data as DatabaseCustomer | null) ?? null, error: null };
}

export async function fetchCustomerInspectionCharges(customerId: number) {
  // Загружаем историю одним SECURITY DEFINER RPC-запросом.
  // Это исключает проблему RLS на связанных таблицах transactions/inspections/drivers.
  const { data, error } = await (supabase as any).rpc(
    "get_customer_inspection_charges",
    { p_customer_id: customerId },
  );

  if (error) {
    console.error("Ошибка загрузки списаний заказчика:", error);
    return { data: [] as CustomerInspectionCharge[], error };
  }

  return {
    data: (data || []) as CustomerInspectionCharge[],
    error: null,
  };
}
