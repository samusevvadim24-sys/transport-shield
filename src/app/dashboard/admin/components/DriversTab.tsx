/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Car, ChevronLeft, ChevronRight, History, SquarePen, Plus, Search, Trash2 } from "lucide-react";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";
import { createDriver, deleteDriverRecord, DRIVERS_PAGE_SIZE, fetchDriverCustomers, fetchDrivers, updateDriver } from "@/services/drivers-admin.service";
import DriverModal from "../components/ui/DriverEditModal";
import DeleteDriverModal from "../components/ui/DeleteDriverModal";
import DriverHistoryModal from "../components/ui/DriverHistoryModal";

const SEARCH_DEBOUNCE_MS = 350;
function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function getExpiryClass(value: string | null | undefined): string {
  if (!value) return "text-slate-800";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "text-slate-800";

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryUtc = Date.UTC(year, month - 1, day);
  const diffDays = Math.round((expiryUtc - todayUtc) / 86400000);

  if (diffDays < 0) return "text-red-600";
  if (diffDays <= 3) return "text-amber-600";
  return "text-slate-800";
}

export default function DriversTab() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [historyDriver, setHistoryDriver] = useState<Driver | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const [{ drivers: data, totalCount }, customerOptions] = await Promise.all([
        fetchDrivers({ currentPage, search: debouncedSearch }),
        customers.length === 0 ? fetchDriverCustomers() : Promise.resolve(customers),
      ]);
      if (requestId !== latestRequestId.current) return;
      setDrivers(data); setTotalRecords(totalCount);
      if (customers.length === 0) setCustomers(customerOptions);
    } catch (error) {
      if (requestId !== latestRequestId.current) return;
      console.error("Ошибка загрузки водителей:", error); setDrivers([]); setTotalRecords(0);
    } finally { if (requestId === latestRequestId.current) setLoading(false); }
  }, [currentPage, debouncedSearch, customers]);
  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.ceil(totalRecords / DRIVERS_PAGE_SIZE) || 1;
  const handleAddDriver = () => { setEditingDriver(null); setIsModalOpen(true); };
  const handleEditDriver = (driver: Driver) => { setEditingDriver(driver); setIsModalOpen(true); };
  const handleDriverHistory = (driver: Driver) => { setHistoryDriver(driver); setIsHistoryModalOpen(true); };

  const handleSaveDriver = async (formData: DriverFormData): Promise<string | void> => {
    try {
      if (editingDriver) {
        const { error } = await updateDriver(editingDriver.id, formData, editingDriver.user_id);
        if (error) return `Не удалось обновить данные водителя: ${error.message}`;
      } else {
        const { error } = await createDriver(formData);
        if (error) return `Не удалось создать водителя: ${error.message}`;
      }
      await loadData();
    } catch (error: any) {
      console.error("Ошибка при сохранении водителя:", error);
      return error?.message || "Произошла непредвиденная ошибка при сохранении водителя.";
    }
  };
  const handleDeleteClick = (driver: Driver) => { setDeletingDriver(driver); setDeleteError(null); setIsDeleteModalOpen(true); };
  const handleDeleteConfirm = async () => {
    if (!deletingDriver) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      const { error } = await deleteDriverRecord(deletingDriver.id, deletingDriver.user_id);
      if (error) { setDeleteError(error.message || "Не удалось удалить водителя. Попробуйте ещё раз."); return; }
      setIsDeleteModalOpen(false); setDeletingDriver(null); setDeleteError(null);
      const isLastItemOnPage = drivers.length === 1;
      if (isLastItemOnPage && currentPage > 1) { setTotalRecords((prev) => Math.max(0, prev - 1)); setCurrentPage((prev) => Math.max(1, prev - 1)); return; }
      setDrivers((prev) => prev.filter((driver) => driver.id !== deletingDriver.id)); setTotalRecords((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Ошибка при удалении водителя:", error);
      setDeleteError(error?.message || "Произошла ошибка при удалении водителя. Попробуйте ещё раз.");
    } finally { setDeleteLoading(false); }
  };
  const handleCloseDeleteModal = () => {
    if (deleteLoading) return;
    setIsDeleteModalOpen(false); setDeletingDriver(null); setDeleteError(null);
  };
  const pages: (number | "...")[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (currentPage >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  })();

  return (
    <div className="w-full">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-2xl font-bold text-slate-900">Водители</h2><p className="mt-1 text-sm text-slate-500">Управление штатом водителей, документами и автомобилями</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={handleAddDriver} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#042433] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29]"><Plus size={18} /> Добавить водителя</button>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs text-slate-500 shadow-sm sm:text-left sm:text-sm">Страница <strong className="text-slate-900">{currentPage}</strong> из <strong className="text-slate-900">{totalPages}</strong> <span className="text-slate-400">({totalRecords})</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по ФИО, номеру, авто..." className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-8 text-sm outline-none transition-all focus:border-[#042433] focus:bg-white focus:ring-1 focus:ring-[#042433]" />{search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">×</button>}</div>
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          {loading ? <div className="flex min-h-60 items-center justify-center"><div className="text-sm text-slate-400">Загрузка водителей...</div></div> : drivers.length === 0 ? <div className="flex min-h-60 flex-col items-center justify-center px-5 text-center"><div className="text-sm font-semibold text-slate-700">{debouncedSearch ? "По вашему запросу ничего не найдено" : "Водителей пока нет"}</div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500"><tr><th className="w-[220px] px-4 py-4">№ / ФИО</th><th className="w-[200px] px-4 py-4">Фирма</th><th className="w-[180px] px-4 py-4">Автомобиль</th><th className="w-[160px] px-4 py-4">В/У (Окончание)</th><th className="w-[180px] px-4 py-4">Справка / ТО / А6</th><th className="w-32 px-4 py-4 text-center">Действия</th></tr></thead><tbody className="divide-y divide-slate-200">
            {drivers.map((driver) => <tr key={driver.id} className="transition-colors hover:bg-slate-50/80"><td className="px-4 py-4"><button type="button" onClick={() => handleDriverHistory(driver)} className="group flex min-w-0 cursor-pointer items-center gap-2 text-left" title="История осмотров"><span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm transition-colors group-hover:bg-slate-200">№{driver.driver_id || driver.id}</span><span className="truncate font-semibold text-slate-900 transition-colors group-hover:text-[#042433]" title={driver.name || ""}>{driver.name || "Без имени"}</span><History size={14} className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" /></button></td><td className="px-4 py-4"><div className="truncate text-xs font-medium text-slate-700" title={driver.customer?.name || ""}>{driver.customer?.name || "—"}</div></td><td className="px-4 py-4 text-xs text-slate-700"><div className="flex min-w-0 items-center gap-1.5"><Car size={14} className="shrink-0 text-slate-400" /><span className="truncate font-medium text-slate-800" title={driver.car_brand || ""}>{driver.car_brand || "Марка не указана"}</span></div><div className="mt-0.5 font-mono font-semibold text-slate-500"><span className="inline-block rounded border border-slate-200 bg-slate-100/50 px-1.5 py-0.5">{driver.car_number || "Гос. номер не указан"}</span></div></td><td className="px-4 py-4 text-xs text-slate-700"><div className="truncate font-mono text-slate-800" title={driver.license_number || ""}>{driver.license_number || "—"}</div><div className="mt-0.5">до <span className={`font-mono font-medium ${getExpiryClass(driver.license_expiry)}`}>{formatDate(driver.license_expiry)}</span></div></td><td className="px-4 py-4 text-xs"><div className="flex flex-col gap-0.5 text-slate-600"><div>Мед: <span className={`font-mono ${getExpiryClass(driver.medical_expiry)}`}>{formatDate(driver.medical_expiry)}</span></div><div>ТО: <span className={`font-mono ${getExpiryClass(driver.tech_inspection_expiry)}`}>{formatDate(driver.tech_inspection_expiry)}</span></div><div>А6: <span className={`font-mono ${getExpiryClass(driver.insurance_expiry)}`}>{formatDate(driver.insurance_expiry)}</span></div></div></td><td className="px-4 py-4"><div className="flex w-full flex-col items-center justify-center gap-1.5"><button type="button" onClick={() => handleEditDriver(driver)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100"><SquarePen size={14} className="shrink-0 text-sky-600" /><span>Изменить</span></button><button type="button" onClick={() => handleDeleteClick(driver)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#C53030]/20 bg-[#C53030]/5 px-2 py-1.5 text-xs font-medium text-[#C53030] shadow-sm transition-colors hover:bg-[#C53030]/10"><Trash2 size={14} className="shrink-0" /><span>Удалить</span></button></div></td></tr>)}
          </tbody></table></div>}
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-400 shadow-sm">Загрузка водителей...</div> : drivers.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center text-sm text-slate-500 shadow-sm">{debouncedSearch ? "По вашему запросу ничего не найдено" : "Водителей пока нет"}</div> : drivers.map((driver) => (
            <article key={driver.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => handleDriverHistory(driver)} className="flex w-full items-start gap-3 p-4 text-left active:bg-slate-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Car size={21} /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">№{driver.driver_id || driver.id}</span><History size={14} className="text-slate-300" /></div><h3 className="mt-1 truncate text-base font-bold text-slate-900">{driver.name || "Без имени"}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{driver.customer?.name || "Заказчик не указан"}</p></div>
              </button>
              <div className="grid grid-cols-2 gap-px border-y border-slate-100 bg-slate-100">
                <div className="bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Автомобиль</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{driver.car_brand || "Не указан"}</p><p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-500">{driver.car_number || "Гос. номер —"}</p></div>
                <div className="bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Водительское</p><p className={`mt-1 truncate font-mono text-sm font-semibold ${getExpiryClass(driver.license_expiry)}`}>{driver.license_number || "—"}</p><p className={`mt-0.5 text-xs ${getExpiryClass(driver.license_expiry)}`}>до {formatDate(driver.license_expiry)}</p></div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 px-3 py-3">
                <div className="pr-2"><p className="text-[10px] text-slate-400">Мед.</p><p className={`mt-0.5 text-xs font-medium ${getExpiryClass(driver.medical_expiry)}`}>{formatDate(driver.medical_expiry)}</p></div>
                <div className="px-2"><p className="text-[10px] text-slate-400">ТО</p><p className={`mt-0.5 text-xs font-medium ${getExpiryClass(driver.tech_inspection_expiry)}`}>{formatDate(driver.tech_inspection_expiry)}</p></div>
                <div className="pl-2"><p className="text-[10px] text-slate-400">А6</p><p className={`mt-0.5 text-xs font-medium ${getExpiryClass(driver.insurance_expiry)}`}>{formatDate(driver.insurance_expiry)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
                <button type="button" onClick={() => handleEditDriver(driver)} className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 text-[11px] font-semibold text-sky-800 shadow-sm transition-colors active:bg-sky-100"><SquarePen size={14} className="text-sky-600" /> Изменить</button>
                <button type="button" onClick={() => handleDeleteClick(driver)} className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 shadow-sm transition-colors active:bg-red-100"><Trash2 size={14} /> Удалить</button>
              </div>
            </article>
          ))}
        </div>
        {totalPages > 1 && <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-2 pt-4 sm:flex-row"><button type="button" disabled={currentPage === 1 || loading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:text-sm"><ChevronLeft size={16} /> Назад</button><div className="flex max-w-full items-center gap-1 overflow-x-auto px-1">{pages.map((page, index) => page === "..." ? <span key={`separator-${index}`} className="px-1 text-xs text-slate-400">...</span> : <button key={page} type="button" onClick={() => setCurrentPage(page as number)} className={`h-8 w-8 shrink-0 cursor-pointer rounded-xl text-xs font-medium transition-colors sm:h-9 sm:w-9 sm:text-sm ${currentPage === page ? "bg-[#042433] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{page}</button>)}</div><button type="button" disabled={currentPage === totalPages || loading} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:text-sm">Вперед <ChevronRight size={16} /> </button></div>}
      </div>
      <DriverModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingDriver(null); }} driver={editingDriver} customers={customers} onSave={handleSaveDriver} />
      <DeleteDriverModal isOpen={isDeleteModalOpen} driver={deletingDriver} loading={deleteLoading} errorMessage={deleteError} onClose={handleCloseDeleteModal} onConfirm={handleDeleteConfirm} />
      <DriverHistoryModal isOpen={isHistoryModalOpen} driver={historyDriver} onClose={() => { setIsHistoryModalOpen(false); setHistoryDriver(null); }} />
    </div>
  );
}
