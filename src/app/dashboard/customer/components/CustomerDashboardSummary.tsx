"use client";

import { AlertTriangle, CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { CustomerDriver } from "@/services/customer-dashboard.service";
import type { CheckData } from "../types";
import type { ElementType } from "react";

interface Props {
  drivers: CustomerDriver[];
  checks: CheckData[];
  stats: { approved: number; rejected: number; pending: number };
  formatted: string;
}

export default function CustomerDashboardSummary({ drivers, checks, stats, formatted }: Props) {
  const cards: Array<[string, number, ElementType, string]> = [
    ["Допущено", stats.approved, CheckCircle2, "text-emerald-500"],
    ["Не допущено", stats.rejected, XCircle, "text-red-500"],
    ["Ожидание", stats.pending, Clock3, "text-amber-500"],
    ["Без осмотра", Math.max(0, drivers.length - new Set(checks.map((c) => c.driver_id)).size), AlertTriangle, "text-slate-400"],
  ];

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value, Icon, iconClass]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
            <Icon className={iconClass} size={20} />
          </div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
          <div className="mt-1 text-xs text-slate-500">за {formatted}</div>
        </div>
      ))}
    </section>
  );
}
