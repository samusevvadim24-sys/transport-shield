/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";

export interface CustomerDriver {
  id: number;
  driver_id: string;
  number: string;
  customer_id: number;
  name: string;
  license_number: string;
  car_brand: string;
  car_number: string;
}

export interface CustomerInspection {
  id: number;
  driver_id: number;
  overall_status: string;
  medical_status: string;
  mechanic_status: string;
  requested_at: string;
  alcohol?: number;
  mechanic_reasons?: string[];
}

export interface CustomerBalanceTransaction {
  id: number;
  customer_id: number;
  amount: number;
  type: string;
  description: string | null;
  inspection_id: number | null;
  balance_after: number | null;
  created_at: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_car_brand: string | null;
  driver_car_number: string | null;
}

export const CustomerDashboardService = {
  async getDrivers(user: any): Promise<CustomerDriver[]> {
    const userId = user.id;
    let customerIdToSearch = user.customer_id;

    if (!customerIdToSearch && userId) {
      const { data: customerRecord } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (customerRecord) customerIdToSearch = customerRecord.id;
    }

    const finalId = customerIdToSearch || userId;
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("customer_id", finalId);

    if (error) {
      console.error("Ошибка загрузки водителей заказчика:", error.message);
      return [];
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      driver_id: d.driver_id || "",
      number: d.number || "",
      customer_id: d.customer_id,
      name: d.name || "",
      license_number: d.license_number || "",
      car_brand: d.car_brand || "",
      car_number: d.car_number || "",
    }));
  },

  async getInspections(driverIds: number[]): Promise<CustomerInspection[]> {
    if (driverIds.length === 0) return [];
    const { data, error } = await supabase
      .from("inspections")
      .select("*")
      .in("driver_id", driverIds)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки осмотров:", error.message);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      driver_id: item.driver_id,
      overall_status: item.overall_status || "Ожидание",
      medical_status: item.medical_status || "Ожидание",
      mechanic_status: item.mechanic_status || "Ожидание",
      requested_at: item.requested_at,
      alcohol: item.alcohol || 0,
      mechanic_reasons: item.mechanic_reasons || [],
    }));
  },

  async getBalanceTransactions(customerId: number): Promise<CustomerBalanceTransaction[]> {
    if (!customerId) return [];

    const { data, error } = await supabase.rpc("get_customer_balance_history", {
      p_customer_id: customerId,
    });

    if (error) {
      console.error("Ошибка загрузки истории баланса заказчика:", error.message);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      customer_id: item.customer_id,
      amount: Number(item.amount || 0),
      type: item.type || "",
      description: item.description || null,
      inspection_id: item.inspection_id ?? null,
      balance_after: item.balance_after == null ? null : Number(item.balance_after),
      created_at: item.created_at,
      driver_id: item.driver_id ?? null,
      driver_name: item.driver_name || null,
      driver_car_brand: item.driver_car_brand || null,
      driver_car_number: item.driver_car_number || null,
    }));
  },
};
