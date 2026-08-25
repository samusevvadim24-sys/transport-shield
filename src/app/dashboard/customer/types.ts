import type { CustomerInspection } from "@/services/customer-dashboard.service";

export interface CheckData extends CustomerInspection {
  dateISO: string;
  time: string;
}

export const tone = (s: string) =>
  s === "Допущен"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : s === "Не допущен"
      ? "text-red-700 bg-red-50 border-red-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

export const dot = (s: string) =>
  s === "Допущен"
    ? "bg-emerald-500"
    : s === "Не допущен"
      ? "bg-red-500"
      : "bg-amber-500";
