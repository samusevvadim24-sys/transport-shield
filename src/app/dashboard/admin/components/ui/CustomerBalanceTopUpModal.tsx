"use client";

import { FormEvent, useEffect, useState } from "react";
import { X, Wallet } from "lucide-react";
import { DatabaseCustomer } from "../../../../types/database.types";
import { topUpCustomerBalance } from "../../../../services/customers-admin.service";

interface CustomerBalanceTopUpModalProps {
  isOpen: boolean;
  customer: DatabaseCustomer | null;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

export default function CustomerBalanceTopUpModal({ isOpen, customer, onClose, onSuccess }: CustomerBalanceTopUpModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Пополнение баланса");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("Пополнение баланса");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen || !customer) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));

    if (!Number.isFinite(value) || value <= 0) {
      setError("Введите корректную сумму больше 0 BYN.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await topUpCustomerBalance(customer.id, value, description);
    setLoading(false);

    if (result.error) {
      setError(result.error.message || "Не удалось пополнить баланс.");
      return;
    }

    onSuccess(Number(result.balance));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-slate-900"><Wallet size={18} className="text-emerald-600" />Пополнение баланса</div>
            <p className="mt-1 text-xs text-slate-500">{customer.name}{customer.number ? ` · №${customer.number}` : ""}</p>
          </div>
          <button type="button" disabled={loading} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Текущий баланс</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{Number(customer.balance || 0).toFixed(2)} BYN</div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Сумма пополнения, BYN</span>
            <input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например, 50.00" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Комментарий</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />
          </label>

          {amount && Number.isFinite(Number(amount.replace(",", "."))) && Number(amount.replace(",", ".")) > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
              После пополнения: <strong>{(Number(customer.balance || 0) + Number(amount.replace(",", "."))).toFixed(2)} BYN</strong>
            </div>
          )}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" disabled={loading} onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Отмена</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-[#042433] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#073850] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Пополнение..." : "Пополнить"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
