import { supabase } from "@/lib/supabase";
import type { DatabaseInspection } from "@/types/database.types";

export async function fetchDriverInspectionHistory(
  driverId: number,
  startDate: string,
  endDate: string
): Promise<{ data: DatabaseInspection[]; error: Error | null }> {
  try {
    const start = `${startDate}T00:00:00`;
    const end = `${endDate}T23:59:59.999`;

    const { data, error } = await supabase
      .from("inspections")
      .select("*")
      .eq("driver_id", driverId)
      .gte("requested_at", start)
      .lte("requested_at", end)
      .order("requested_at", { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as DatabaseInspection[]) || [], error: null };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
