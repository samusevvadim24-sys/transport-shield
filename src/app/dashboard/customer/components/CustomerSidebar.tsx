"use client";

import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { CustomerBalanceTransaction } from "@/services/customer-dashboard.service";
import type { CheckData } from "../types";

interface Props {
  viewDate: Date;
  today: Date;
  monthLabel: string;
  selectedDate: Date;
  transactions: CustomerBalanceTransaction[];
  checks: CheckData[];
  setViewDate: (date: Date) => void;
  setSelectedDate: (date: Date) => void;
}

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export default function CustomerSidebar({ viewDate, today, monthLabel, selectedDate, transactions, checks, setViewDate, setSelectedDate }: Props) {
  const days = Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1)
    .filter(d => new Date(viewDate.getFullYear(), viewDate.getMonth(), d) <= new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const inspectionDates = new Set(checks.map(c => c.dateISO));
  const firstDayOffset = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;
  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  return (
    <div className="min-w-0 w-full">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95">
            <ChevronLeft size={18}/>
          </button>
          <div className="min-w-0 truncate text-center text-sm font-bold capitalize">{monthLabel}</div>
          <button type="button" aria-label="Следующий месяц" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} disabled={isCurrentMonth} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 disabled:opacity-30">
            <ChevronRight size={18}/>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 sm:mt-5">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => <div key={d}>{d}</div>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} aria-hidden="true" className="h-9" />)}
          {days.map(d => {
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const dateISO = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
            const selected = date.toDateString() === selectedDate.toDateString();
            const hasInspections = inspectionDates.has(dateISO);
            return (
              <button type="button" key={d} onClick={() => setSelectedDate(date)} aria-label={`${d} ${monthLabel}`} aria-pressed={selected} className={`relative h-9 min-w-0 rounded-lg text-xs font-semibold transition-colors ${selected ? "bg-[#0b6078] text-white" : "hover:bg-slate-100 active:bg-slate-200"}`}>
                {d}
                {hasInspections && <span aria-hidden="true" className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? "bg-emerald-300" : "bg-emerald-500"}`} />}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => { setSelectedDate(today); setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); }} className="mt-4 h-10 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200">Сегодня</button>
      </div>

      <div className="mt-4 hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">История операций</h3></div></div>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {transactions.length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">Операций пока нет</div> : transactions.map(t => {
            const amount = Number(t.amount);
            const positive = Number.isFinite(amount) && amount > 0;
            const driver = t.driver_name || t.driver_id;
            return <div key={t.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-start gap-3"><div className={`mt-0.5 shrink-0 rounded-xl p-2 ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{positive ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="text-sm font-bold">{positive ? "Пополнение" : "Списание"}</span><span className={`shrink-0 text-sm font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>{positive ? "+" : ""}{money(t.amount)} BYN</span></div><div className="mt-1 break-words text-xs text-slate-500">{t.description || "Операция по балансу"}</div>{!positive && driver && <div className="mt-1 truncate text-xs font-medium text-slate-600">Водитель: {driver}</div>}<div className="mt-1 text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div></div></div></div>;
          })}
        </div>
      </div>
    </div>
  );
}
