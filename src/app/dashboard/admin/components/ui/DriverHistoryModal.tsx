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
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

function parseDisplayDate(value: string) {
  const m = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function statusClass(status: string | null | undefined) {
  if (status === "Допущен") return "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20";
  if (status === "Не допущен") return "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function statusText(status: string | null | undefined) {
  return status || "Ожидание";
}

function statusTextClass(status: string | null | undefined) {
  if (status === "Допущен") return "text-[#2F855A]";
  if (status === "Не допущен") return "text-[#C53030]";
  return "text-amber-700";
}

export default function DriverHistoryModal({ isOpen, driver, onClose }: Props) {
  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => toDateInput(today));
  const [items, setItems] = useState<DatabaseInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStartDate(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
    setEndDate(toDateInput(today));
  }, [isOpen, today]);

  useEffect(() => {
    if (!isOpen || !driver) return;
    if (startDate > endDate) {
      setItems([]);
      setError("Дата начала не может быть позже даты окончания.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDriverInspectionHistory(driver.id, startDate, endDate).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      setItems(data);
      setError(fetchError?.message || null);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isOpen, driver, startDate, endDate]);

  if (!isOpen || !driver) return null;

  const setPeriod = () => {
    const now = new Date();
    setStartDate(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };

  const stats = {
    total: items.length,
    allowed: items.filter((x) => x.overall_status === "Допущен").length,
    rejected: items.filter((x) => x.overall_status === "Не допущен").length,
    appear: items.filter((x) => x.overall_status === "Явиться").length,
  };

  const setDisplayStart = (value: string) => setStartDate(parseDisplayDate(displayDate(value)));
  const setDisplayEnd = (value: string) => setEndDate(parseDisplayDate(displayDate(value)));
  const visibleItems = items.slice(0, 10);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#042433]/10 text-[#042433]">
                <History size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">История осмотров — №{driver.driver_id || driver.id}</h3>
                <p className="truncate text-xs text-slate-500">
                  Водитель: {driver.name || "—"} · Заказчик: {driver.customer?.name || "—"}
                  {driver.car_brand || driver.car_number ? ` · ${driver.car_brand || ""}${driver.car_number ? ` ${driver.car_number}` : ""}` : ""}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <CalendarDays size={14} className="text-slate-400" />
                <span className="text-xs text-slate-500">Период:</span>
                <input inputMode="numeric" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={displayDate(startDate)} onChange={(e) => setDisplayStart(e.target.value)} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
                <span className="text-slate-400">—</span>
                <input inputMode="numeric" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={displayDate(endDate)} onChange={(e) => setDisplayEnd(e.target.value)} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
              </div>
              <button type="button" onClick={setPeriod} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-[#042433]">Этот месяц</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">Всего: <strong>{stats.total}</strong></span>
              <span className="rounded-full border border-[#2F855A]/20 bg-[#2F855A]/10 px-2.5 py-1 text-xs font-medium text-[#2F855A]">Допущен: <strong>{stats.allowed}</strong></span>
              <span className="rounded-full border border-[#C53030]/20 bg-[#C53030]/10 px-2.5 py-1 text-xs font-medium text-[#C53030]">Не допущен: <strong>{stats.rejected}</strong></span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Ожидание: <strong>{stats.appear}</strong></span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">Загрузка истории...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">За выбранный период прохождений нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Дата</th>
                    <th className="px-3 py-3">Мед. осмотр</th>
                    <th className="px-3 py-3">Алкотестер</th>
                    <th className="px-3 py-3">Тех. осмотр</th>
                    <th className="px-3 py-3 text-center">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleItems.map((item) => {
                    const overall = statusText(item.overall_status);
                    const medicalStatus = statusText(item.medical_status);
                    const mechanicStatus = statusText(item.mechanic_status);
                    const isAppear = overall === "Явиться";
                    const pressure = item.blood_pressure_systolic !== null && item.blood_pressure_diastolic !== null
                      ? `${item.blood_pressure_systolic}/${item.blood_pressure_diastolic}`
                      : null;

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800">{formatDateTime(item.completed_at || item.requested_at)}</div>
                          <div className="font-mono text-[10px] text-slate-400">{item.completed_at ? new Date(item.completed_at).toISOString().slice(0, 10) : "—"}</div>
                        </td>
                        <td className="px-3 py-3">
                          {isAppear ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Stethoscope size={12} className="text-[#042433]/70" />
                                <div>
                                  <div className="text-xs font-medium text-slate-700">Администратор</div>
                                  <div className="text-[10px] text-slate-400">{item.medical_date ? new Date(item.medical_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                                </div>
                              </div>
                              <div className={`mt-1 text-[10px] font-semibold ${statusTextClass(item.medical_status)}`}>{medicalStatus}</div>
                              {pressure && <div className="mt-0.5 text-[10px] font-mono text-slate-500">АД {pressure}</div>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isAppear ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : item.breathalyzer_value === null ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <span className={`text-xs font-medium ${item.breathalyzer_value > 0 ? "text-[#C53030]" : "text-[#2F855A]"}`}>{item.breathalyzer_value.toFixed(2)} мг/л</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isAppear ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Wrench size={12} className="text-amber-500" />
                                <div>
                                  <div className="text-xs font-medium text-slate-700">Администратор</div>
                                  <div className="text-[10px] text-slate-400">{item.mechanic_date ? new Date(item.mechanic_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                                </div>
                              </div>
                              <div className={`mt-1 text-[10px] font-semibold ${statusTextClass(item.mechanic_status)}`}>{mechanicStatus}</div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(item.overall_status)}`}>{overall}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 bg-white px-5 py-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">Закрыть</button>
        </div>
      </div>
    </div>
  );
}
