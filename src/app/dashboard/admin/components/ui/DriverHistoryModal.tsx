"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, History, Stethoscope, Wrench, X } from "lucide-react";
import { fetchDriverHistory, type DriverHistoryItem } from "@/services/customer-tab.service";
import type { Driver } from "@/types/database.types";

interface Props { isOpen: boolean; driver: Driver | null; onClose: () => void; }

function toDateInput(value: Date) { const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, "0"); const d = String(value.getDate()).padStart(2, "0"); return `${y}-${m}-${d}`; }
function formatDateInput(value: string) { const [y, m, d] = value.split("-"); return d && m && y ? `${d}.${m}.${y}` : value; }
function formatDateTime(value: string | null) { if (!value) return "—"; const date = new Date(value); return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`; }
function statusClass(status: string) { if (status === "Допущен") return "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20"; if (status === "Не допущен") return "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20"; return "bg-amber-50 text-amber-700 border-amber-200"; }
function statusText(status: string | null | undefined) { return status || "Ожидание"; }

export default function DriverHistoryModal({ isOpen, driver, onClose }: Props) {
  const now = new Date();
  const [startDate, setStartDate] = useState(() => toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => toDateInput(now));
  const [items, setItems] = useState<DriverHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ approved: 0, rejected: 0, waiting: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!isOpen) return; const today = new Date(); setStartDate(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(toDateInput(today)); }, [isOpen, driver?.id]);
  useEffect(() => { if (!isOpen || !driver) return; let cancelled = false; setLoading(true); fetchDriverHistory(driver.id, startDate, endDate).then((result) => { if (cancelled) return; setItems(result.items); setTotalCount(result.totalCount); setCounts(result.counts); setLoading(false); }).catch(() => { if (cancelled) return; setItems([]); setTotalCount(0); setCounts({ approved: 0, rejected: 0, waiting: 0 }); setLoading(false); }); return () => { cancelled = true; }; }, [isOpen, driver, startDate, endDate]);
  const periodLabel = useMemo(() => `${formatDateInput(startDate)} — ${formatDateInput(endDate)}`, [startDate, endDate]);
  const handleDateText = (value: string, setter: (value: string) => void) => { const digits = value.replace(/\D/g, "").slice(0, 8); if (digits.length <= 2) setter(digits); else if (digits.length <= 4) setter(`${digits.slice(0, 2)}.${digits.slice(2)}`); else setter(`${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`); };
  const displayDate = (value: string) => formatDateInput(value);
  const parseDisplayDate = (value: string) => { const digits = value.replace(/\D/g, "").slice(0, 8); if (digits.length !== 8) return null; return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`; };
  const startDisplay = displayDate(startDate);
  const endDisplay = displayDate(endDate);
  if (!isOpen || !driver) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[2px] sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#042433]/10 text-[#042433]"><History size={20} /></div><div className="min-w-0"><h3 className="text-base font-semibold text-slate-900">История осмотров — №{driver.driver_id || driver.id}</h3><p className="truncate text-xs text-slate-500"><span>Водитель: {driver.name || "—"}</span> · <span>Заказчик: {driver.customer?.name || "—"}</span>{driver.car_brand || driver.car_number ? ` · ${driver.car_brand || ""}${driver.car_number ? ` ${driver.car_number}` : ""}` : ""}</p></div></div><button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Закрыть"><X size={18} /></button></div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Calendar size={14} className="text-slate-400" /><span className="text-xs text-slate-500">Период:</span><input value={startDisplay} onChange={(e) => { const next = e.target.value; handleDateText(next, (v) => { const parsed = parseDisplayDate(v); if (parsed) setStartDate(parsed); else setStartDate(v); }); }} placeholder="ДД.ММ.ГГГГ" maxLength={10} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /><span className="text-slate-400">—</span><input value={endDisplay} onChange={(e) => { const next = e.target.value; handleDateText(next, (v) => { const parsed = parseDisplayDate(v); if (parsed) setEndDate(parsed); else setEndDate(v); }); }} placeholder="ДД.ММ.ГГГГ" maxLength={10} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div><button type="button" onClick={() => { const d = new Date(); setStartDate(toDateInput(new Date(d.getFullYear(), d.getMonth(), 1))); setEndDate(toDateInput(d)); }} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-[#042433]">Этот месяц</button></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">Всего: <strong>{totalCount}</strong></span><span className="rounded-full border border-[#2F855A]/20 bg-[#2F855A]/10 px-2.5 py-1 text-xs font-medium text-[#2F855A]">Допущен: <strong>{counts.approved}</strong></span><span className="rounded-full border border-[#C53030]/20 bg-[#C53030]/10 px-2.5 py-1 text-xs font-medium text-[#C53030]">Не допущен: <strong>{counts.rejected}</strong></span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Ожидание: <strong>{counts.waiting}</strong></span></div>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">Загрузка истории...</div> : items.length === 0 ? <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">За выбранный период прохождений нет</div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Дата</th><th className="px-3 py-3">Мед. осмотр</th><th className="px-3 py-3">Алкотестер</th><th className="px-3 py-3">Тех. осмотр</th><th className="px-3 py-3 text-center">Статус</th></tr></thead><tbody className="divide-y divide-slate-200">{items.map((item) => { const medStatus = statusText(item.medical_status); const mechStatus = statusText(item.mechanic_status); const overall = statusText(item.overall_status); return <tr key={item.id} className="transition-colors hover:bg-slate-50/60"><td className="px-3 py-3"><div className="font-medium text-slate-800">{formatDateTime(item.completed_at || item.requested_at)}</div><div className="font-mono text-[10px] text-slate-400">{item.completed_at ? new Date(item.completed_at).toISOString().slice(0, 10) : "—"}</div></td><td className="px-3 py-3"><div className="flex items-center gap-1.5"><Stethoscope size={12} className="text-[#042433]/70" /><div><div className="text-xs font-medium text-slate-700">Администратор</div><div className="text-[10px] text-slate-400">{item.medical_date ? new Date(item.medical_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div></div><div className={`mt-1 text-[10px] font-semibold ${medStatus === "Допущен" ? "text-[#2F855A]" : medStatus === "Не допущен" ? "text-[#C53030]" : "text-amber-700"}`}>{medStatus}</div></td><td className="px-3 py-3">{item.breathalyzer_value == null ? <span className="text-xs text-slate-400">—</span> : <span className={`text-xs font-medium ${item.breathalyzer_value > 0 ? "text-[#C53030]" : "text-[#2F855A]"}`}>{Number(item.breathalyzer_value).toFixed(2)} мг/л</span>}</td><td className="px-3 py-3"><div className="flex items-center gap-1.5"><Wrench size={12} className="text-amber-500" /><div><div className="text-xs font-medium text-slate-700">Администратор</div><div className="text-[10px] text-slate-400">{item.mechanic_date ? new Date(item.mechanic_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div></div><div className={`mt-1 text-[10px] font-semibold ${mechStatus === "Допущен" ? "text-[#2F855A]" : mechStatus === "Не допущен" ? "text-[#C53030]" : "text-amber-700"}`}>{mechStatus}</div></td><td className="px-3 py-3 text-center"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(overall)}`}>{overall}</span></td></tr>; })}</tbody></table></div>}
        </div>
      </div>
    </div>
  );
}
