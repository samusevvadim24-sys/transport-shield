"use client";

import { useEffect, useState } from "react";
import { Car, Clock3, Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { DatabaseCustomer } from "../../../../../types/database.types";
import { CustomerInspectionCharge, fetchCustomerInspectionCharges } from "../../../../../services/customer-balance-history.service";

interface CustomerBalanceHistoryModalProps {
  isOpen: boolean;
  customer: DatabaseCustomer | null;
  onClose: () => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function downloadExcel(customer: DatabaseCustomer, items: CustomerInspectionCharge[]) {
  const rows = items.map((item) => ({
    "Дата": formatDate(item.created_at),
    "Водитель": item.driver_name || "",
    "Марка автомобиля": item.car_brand || "",
    "Номер автомобиля": item.car_number || "",
    "Осмотр №": item.inspection_id ?? "",
    "Сумма списания, BYN": Number(item.amount || 0),
    "Баланс после, BYN": item.balance_after == null ? "" : Number(item.balance_after),
    "Описание": item.description || "",
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 28 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "История списаний");
  const safeName = (customer.name || "заказчик").replace(/[\\/:*?"<>|]/g, "_").trim();
  XLSX.writeFile(workbook, `История списаний - ${safeName}.xlsx`);
}

export default function CustomerBalanceHistoryModal({ isOpen, customer, onClose }: CustomerBalanceHistoryModalProps) {
  const [items, setItems] = useState<CustomerInspectionCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !customer) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCustomerInspectionCharges(customer.id)
      .then((result) => {
        if (cancelled) return;
        if (result.error) { setError(result.error.message || "Не удалось загрузить историю списаний."); setItems([]); }
        else setItems(result.data);
      })
      .catch((err) => { if (!cancelled) { setError(err?.message || "Не удалось загрузить историю списаний."); setItems([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;
  const total = items.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-base font-bold text-slate-900">История списаний</h2><p className="mt-1 text-xs text-slate-500">{customer.name}{customer.number ? ` · №${customer.number}` : ""}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => downloadExcel(customer, items)} disabled={loading || items.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" title="Скачать историю в Excel"><Download size={15} />Excel</button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
          <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Прохождений</div><div className="mt-1 text-lg font-bold text-slate-900">{items.length}</div></div>
          <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Списано</div><div className="mt-1 text-lg font-bold text-slate-900">{total.toFixed(2)} BYN</div></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? <div className="py-12 text-center text-sm text-slate-400">Загрузка истории...</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : items.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">Списаний за прохождение осмотров пока нет.</div> : <div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50/60"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Car size={15} className="shrink-0 text-slate-400" /><span className="truncate">{item.driver_name || "Водитель без имени"}</span></div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">{(item.car_brand || item.car_number) && <span>{[item.car_brand, item.car_number].filter(Boolean).join(" · ")}</span>}{item.inspection_id && <span>Осмотр №{item.inspection_id}</span>}<span className="inline-flex items-center gap-1"><Clock3 size={11} />{formatDate(item.created_at)}</span></div>{item.description && <div className="mt-2 text-xs text-slate-500">{item.description}</div>}</div><div className="shrink-0 text-right"><div className="font-semibold text-red-700">−{Math.abs(Number(item.amount || 0)).toFixed(2)} BYN</div>{item.balance_after != null && <div className="mt-0.5 text-[10px] text-slate-400">баланс: {Number(item.balance_after).toFixed(2)} BYN</div>}</div></div></div>)}</div>}
        </div>
      </div>
    </div>
  );
}
