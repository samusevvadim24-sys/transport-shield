"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, History, Stethoscope, Wrench, X } from "lucide-react";
import type { DatabaseInspection, Driver } from "@/types/database.types";
import { fetchDriverInspectionHistory } from "@/services/driver-history.service";

interface Props { isOpen: boolean; driver: Driver | null; onClose: () => void; }

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function displayDate(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
function parseDisplayDate(value: string): string | null {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function statusClass(status: string | null | undefined) {
  if (status === "Допущен") return "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20";
  if (status === "Не допущен") return "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20";
  return "bg-amber-50 text-amber-700 border-amber-200";
}
function statusText(status: string | null | undefined) { return status || "Ожидание"; }
function statusTextClass(status: string | null | undefined) {
  if (status === "Допущен") return "text-[#2F855A]";
  if (status === "Не допущен") return "text-[#C53030]";
  return "text-amber-700";
}

export default function DriverHistoryModal({ isOpen, driver, onClose }: Props) {
  const today = useMemo(() => new Date(), []);
  const initialStartDate = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const initialEndDate = toDateInput(today);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [startInput, setStartInput] = useState(displayDate(initialStartDate));
  const [endInput, setEndInput] = useState(displayDate(initialEndDate));
  const [items, setItems] = useState<DatabaseInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const nextStart = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    const nextEnd = toDateInput(today);
    setStartDate(nextStart); setEndDate(nextEnd); setStartInput(displayDate(nextStart)); setEndInput(displayDate(nextEnd)); setError(null);
  }, [isOpen, today]);

  useEffect(() => {
    if (!isOpen || !driver) return;
    if (startDate > endDate) { setItems([]); setError("Дата начала не может быть позже даты окончания."); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetchDriverInspectionHistory(driver.id, startDate, endDate).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      setItems(data); setError(fetchError?.message || null); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, driver, startDate, endDate]);

  if (!isOpen || !driver) return null;

  const setPeriod = () => {
    const now = new Date();
    const nextStart = toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    const nextEnd = toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    setStartDate(nextStart); setEndDate(nextEnd); setStartInput(displayDate(nextStart)); setEndInput(displayDate(nextEnd)); setError(null);
  };
  const handleDateInput = (value: string, type: "start" | "end") => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted = displayDate(digits);
    if (type === "start") setStartInput(formatted); else setEndInput(formatted);
    if (digits.length < 8) { setError(null); return; }
    const parsed = parseDisplayDate(digits);
    if (!parsed) { setError("Введите корректные даты"); return; }
    setError(null);
    if (type === "start") setStartDate(parsed); else setEndDate(parsed);
  };

  const stats = {
    total: items.length,
    allowed: items.filter((x) => x.overall_status === "Допущен").length,
    rejected: items.filter((x) => x.overall_status === "Не допущен").length,
    appear: items.filter((x) => x.overall_status === "Явиться").length,
  };
  const visibleItems = items.slice(0, 10);

  const renderInspectionDetails = (item: DatabaseInspection) => {
    const overall = statusText(item.overall_status);
    const medicalStatus = statusText(item.medical_status);
    const mechanicStatus = statusText(item.mechanic_status);
    const isAppear = overall === "Явиться";
    const pressure = item.blood_pressure_systolic !== null && item.blood_pressure_diastolic !== null ? `${item.blood_pressure_systolic}/${item.blood_pressure_diastolic}` : null;
    return { overall, medicalStatus, mechanicStatus, isAppear, pressure };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:p-3" onClick={onClose}>
      <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-6xl sm:rounded-xl sm:border sm:border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#042433]/10 text-[#042433]"><History size={20} /></div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">История осмотров — №{driver.driver_id || driver.id}</h3>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500">{driver.name || "—"} · {driver.customer?.name || "Заказчик не указан"}{driver.car_brand || driver.car_number ? ` · ${driver.car_brand || ""}${driver.car_number ? ` ${driver.car_number}` : ""}` : ""}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200" aria-label="Закрыть"><X size={20} /></button>
          </div>

          <div className="mt-3 grid gap-2 sm:mt-4 sm:flex sm:items-end sm:justify-between sm:gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 sm:gap-2 sm:px-3 sm:py-2">
                <CalendarDays size={14} className="shrink-0 text-slate-400" />
                <span className="hidden text-xs text-slate-500 sm:inline">Период:</span>
                <input inputMode="numeric" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={startInput} onChange={(e) => handleDateInput(e.target.value, "start")} className="min-w-0 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433] sm:w-24 sm:py-1" />
                <span className="text-slate-400">—</span>
                <input inputMode="numeric" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={endInput} onChange={(e) => handleDateInput(e.target.value, "end")} className="min-w-0 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433] sm:w-24 sm:py-1" />
              </div>
              <button type="button" onClick={setPeriod} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-[#042433] active:bg-slate-100 sm:w-auto sm:py-2">Этот месяц</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-slate-600">Всего: <strong>{stats.total}</strong></span>
              <span className="rounded-full border border-[#2F855A]/20 bg-[#2F855A]/10 px-2.5 py-1.5 text-center text-[11px] font-medium text-[#2F855A]">Допущен: <strong>{stats.allowed}</strong></span>
              <span className="rounded-full border border-[#C53030]/20 bg-[#C53030]/10 px-2.5 py-1.5 text-center text-[11px] font-medium text-[#C53030]">Не допущен: <strong>{stats.rejected}</strong></span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-amber-700">Ожидание: <strong>{stats.appear}</strong></span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">Загрузка истории...</div> : error ? <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : visibleItems.length === 0 ? <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 text-center text-sm text-slate-400">За выбранный период прохождений нет</div> : (
            <>
              <div className="space-y-3 md:hidden">
                {visibleItems.map((item) => {
                  const { overall, medicalStatus, mechanicStatus, isAppear, pressure } = renderInspectionDetails(item);
                  const breathalyzer = item.breathalyzer_value;
                  return <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5">
                      <div><div className="text-sm font-bold text-slate-900">{formatDateTime(item.completed_at || item.requested_at)}</div><div className="mt-0.5 text-[11px] text-slate-400">Осмотр №{item.id}</div></div>
                      <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.overall_status)}`}>{overall}</span>
                    </div>
                    {isAppear ? <div className="p-4 text-sm text-slate-400">Осмотр ещё не завершён.</div> : <div className="space-y-2.5 p-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#042433]/10 text-[#042433]"><Stethoscope size={15} /></span><span className="text-xs font-bold text-slate-700">Медицинский осмотр</span></div><div className="flex items-center justify-between gap-2"><span className={`text-xs font-semibold ${statusTextClass(item.medical_status)}`}>{medicalStatus}</span><span className="text-[11px] text-slate-400">{item.medical_date ? new Date(item.medical_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>{pressure && <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-xs font-mono text-slate-600">АД <strong>{pressure}</strong></div>}</div>
                      <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Алкотестер</div><div className={`mt-1 text-sm font-bold ${breathalyzer !== null && breathalyzer > 0 ? "text-[#C53030]" : "text-[#2F855A]"}`}>{breathalyzer === null ? "—" : `${breathalyzer.toFixed(2)} мг/л`}</div></div><div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="mb-1 flex items-center gap-1.5"><Wrench size={13} className="text-amber-500" /><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Тех. осмотр</span></div><div className={`text-xs font-semibold ${statusTextClass(item.mechanic_status)}`}>{mechanicStatus}</div><div className="mt-0.5 text-[11px] text-slate-400">{item.mechanic_date ? new Date(item.mechanic_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div></div>
                    </div>}
                  </article>;
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Дата</th><th className="px-3 py-3">Мед. осмотр</th><th className="px-3 py-3">Алкотестер</th><th className="px-3 py-3">Тех. осмотр</th><th className="px-3 py-3 text-center">Статус</th></tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleItems.map((item) => {
                      const { overall, medicalStatus, mechanicStatus, isAppear, pressure } = renderInspectionDetails(item);
                      return <tr key={item.id} className="transition-colors hover:bg-slate-50/60"><td className="px-3 py-3"><div className="font-medium text-slate-800">{formatDateTime(item.completed_at || item.requested_at)}</div><div className="font-mono text-[10px] text-slate-400">{item.completed_at ? new Date(item.completed_at).toISOString().slice(0, 10) : "—"}</div></td><td className="px-3 py-3">{isAppear ? <span className="text-xs text-slate-400">—</span> : <><div className="flex items-center gap-1.5"><Stethoscope size={12} className="text-[#042433]/70" /><div><div className="text-xs font-medium text-slate-700">Администратор</div><div className="text-[10px] text-slate-400">{item.medical_date ? new Date(item.medical_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div></div><div className={`mt-1 text-[10px] font-semibold ${statusTextClass(item.medical_status)}`}>{medicalStatus}</div>{pressure && <div className="mt-0.5 text-[10px] font-mono text-slate-500">АД {pressure}</div>}</>}</td><td className="px-3 py-3">{isAppear || item.breathalyzer_value === null ? <span className="text-xs text-slate-400">—</span> : <span className={`text-xs font-medium ${item.breathalyzer_value > 0 ? "text-[#C53030]" : "text-[#2F855A]"}`}>{item.breathalyzer_value.toFixed(2)} мг/л</span>}</td><td className="px-3 py-3">{isAppear ? <span className="text-xs text-slate-400">—</span> : <><div className="flex items-center gap-1.5"><Wrench size={12} className="text-amber-500" /><div><div className="text-xs font-medium text-slate-700">Администратор</div><div className="text-[10px] text-slate-400">{item.mechanic_date ? new Date(item.mechanic_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div></div><div className={`mt-1 text-[10px] font-semibold ${statusTextClass(item.mechanic_status)}`}>{mechanicStatus}</div></>}</td><td className="px-3 py-3 text-center"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(item.overall_status)}`}>{overall}</span></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:py-2"><button type="button" onClick={onClose} className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 active:bg-slate-300 sm:ml-auto sm:w-auto">Закрыть</button></div>
      </div>
    </div>
  );
}
