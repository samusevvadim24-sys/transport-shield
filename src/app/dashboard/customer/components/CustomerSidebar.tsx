"use client";

import { ChevronLeft, ChevronRight, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { CustomerBalanceTransaction } from "@/services/customer-dashboard.service";

interface Props {
  viewDate: Date;
  today: Date;
  monthLabel: string;
  selectedDate: Date;
  transactions: CustomerBalanceTransaction[];
  setViewDate: (date: Date) => void;
  setSelectedDate: (date: Date) => void;
}

export default function CustomerSidebar({ viewDate, today, monthLabel, selectedDate, transactions, setViewDate, setSelectedDate }: Props) {
  const days = Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1)
    .filter(d => new Date(viewDate.getFullYear(), viewDate.getMonth(), d) <= new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  return (
    <div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="rounded-xl p-2 hover:bg-slate-100"><ChevronLeft size={18}/></button>
          <div className="text-sm font-bold capitalize">{monthLabel}</div>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} disabled={viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()} className="rounded-xl p-2 disabled:opacity-30"><ChevronRight size={18}/></button>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => <div key={d}>{d}</div>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => <div key={i}/>) }
          {days.map(d => {
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const selected = date.toDateString() === selectedDate.toDateString();
            return <button key={d} onClick={() => setSelectedDate(date)} className={`relative h-9 rounded-lg text-xs font-semibold ${selected ? "bg-[#0b6078] text-white" : "hover:bg-slate-100"}`}>{d}</button>;
          })}
        </div>
        <button onClick={() => { setSelectedDate(today); setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); }} className="mt-4 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600">Сегодня</button>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Баланс</div><h3 className="mt-1 text-lg font-bold">История операций</h3></div><Wallet size={20} className="text-[#0b6078]"/></div>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {transactions.length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">Операций пока нет</div> : transactions.map(t => {
            const positive = t.amount > 0;
            const driver = t.driver_name || t.driver_id;
            return <div key={t.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-start gap-3"><div className={`mt-0.5 rounded-xl p-2 ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{positive ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{positive ? "Пополнение" : "Списание"}</span><span className={`text-sm font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>{positive ? "+" : ""}{t.amount.toFixed(2)} BYN</span></div><div className="mt-1 text-xs text-slate-500">{t.description || "Операция по балансу"}</div>{!positive && driver && <div className="mt-1 truncate text-xs font-medium text-slate-600">Водитель: {driver}</div>}<div className="mt-1 text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}{t.balance_after != null ? ` · Баланс ${t.balance_after.toFixed(2)} BYN` : ""}</div></div></div></div>;
          })}
        </div>
      </div>
    </div>
  );
}
