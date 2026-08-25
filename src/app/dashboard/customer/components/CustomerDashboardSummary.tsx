"use client";

import { Building2, AlertTriangle, CheckCircle2, Clock3, FileCheck2, XCircle } from "lucide-react";
import type { CustomerDriver } from "@/services/customer-dashboard.service";
import type { CheckData } from "../types";

interface Props {
  customerName: string;
  currentUser: { login?: string } | null;
  drivers: CustomerDriver[];
  monthChecks: CheckData[];
  checks: CheckData[];
  stats: { approved: number; rejected: number; pending: number };
  balance: number | null;
  monthLabel: string;
  formatted: string;
}

export default function CustomerDashboardSummary({ customerName, currentUser, drivers, monthChecks, checks, stats, balance, monthLabel, formatted }: Props) {
  return <>
    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Допущено",stats.approved,CheckCircle2,"text-emerald-500"],["Не допущено",stats.rejected,XCircle,"text-red-500"],["Ожидание",stats.pending,Clock3,"text-amber-500"],["Без осмотра",Math.max(0,drivers.length-new Set(checks.map(c=>c.driver_id)).size),AlertTriangle,"text-slate-400"]].map(([l,v,I,c])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{l}</span><I className={String(c)} size={20}/></div><div className="mt-3 text-3xl font-bold">{v as number}</div><div className="mt-1 text-xs text-slate-500">за {formatted}</div></div>)}</section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5"><Building2 size={19}/></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Компания</div><h3 className="mt-1 text-lg font-bold">{customerName}</h3></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Логин</div><div className="mt-1 font-semibold">{currentUser?.login||"—"}</div></div><div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Водителей</div><div className="mt-1 font-semibold">{drivers.length}</div></div><div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Баланс</div><div className="mt-1 font-semibold">{balance==null?"—":`${balance.toFixed(2)} BYN`}</div></div></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><FileCheck2 size={15}/>Осмотров за {monthLabel}</div><div className="mt-2 text-2xl font-bold">{monthChecks.length}</div></div></section>
  </>;
}
