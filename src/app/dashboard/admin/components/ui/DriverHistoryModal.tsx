"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, X, XCircle } from "lucide-react";
import type { DatabaseInspection, Driver } from "@/types/database.types";
import { fetchDriverInspectionHistory } from "@/services/driver-history.service";

interface Props {
  isOpen: boolean;
  driver: Driver | null;
  onClose: () => void;
}

function toDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string | null) {
  if (status === "Допущен") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Не допущен") return "bg-rose-50 text-rose-700 border-rose-100";
  if (status === "Явиться") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function statusIcon(status: string | null) {
  if (status === "Допущен") return <CheckCircle2 size={14} />;
  if (status === "Не допущен") return <XCircle size={14} />;
  return <Clock3 size={14} />;
}

function inspectionReasons(item: DatabaseInspection) {
  const reasons = [...(item.mechanic_issues || [])];
  if (item.drug_intoxication) reasons.push("Наркотическое опьянение");
  if (item.breathalyzer_value !== null && item.breathalyzer_value > 0) {
    reasons.push(`Алкоголь: ${item.breathalyzer_value.toFixed(2)}‰`);
  }
  return reasons;
}

export default function DriverHistoryModal({ isOpen, driver, onClose }: Props) {
  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [startDate, setStartDate] = useState(toDateInput(monthStart));
  const [endDate, setEndDate] = useState(toDateInput(today));
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

    return () => {
      cancelled = true;
    };
  }, [isOpen, driver, startDate, endDate]);

  if (!isOpen || !driver) return null;

  const setPeriod = (type: "today" | "week" | "month") => {
    const now = new Date();
    if (type === "today") {
      const value = toDateInput(now);
      setStartDate(value);
      setEndDate(value);
    } else if (type === "week") {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(toDateInput(monday));
      setEndDate(toDateInput(sunday));
    } else {
      setStartDate(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">История осмотров</h3>
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">№{driver.driver_id || driver.id}</span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500">{driver.name || "Без имени"} · {driver.customer?.name || "Без заказчика"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-600">
                С даты
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
              </label>
              <label className="text-xs font-medium text-slate-600">
                По дату
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPeriod("today")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Сегодня</button>
              <button type="button" onClick={() => setPeriod("week")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Неделя</button>
              <button type="button" onClick={() => setPeriod("month")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Месяц</button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">Загрузка истории...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <CalendarDays size={28} className="mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">За выбранный период прохождений нет</p>
              <p className="mt-1 text-xs text-slate-400">Попробуйте выбрать другой период.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const pressure = item.blood_pressure_systolic !== null && item.blood_pressure_diastolic !== null
                  ? `${item.blood_pressure_systolic}/${item.blood_pressure_diastolic}`
                  : "—";
                const reasons = inspectionReasons(item);
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{formatDateTime(item.requested_at)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${statusClass(item.overall_status)}`}>
                            {statusIcon(item.overall_status)} {item.overall_status || "Без статуса"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">Медик</span><div className="mt-0.5 font-medium text-slate-800">{item.medical_status || "—"}</div></div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">Давление</span><div className="mt-0.5 font-mono font-medium text-slate-800">{pressure}</div></div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">Механик</span><div className="mt-0.5 font-medium text-slate-800">{item.mechanic_status || "—"}</div></div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        <div>Алкоголь: <span className="font-mono font-semibold text-slate-700">{item.breathalyzer_value === null ? "—" : `${item.breathalyzer_value.toFixed(2)}‰`}</span></div>
                        <div className="mt-1">Наркотическое опьянение: <span className={item.drug_intoxication ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>{item.drug_intoxication ? "Да" : "Нет"}</span></div>
                      </div>
                    </div>
                    {reasons.length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Причины / замечания:</span> {reasons.join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
