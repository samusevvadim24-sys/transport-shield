import { supabase } from "@/lib/supabase";
import type { DatabaseInspection } from "@/types/database.types";

export async function fetchDriverInspectionHistory(
  driverId: number,
  startDate: string,
  endDate: string
): Promise<{ data: DatabaseInspection[]; error: Error | null }> {
  try {
    const start = `${startDate}T00:00:00`;
    const endDateObject = new Date(`${endDate}T00:00:00`);
    endDateObject.setDate(endDateObject.getDate() + 1);
    const endExclusive = `${endDateObject.getFullYear()}-${String(endDateObject.getMonth() + 1).padStart(2, "0")}-${String(endDateObject.getDate()).padStart(2, "0")}T00:00:00`;

    const { data, error } = await supabase
      .from("inspections")
      .select("*")
      .eq("driver_id", driverId)
      .gte("requested_at", start)
      .lt("requested_at", endExclusive)
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
