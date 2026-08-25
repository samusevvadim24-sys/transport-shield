"use client";

import { Car, ChevronRight, Clock3, Stethoscope, Wrench } from "lucide-react";
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

function getInspectionInfo(check: CheckData) {
  const hasMedical = check.medical_status && check.medical_status !== "Ожидание";
  const hasMechanic = check.mechanic_status && check.mechanic_status !== "Ожидание";

  if (hasMedical && hasMechanic) {
    return { label: "Мед. + мех.", icon: <><Stethoscope size={12} /><Wrench size={12} /></> };
  }
  if (hasMedical) return { label: "Медосмотр", icon: <Stethoscope size={14} /> };
  if (hasMechanic) return { label: "Мехосмотр", icon: <Wrench size={14} /> };
  return { label: "Осмотр", icon: null };
}

function pluralize(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return "прохождение";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "прохождения";
  return "прохождений";
}

export default function CustomerDriversGrid({ drivers, checks, checksLoading, search, formatted, setSearch, onSelectDriver }: Props) {
  const filtered = search.trim()
    ? drivers.filter(d => `${d.name} ${d.driver_id} ${d.car_brand} ${d.car_number}`.toLowerCase().includes(search.toLowerCase().trim()))
    : drivers;

  return <div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-xl font-bold">Водители</h2>
        <p className="mt-1 text-sm text-slate-500">Результаты осмотров на {formatted}</p>
      </div>
      <div className="relative w-full sm:w-[280px]">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск водителя или авто..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none focus:border-[#0b6078]" />
      </div>
    </div>

    {checksLoading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Загружаем результаты...</div> : <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filtered.map(d => {
      const ds = checks
        .filter(c => c.driver_id === d.id)
        .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
      const visibleChecks = ds.slice(0, 3);
      const last = ds[0];
      const hiddenCount = Math.max(0, ds.length - visibleChecks.length);

      return <button type="button" key={d.id} onClick={() => onSelectDriver(d)} className="group w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0b6078]/30 hover:shadow-md">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold">{d.name || "Без имени"}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <Car size={14} />
                {d.car_brand || "Автомобиль"}
                {d.car_number ? ` • ${d.car_number}` : ""}
                {d.driver_id && <span>· № {d.driver_id}</span>}
              </div>
            </div>
            <ChevronRight size={17} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </div>
        </div>

        {last ? <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Прохождения</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{ds.length} {pluralize(ds.length)}</span>
          </div>

          <div className="space-y-2">
            {visibleChecks.map(check => {
              const info = getInspectionInfo(check);
              return <div key={check.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex w-11 shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Clock3 size={12} />
                  {check.time}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center gap-0.5 rounded-lg bg-white text-slate-500 shadow-sm">{info.icon}</span>
                  <span className="truncate text-xs font-medium text-slate-700">{info.label}</span>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-medium ${tone(check.overall_status)}`}>{check.overall_status}</span>
              </div>;
            })}
          </div>

          {hiddenCount > 0 && <div className="pt-2 px-1 text-[11px] font-medium text-slate-400">+ ещё {hiddenCount} {pluralize(hiddenCount)}</div>}
        </div> : <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">За выбранную дату осмотр не зарегистрирован.</div>}
      </button>;
    })}</div>}
  </div>;
}
