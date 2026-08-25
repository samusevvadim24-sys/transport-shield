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
  // История должна показывать фактические списания за осмотры.
  // Не привязываемся только к type='inspection': так история продолжит
  // работать и для уже существующих операций, если type был записан иначе.
  const { data: transactions, error: transactionError } = await supabase
    .from("customer_balance_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .not("inspection_id", "is", null)
    .lt("amount", 0)
    .order("created_at", { ascending: false });

  if (transactionError) {
    console.error("Ошибка загрузки списаний заказчика:", transactionError);
    return { data: [] as CustomerInspectionCharge[], error: transactionError };
  }

  const rows = (transactions as DatabaseCustomerBalanceTransaction[]) || [];
  if (rows.length === 0) return { data: [] as CustomerInspectionCharge[], error: null };

  const inspectionIds = [...new Set(rows.map((row) => row.inspection_id).filter((id): id is number => id != null))];
  const { data: inspections, error: inspectionError } = await supabase
    .from("inspections")
    .select("id, driver_id")
    .in("id", inspectionIds);

  if (inspectionError) {
    console.error("Ошибка загрузки осмотров для истории списаний:", inspectionError);
    return { data: [] as CustomerInspectionCharge[], error: inspectionError };
  }

  const driverIds = [...new Set((inspections || []).map((inspection) => inspection.driver_id).filter((id): id is number => id != null))];
  const { data: drivers, error: driverError } = driverIds.length
    ? await supabase.from("drivers").select("id, name, car_brand, car_number").in("id", driverIds)
    : { data: [], error: null };

  if (driverError) {
    console.error("Ошибка загрузки водителей для истории списаний:", driverError);
    return { data: [] as CustomerInspectionCharge[], error: driverError };
  }

  const driverById = new Map((drivers || []).map((driver) => [driver.id, driver]));
  const driverIdByInspectionId = new Map((inspections || []).map((inspection) => [inspection.id, inspection.driver_id]));

  return {
    data: rows.map((row) => {
      const driver = driverById.get(driverIdByInspectionId.get(row.inspection_id ?? -1) ?? -1);
      return {
        ...row,
        driver_name: driver?.name ?? null,
        car_brand: driver?.car_brand ?? null,
        car_number: driver?.car_number ?? null,
      };
    }) as CustomerInspectionCharge[],
    error: null,
  };
}
