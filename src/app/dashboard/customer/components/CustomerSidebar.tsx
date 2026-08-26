"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
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

function getInspectionTitle(transaction: CustomerBalanceTransaction) {
  const description = `${transaction.description || ""}`.toLowerCase().replace(/ё/g, "е");
  if (description.includes("мед") && description.includes("осмотр")) return "Прохождение мед. осмотра";
  if (description.includes("тех") && description.includes("осмотр")) return "Прохождение механика";
  return null;
}

export default function CustomerSidebar({ viewDate, today, monthLabel, selectedDate, transactions, checks, setViewDate, setSelectedDate }: Props) {
  const days = Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1)
    .filter(d => new Date(viewDate.getFullYear(), viewDate.getMonth(), d) <= new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const inspectionDates = new Set(checks.map(c => c.dateISO));
  const firstDayOffset = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;
  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();
  const inspectionHistory = transactions
    .map(transaction => ({ transaction, title: getInspectionTitle(transaction) }))
    .filter((item): item is { transaction: CustomerBalanceTransaction; title: string } => Boolean(item.title));

  return (
    <div className="min-w-0 w-full">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95"><ChevronLeft size={18}/></button>
          <div className="min-w-0 truncate text-center text-sm font-bold capitalize">{monthLabel}</div>
          <button type="button" aria-label="Следующий месяц" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} disabled={isCurrentMonth} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 disabled:opacity-30"><ChevronRight size={18}/></button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 sm:mt-5">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => <div key={d}>{d}</div>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} aria-hidden="true" className="h-9" />)}
          {days.map(d => { const date=new Date(viewDate.getFullYear(),viewDate.getMonth(),d); const dateISO=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; const selected=date.toDateString()===selectedDate.toDateString(); const hasInspections=inspectionDates.has(dateISO); return <button type="button" key={d} onClick={()=>setSelectedDate(date)} aria-label={`${d} ${monthLabel}`} aria-pressed={selected} className={`relative h-9 min-w-0 rounded-lg text-xs font-semibold transition-colors ${selected ? "bg-[#0b6078] text-white" : "hover:bg-slate-100 active:bg-slate-200"}`}>{d}{hasInspections&&<span aria-hidden="true" className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? "bg-emerald-300" : "bg-emerald-500"}`} />}</button>; })}
        </div>
        <button type="button" onClick={()=>{setSelectedDate(today);setViewDate(new Date(today.getFullYear(),today.getMonth(),1));}} className="mt-4 h-10 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200">Сегодня</button>
      </div>

      <div className="mt-4 hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">История прохождений</h3><p className="mt-1 text-xs text-slate-400">{inspectionHistory.length} прохождений</p></div></div>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {inspectionHistory.length===0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">Прохождений пока нет</div> : inspectionHistory.map(({ transaction: t, title }) => { const driver=t.driver_name||t.driver_id; return <div key={t.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-start gap-3"><div className="mt-0.5 shrink-0 rounded-xl bg-[#e8f4f7] p-2 text-[#0b6078]"><History size={16}/></div><div className="min-w-0 flex-1"><div className="text-sm font-bold">{title}</div>{driver&&<div className="mt-1 truncate text-xs font-medium text-slate-600">Водитель: {driver}</div>}<div className="mt-1 text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div></div></div></div>; })}
        </div>
      </div>
    </div>
  );
}
