/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Building2, Calendar, FileText, Car, Stethoscope, Wrench, Wine, Check as CheckIcon, X, RotateCcw, Trash2, Bell } from "lucide-react";
import { Inspection } from "../../../../../types/database.types";

interface CheckCardProps {
  item: Inspection;
  onApprove: (docId: string) => void;
  onReject: (docId: string) => void;
  onResetStatus: (docId: string) => void;
  onDelete: (check: Inspection) => void;
  onCustomerClick?: (customer: string) => void;
  onSummon?: (item: Inspection) => void;
}

export function CheckCard({ item, onApprove, onReject, onResetStatus, onDelete, onCustomerClick, onSummon }: CheckCardProps) {
  const statusStr = item.status as string;
  const isWaiting = statusStr === "Ожидание";
  const hasBloodPressure = item.bloodPressureSystolic != null && item.bloodPressureDiastolic != null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Допущен": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Не допущен": return "bg-rose-50 text-rose-700 border-rose-200";
      case "Явиться": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
      <div className="px-3.5 pt-3.5 pb-3 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FileText size={16} /></div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold leading-5 text-slate-950">Журнал осмотра</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400"><span>№{item.id}</span><span>•</span><Calendar size={11} /><span>{item.date}</span></div>
              </div>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusBadge(item.status)}`}>{item.status}</span>
        </div>
      </div>
      <div className="mx-3.5 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/70 sm:mx-5">
        <div className="text-[15px] font-bold leading-5 text-slate-950">{item.driver}</div>
        <button type="button" className="mt-1 flex max-w-full items-center gap-1.5 text-left text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800" onClick={() => onCustomerClick?.(item.customer)} disabled={!onCustomerClick}><Building2 size={12} className="shrink-0 text-slate-400" /><span className="truncate">{item.customer}</span></button>
      </div>
      <div className="px-3.5 py-3 sm:px-5">
        <div className="flex items-center gap-2"><Car size={14} className="shrink-0 text-slate-400" /><span className="font-mono text-xs font-bold text-slate-800">{item.car.number}</span><span className="text-slate-300">•</span><span className="truncate text-xs text-slate-600">{item.car.brand}</span></div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-5 text-[10px] text-slate-400"><span>ВУ до {item.documents.licenseExpires}</span><span>Мед. до {item.documents.medical}</span><span>ТО до {item.documents.inspection}</span></div>
      </div>
      <div className="border-t border-slate-100 px-3.5 pt-3.5 pb-1 sm:px-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Результаты осмотра</div>
        <div className="space-y-2">
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Stethoscope size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-800">{item.medic}</div><div className="mt-0.5 text-[10px] text-slate-400">Медицинский осмотр · {item.medicTime}</div></div></div>
            {item.medicTime !== "—" && <div className="mt-2 grid grid-cols-2 gap-1.5"><div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[10px]"><span className="text-slate-500">Давление</span><strong className="text-slate-900">{hasBloodPressure ? `${item.bloodPressureSystolic}/${item.bloodPressureDiastolic}` : "—"}</strong></div><div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[10px]"><span className="flex items-center gap-1 text-slate-500"><Wine size={11} className="text-rose-500" /> Алк.</span><strong className="text-slate-900">{item.alcohol ?? "0.0"}</strong></div></div>}
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Wrench size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-800">{item.mechanic}</div><div className="mt-0.5 text-[10px] text-slate-400">Технический осмотр · {item.mechanicTime}</div></div></div>
            {item.mechanicTime !== "—" && <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px]">{item.mechanicReasons && item.mechanicReasons.length > 0 ? <span className="font-medium leading-4 text-rose-600">{item.mechanicReasons.join(", ")}</span> : <span className="font-medium text-emerald-600">Без замечаний</span>}</div>}
          </div>
        </div>
      </div>
      <div className="px-3.5 pt-3.5 pb-3.5 sm:px-5 sm:pb-5">
        {isWaiting ? <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onApprove(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"><CheckIcon size={15} /> Допустить</button><button type="button" onClick={() => onReject(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"><X size={15} /> Не допустить</button><button type="button" onClick={() => onSummon?.(item)} className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"><Bell size={15} /> Явиться</button></div> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onResetStatus(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100"><RotateCcw size={15} /> В ожидание</button><button type="button" onClick={() => onDelete(item)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"><Trash2 size={15} /> Удалить</button></div>}
      </div>
    </article>
  );
}
