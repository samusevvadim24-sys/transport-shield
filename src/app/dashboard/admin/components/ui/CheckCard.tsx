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
  const isApproved = statusStr === "Допущен";
  const isWaiting = statusStr === "Ожидание";
  const hasBloodPressure = item.bloodPressureSystolic != null && item.bloodPressureDiastolic != null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Допущен": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Не допущен": return "bg-rose-50 text-rose-700 border-rose-200";
      case "Явиться": return "bg-amber-100 text-amber-800 border-amber-300";
      default: return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  return (
    <article className={`overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition-shadow sm:p-5 ${
      isApproved ? "ring-1 ring-emerald-200" : "ring-1 ring-slate-200/80"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-lg bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
              №{item.id}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Calendar size={12} /> {item.date}
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm ${getStatusBadge(item.status)}`}>
          {item.status}
        </span>
      </div>

      {/* Driver / customer */}
      <div className="py-3.5">
        <div className="text-[15px] font-bold leading-5 text-slate-950">{item.driver}</div>
        <button
          type="button"
          className="mt-1.5 flex max-w-full items-center gap-1.5 text-left text-xs font-medium text-slate-500 transition-colors hover:text-[#042433]"
          onClick={() => onCustomerClick?.(item.customer)}
          disabled={!onCustomerClick}
        >
          <Building2 size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{item.customer}</span>
        </button>
      </div>

      {/* Vehicle and documents */}
      <div className="space-y-2 border-t border-slate-100 py-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 text-slate-600">
          <div className="flex min-w-0 items-center gap-2">
            <FileText size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">ВУ: <strong className="text-slate-900">{item.documents.license}</strong></span>
          </div>
          <span className="shrink-0 text-[10px] text-slate-400">до {item.documents.licenseExpires}</span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
          <div className="flex min-w-0 items-center gap-1.5">
            <Car size={13} className="shrink-0 text-slate-400" />
            <span className="truncate font-mono font-semibold text-slate-800">{item.car.number}</span>
            <span className="text-slate-300">•</span>
            <span className="truncate text-slate-600">{item.car.brand}</span>
          </div>
          <div className="flex shrink-0 gap-2 text-[10px] text-slate-500">
            <span>Мед: {item.documents.medical}</span>
            <span>ТО: {item.documents.inspection}</span>
          </div>
        </div>
      </div>

      {/* Examination results */}
      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50/70 p-2.5 ring-1 ring-slate-200/70">
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-teal-50 p-1.5 text-teal-700"><Stethoscope size={14} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{item.medic}</div>
              <div className="text-[10px] text-slate-400">{item.medicTime}</div>
            </div>
          </div>
          {item.medicTime !== "—" && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-white p-2 text-[10px] ring-1 ring-slate-100">
              <span className="inline-flex min-w-0 items-center gap-1 text-slate-600">
                <span className="text-[11px]">🩺</span>
                <span>Давление</span>
                <strong className="ml-auto text-slate-900">{hasBloodPressure ? `${item.bloodPressureSystolic}/${item.bloodPressureDiastolic}` : "—"}</strong>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 border-l border-slate-100 pl-2">
                <Wine size={12} className="shrink-0 text-rose-500" />
                <span className="text-slate-500">Алк.</span>
                <strong className="ml-auto text-slate-900">{item.alcohol ?? "0.0"}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50/70 p-2.5 ring-1 ring-slate-200/70">
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-amber-50 p-1.5 text-amber-700"><Wrench size={14} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{item.mechanic}</div>
              <div className="text-[10px] text-slate-400">{item.mechanicTime}</div>
            </div>
          </div>
          {item.mechanicTime !== "—" && (
            <div className="mt-2 rounded-lg bg-white px-2 py-1.5 text-[10px] ring-1 ring-slate-100">
              {item.mechanicReasons && item.mechanicReasons.length > 0
                ? <span className="font-medium leading-4 text-rose-600">{item.mechanicReasons.join(", ")}</span>
                : <span className="font-medium text-emerald-600">Без замечаний</span>}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3.5 border-t border-slate-100 pt-3.5">
        {isWaiting ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onApprove(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700">
              <CheckIcon size={15} /> Допустить
            </button>
            <button type="button" onClick={() => onReject(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700">
              <X size={15} /> Не допустить
            </button>
            <button type="button" onClick={() => onSummon?.(item)} className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100">
              <Bell size={15} /> Явиться
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onResetStatus(item.docId)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100">
              <RotateCcw size={15} /> В ожидание
            </button>
            <button type="button" onClick={() => onDelete(item)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100">
              <Trash2 size={15} /> Удалить
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
