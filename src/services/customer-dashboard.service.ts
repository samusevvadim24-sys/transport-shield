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

export const CustomerDashboardService = {
  // Получение водителей для конкретного заказчика
 async getDrivers(user: any): Promise<CustomerDriver[]> {
    const userId = user.id;

    // Шаг 1: Пытаемся найти запись заказчика в таблице customers, у которой user_id равен нашему id из сессии
    let customerIdToSearch = user.customer_id;

    if (!customerIdToSearch && userId) {
      const { data: customerRecord } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (customerRecord) {
        customerIdToSearch = customerRecord.id;
      }
    }

    // Если в customers ничего не нашлось, пробуем использовать сам userId как fallback
    const finalId = customerIdToSearch || userId;

    // Шаг 2: Загружаем водителей по найденному ID
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

  // Получение осмотров для списка водителей
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
};