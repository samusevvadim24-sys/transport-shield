/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Edit, Trash2, Mail, X, ChevronLeft, ChevronRight, FileText, Wallet } from "lucide-react";
import { DatabaseCustomer } from "../../../../types/database.types";
import { fetchCustomers, deleteCustomerRecord, createCustomer, updateCustomer, CUSTOMERS_PAGE_SIZE } from "../../../../services/customers-admin.service";
import CustomerModal from "../components/ui/CustomerEditModal";
import DeleteCustomerModal from "../components/ui/DeleteCustomerModal";
import CustomerBalanceTopUpModal from "../components/ui/CustomerBalanceTopUpModal";

const SEARCH_DEBOUNCE_MS = 350;

function pluralizeRecords(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "записей";
  if (mod10 === 1) return "запись";
  if (mod10 >= 2 && mod10 <= 4) return "записи";
  return "записей";
}

export default function CustomersTab() {
  const [customers, setCustomers] = useState<DatabaseCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<DatabaseCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<DatabaseCustomer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [balanceCustomer, setBalanceCustomer] = useState<DatabaseCustomer | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const { customers: data, totalCount } = await fetchCustomers({ currentPage, search: debouncedSearch });
      if (requestId !== latestRequestId.current) return;
      setCustomers(data);
      setTotalRecords(totalCount);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      console.error("Ошибка загрузки заказчиков:", err);
      setCustomers([]);
      setTotalRecords(0);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.ceil(totalRecords / CUSTOMERS_PAGE_SIZE) || 1;

  const handleSaveCustomer = async (formData: Partial<DatabaseCustomer>): Promise<string | void> => {
    try {
      if (editingCustomer) {
        const { error } = await updateCustomer(editingCustomer.id, formData);
        if (error) return `Не удалось обновить данные заказчика: ${error.message}`;
      } else {
        const { error } = await createCustomer(formData as Omit<DatabaseCustomer, "id" | "created_at">);
        if (error) return `Не удалось создать заказчика: ${error.message}`;
      }
      await loadData();
    } catch (error: any) {
      console.error("Ошибка при сохранении заказчика:", error);
      return error?.message || "Произошла непредвиденная ошибка при сохранении заказчика. Попробуйте ещё раз.";
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { error } = await deleteCustomerRecord(deletingCustomer.id, deletingCustomer.user_id);
      if (error) {
        setDeleteError(error.message || "Не удалось удалить заказчика. Попробуйте ещё раз.");
        return;
      }
      setIsDeleteModalOpen(false);
      setDeletingCustomer(null);
      setDeleteError(null);
      const isLastItemOnPage = customers.length === 1;
      if (isLastItemOnPage && currentPage > 1) {
        setTotalRecords((prev) => Math.max(0, prev - 1));
        setCurrentPage((prev) => Math.max(1, prev - 1));
        return;
      }
      setCustomers((prev) => prev.filter((customer) => customer.id !== deletingCustomer.id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Ошибка при удалении заказчика:", error);
      setDeleteError(error?.message || "Произошла ошибка при удалении заказчика. Попробуйте ещё раз.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCreate = () => { setEditingCustomer(null); setIsModalOpen(true); };
  const openEdit = (customer: DatabaseCustomer) => { setEditingCustomer(customer); setIsModalOpen(true); };
  const openDelete = (customer: DatabaseCustomer) => { setDeletingCustomer(customer); setDeleteError(null); setIsDeleteModalOpen(true); };
  const openBalance = (customer: DatabaseCustomer) => { setBalanceCustomer(customer); setIsBalanceModalOpen(true); };
  const closeDelete = () => { if (deleteLoading) return; setIsDeleteModalOpen(false); setDeletingCustomer(null); setDeleteError(null); };
  const closeBalance = () => { setIsBalanceModalOpen(false); setBalanceCustomer(null); };

  const handleBalanceSuccess = (newBalance: number) => {
    if (!balanceCustomer) return;
    setCustomers((prev) => prev.map((customer) => customer.id === balanceCustomer.id ? { ...customer, balance: newBalance } : customer));
    setBalanceCustomer((prev) => prev ? { ...prev, balance: newBalance } : prev);
  };

  return (
    <div className="w-full px-2 sm:px-4 md:px-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Заказчики</h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">Управление компаниями-партнерами и договорами</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={openCreate} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#073850]"><Plus size={16} />Добавить</button>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs text-slate-500 shadow-sm sm:text-left sm:text-sm">Страница <strong className="text-slate-900">{currentPage}</strong> из <strong className="text-slate-900">{totalPages}</strong> <span className="text-slate-400">({totalRecords} {pluralizeRecords(totalRecords)})</span></div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-6">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по номеру, названию, УНП..." className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-sm outline-none transition-all focus:border-[#042433] focus:bg-white focus:ring-1 focus:ring-[#042433]" />
          {search && <button type="button" onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">Загрузка списка заказчиков...</div>
      ) : customers.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">{debouncedSearch ? `Ничего не найдено по запросу «${debouncedSearch}»` : "Заказчики не найдены"}</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Заказчик</th><th className="w-32 px-4 py-4">УНП</th><th className="w-40 px-4 py-4">Реквизиты договора</th><th className="w-36 px-4 py-4">Баланс</th><th className="px-4 py-4">Контакты</th><th className="w-36 px-4 py-4 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((cust) => (
                    <tr key={cust.id} className="align-middle transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-4"><div className="flex items-start gap-2.5"><span className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">{cust.number ? `№${cust.number}` : "—"}</span><div className="min-w-0"><div className="font-semibold text-slate-900">{cust.type && <span className="mr-1 font-normal text-slate-500">{cust.type}</span>}<span className="cursor-pointer select-none" title="Открыть историю списаний">{cust.name}</span></div>{cust.address && <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{cust.address}</div>}</div></div></td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700">{cust.unp || "—"}</td>
                      <td className="px-4 py-4 text-xs">{cust.contract_number ? <><div className="font-medium text-slate-800">№ {cust.contract_number}</div>{cust.contract_date && <div className="text-[10px] text-slate-400">от {cust.contract_date}</div>}</> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-4"><div className="flex items-center gap-2"><div><div className="font-semibold text-slate-900">{Number(cust.balance || 0).toFixed(2)} BYN</div><div className="text-[10px] text-slate-400">текущий баланс</div></div><button type="button" onClick={() => openBalance(cust)} title="Пополнить баланс" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"><Wallet size={15} /></button></div></td>
                      <td className="px-4 py-4 text-xs">{cust.contact_person && <div className="font-medium text-slate-800">{cust.contact_person}</div>}{cust.phone && <div className="text-slate-600">{cust.phone}</div>}{cust.email && <div className="mt-0.5 flex items-center gap-1 text-slate-400"><Mail size={12} /><span className="max-w-[150px] truncate">{cust.email}</span></div>}</td>
                      <td className="px-4 py-4"><div className="flex w-full flex-col items-center justify-center gap-1.5"><button type="button" onClick={() => window.open(`/dashboard/admin/customers/${cust.id}/contract`, "_blank")} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"><FileText size={14} className="shrink-0 text-slate-500" />Договор</button><button type="button" onClick={() => openBalance(cust)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100"><Wallet size={14} className="shrink-0 text-emerald-600" />Пополнить</button><button type="button" onClick={() => openEdit(cust)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100"><Edit size={14} className="shrink-0 text-sky-600" />Изменить</button><button type="button" onClick={() => openDelete(cust)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#C53030]/20 bg-[#C53030]/5 px-2 py-1.5 text-xs font-medium text-[#C53030] shadow-sm transition-colors hover:bg-[#C53030]/10"><Trash2 size={14} className="shrink-0" />Удалить</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 sm:hidden">
            {customers.map((cust) => (
              <article key={cust.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow active:shadow-md"><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-1.5">{cust.number && <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">№{cust.number}</span>}{cust.type && <span className="rounded-md bg-[#042433]/5 px-2 py-1 text-[10px] font-medium text-[#042433]">{cust.type}</span>}</div><h3 className="break-words text-base font-bold leading-5 text-slate-900">{cust.name}</h3>{cust.address && <p className="mt-1.5 break-words text-xs leading-4 text-slate-500">{cust.address}</p>}</div><div className="shrink-0 rounded-xl bg-slate-50 p-2 text-slate-400"><FileText size={17} /></div></div><div className="my-4 h-px bg-slate-100" /><div className="grid grid-cols-2 gap-x-4 gap-y-3"><div className="min-w-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">УНП</div><div className="truncate font-mono text-xs font-medium text-slate-700">{cust.unp || "—"}</div></div><div className="min-w-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Договор</div>{cust.contract_number ? <div className="text-xs font-medium text-slate-700">№ {cust.contract_number}{cust.contract_date && <span className="ml-1 text-[10px] font-normal text-slate-400">от {cust.contract_date}</span></div> : <div className="text-xs text-slate-400">Не указан</div>}</div></div><div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50/70 p-3"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/60">Баланс</div><div className="mt-0.5 text-sm font-bold text-emerald-900">{Number(cust.balance || 0).toFixed(2)} BYN</div></div><button type="button" onClick={() => openBalance(cust)} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"><Wallet size={14} />Пополнить</button></div>{(cust.contact_person || cust.phone || cust.email) && <div className="mt-4 rounded-xl bg-slate-50/80 p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Контакты</div>{cust.contact_person && <div className="text-xs font-semibold text-slate-800">{cust.contact_person}</div>}{cust.phone && <a href={`tel:${cust.phone}`} className="mt-1 block text-xs text-slate-600">{cust.phone}</a>}{cust.email && <a href={`mailto:${cust.email}`} className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500"><Mail size={13} className="shrink-0" /><span className="truncate">{cust.email}</span></a>}</div>}</div><div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/50 p-3"><button type="button" onClick={() => window.open(`/dashboard/admin/customers/${cust.id}/contract`, "_blank")} className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors active:bg-slate-50"><FileText size={14} />Договор</button><button type="button" onClick={() => openEdit(cust)} className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 text-[11px] font-semibold text-sky-800 shadow-sm transition-colors active:bg-sky-100"><Edit size={14} className="text-sky-600" />Изменить</button></div></article>
            ))}
          </div>
        </>
      )}

      <CustomerModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }} customer={editingCustomer} onSave={handleSaveCustomer} />
      <DeleteCustomerModal isOpen={isDeleteModalOpen} customer={deletingCustomer} onClose={closeDelete} onConfirm={handleDeleteConfirm} loading={deleteLoading} errorMessage={deleteError} />
      <CustomerBalanceTopUpModal isOpen={isBalanceModalOpen} customer={balanceCustomer} onClose={closeBalance} onSuccess={handleBalanceSuccess} />
    </div>
  );
}