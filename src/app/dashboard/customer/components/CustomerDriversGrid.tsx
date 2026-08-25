"use client";

import { Car } from "lucide-react";
import type { CustomerDriver } from "@/services/customer-dashboard.service";
import type { CheckData } from "../types";
import { dot, tone } from "../types";

interface Props {
  drivers: CustomerDriver[];
  checks: CheckData[];
  checksLoading: boolean;
  search: string;
  formatted: string;
  setSearch: (value: string) => void;
  onSelectDriver: (driver: CustomerDriver) => void;
}

export default function CustomerDriversGrid({ drivers, checks, checksLoading, search, formatted, setSearch, onSelectDriver }: Props) {
  const filtered = search.trim() ? drivers.filter(d => `${d.name} ${d.number} ${d.car_brand} ${d.car_number}`.toLowerCase().includes(search.toLowerCase().trim())) : drivers;
  return <div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Водители</h2><p className="mt-1 text-sm text-slate-500">Результаты осмотров на {formatted}</p></div><div className="relative w-full sm:w-[280px]"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск водителя или авто..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none focus:border-[#0b6078]"/></div></div>
    {checksLoading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Загружаем результаты...</div> : <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filtered.map(d => {
      const ds = checks.filter(c => c.driver_id === d.id); const last = ds[0];
      return <button type="button" key={d.id} onClick={() => onSelectDriver(d)} className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0b6078]/30 hover:shadow-md">
        <div className="min-w-0"><div className="truncate text-base font-bold">{d.name || "Без имени"}</div><div className="mt-1 flex items-center gap-2 text-xs text-slate-400"><Car size={14}/>{d.car_brand || "Автомобиль"}{d.car_number ? ` • ${d.car_number}` : ""}{d.number && <span>· № {d.number}</span>}{last && <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${tone(last.overall_status)}`}>{last.overall_status}</span>}</div></div>
        {last ? <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs"><div className="flex justify-between"><span className="text-slate-500">Медик</span><span className="flex items-center gap-2 font-medium"><span className={`h-2 w-2 rounded-full ${dot(last.medical_status)}`}/>{last.medical_status}</span></div><div className="flex justify-between"><span className="text-slate-500">Механик</span><span className="flex items-center gap-2 font-medium"><span className={`h-2 w-2 rounded-full ${dot(last.mechanic_status)}`}/>{last.mechanic_status}</span></div><div className="flex justify-between text-slate-400"><span>Время</span><span>{last.time}</span></div></div> : <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">За выбранную дату осмотр не зарегистрирован.</div>}
      </button>;
    })}</div>}
  </div>;
}
