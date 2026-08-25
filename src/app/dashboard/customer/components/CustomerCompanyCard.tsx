"use client";

import { Building2 } from "lucide-react";

interface Props {
  customerName: string;
  login?: string;
  driversCount: number;
}

export default function CustomerCompanyCard({ customerName, login, driversCount }: Props) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5"><Building2 size={19}/></div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Компания</div>
          <h3 className="mt-1 text-lg font-bold">{customerName}</h3>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Логин</div><div className="mt-1 font-semibold">{login || "—"}</div></div>
        <div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Водителей</div><div className="mt-1 font-semibold">{driversCount}</div></div>
      </div>
    </section>
  );
}