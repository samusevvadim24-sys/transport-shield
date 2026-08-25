"use client";

import { X } from "lucide-react";
import type { CustomerDriver } from "@/services/customer-dashboard.service";
import type { CheckData } from "../types";
import { tone } from "../types";

interface Props {
  selectedDriver: CustomerDriver;
  selectedDriverChecks: CheckData[];
  monthLabel: string;
  stats: { approved: number; rejected: number; pending: number };
  onClose: () => void;
}

export default function CustomerDriverMonthlyModal({ selectedDriver, selectedDriverChecks, monthLabel, stats, onClose }: Props) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
    <div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white p-6"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Сводка за месяц</div><h2 className="mt-1 text-2xl font-bold">{selectedDriver.name || "Без имени"}</h2><div className="mt-1 text-sm text-slate-500">{selectedDriver.car_brand || "Автомобиль"}{selectedDriver.car_number ? ` • ${selectedDriver.car_number}` : ""} · {monthLabel}</div></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div>
    <div className="p-6"><div className="grid grid-cols-3 gap-3"><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-2xl font-bold text-emerald-700">{stats.approved}</div><div className="text-xs text-emerald-700/70">Допущен</div></div><div className="rounded-2xl bg-red-50 p-4"><div className="text-2xl font-bold text-red-700">{stats.rejected}</div><div className="text-xs text-red-700/70">Не допущен</div></div><div className="rounded-2xl bg-amber-50 p-4"><div className="text-2xl font-bold text-amber-700">{stats.pending}</div><div className="text-xs text-amber-700/70">Ожидание</div></div></div><div className="mt-6 space-y-3">{selectedDriverChecks.map(c => <div key={c.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><div><div className="font-semibold">{new Date(c.requested_at).toLocaleDateString("ru-RU")}</div><div className="text-xs text-slate-400">{c.time}</div></div><div className={`rounded-full border px-3 py-1 text-xs font-medium ${tone(c.overall_status)}`}>{c.overall_status}</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3">Медик: <b className="font-medium">{c.medical_status}</b></div><div className="rounded-xl bg-slate-50 p-3">Механик: <b className="font-medium">{c.mechanic_status}</b></div></div></div>)}</div></div>
  </div></div>;
}
