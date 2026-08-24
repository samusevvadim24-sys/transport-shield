/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  History,
  SquarePen,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";
import {
  createDriver,
  deleteDriverRecord,
  DRIVERS_PAGE_SIZE,
  fetchDriverCustomers,
  fetchDrivers,
  updateDriver,
} from "@/services/drivers-admin.service";

import DriverModal from "../components/ui/DriverEditModal";
import DeleteDriverModal from "../components/ui/DeleteDriverModal";

const SEARCH_DEBOUNCE_MS = 350;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
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

  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const latestRequestId = useRef(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);

    try {
      const [{ drivers: data, totalCount }, customerOptions] =
        await Promise.all([
          fetchDrivers({
            currentPage,
            search: debouncedSearch,
          }),
          customers.length === 0
            ? fetchDriverCustomers()
            : Promise.resolve(customers),
        ]);

      if (requestId !== latestRequestId.current) return;

      setDrivers(data);
      setTotalRecords(totalCount);

      if (customers.length === 0) {
        setCustomers(customerOptions);
      }
    } catch (error) {
      if (requestId !== latestRequestId.current) return;

      console.error("Ошибка загрузки водителей:", error);
      setDrivers([]);
      setTotalRecords(0);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [currentPage, debouncedSearch, customers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.ceil(totalRecords / DRIVERS_PAGE_SIZE) || 1;

  const handleAddDriver = () => {
    setEditingDriver(null);
    setIsModalOpen(true);
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setIsModalOpen(true);
  };

  const handleSaveDriver = async (
    formData: DriverFormData
  ): Promise<string | void> => {
    try {
      if (editingDriver) {
        const { error } = await updateDriver(
          editingDriver.id,
          formData,
          editingDriver.user_id
        );

        if (error) {
          return `Не удалось обновить данные водителя: ${error.message}`;
        }
      } else {
        const { error } = await createDriver(formData);

        if (error) {
          return `Не удалось создать водителя: ${error.message}`;
        }
      }

      await loadData();
    } catch (error: any) {
      console.error("Ошибка при сохранении водителя:", error);
      return (
        error?.message ||
        "Произошла непредвиденная ошибка при сохранении водителя."
      );
    }
  };

  const handleDeleteClick = (driver: Driver) => {
    setDeletingDriver(driver);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDriver) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const { error } = await deleteDriverRecord(
        deletingDriver.id,
        deletingDriver.user_id
      );

      if (error) {
        setDeleteError(
          error.message || "Не удалось удалить водителя. Попробуйте ещё раз."
        );
        return;
      }

      setIsDeleteModalOpen(false);
      setDeletingDriver(null);
      setDeleteError(null);

      const isLastItemOnPage = drivers.length === 1;

      if (isLastItemOnPage && currentPage > 1) {
        setTotalRecords((prev) => Math.max(0, prev - 1));
        setCurrentPage((prev) => Math.max(1, prev - 1));
        return;
      }

      setDrivers((prev) =>
        prev.filter((driver) => driver.id !== deletingDriver.id)
      );
      setTotalRecords((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Ошибка при удалении водителя:", error);
      setDeleteError(
        error?.message ||
          "Произошла ошибка при удалении водителя. Попробуйте ещё раз."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteModal = () => {
    if (deleteLoading) return;

    setIsDeleteModalOpen(false);
    setDeletingDriver(null);
    setDeleteError(null);
  };

  const pages: (number | "...")[] = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  })();

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
      <div className="mx-auto max-w-7xl">
        <div className="w-full">
          <div className="w-full space-y-6">
            
            {/* Шапка страницы */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Водители</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Управление штатом водителей, документами и автомобилями
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input accept=".xlsx,.xls" className="hidden" type="file" />
                
                <button
                  type="button"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <Upload size={18} />
                  Импорт Excel
                </button>

                <button
                  type="button"
                  onClick={handleAddDriver}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#042433] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29]"
                >
                  <Plus size={18} />
                  Добавить водителя
                </button>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs sm:text-sm text-slate-500 shadow-sm sm:text-left">
                  Страница <strong className="text-slate-900">{currentPage}</strong> из <strong className="text-slate-900">{totalPages}</strong>{" "}
                  <span className="text-slate-400">({totalRecords})</span>
                </div>
              </div>
            </div>

            {/* Поиск */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по ФИО, номеру, авто..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none transition-all focus:border-[#042433] focus:bg-white focus:ring-1 focus:ring-[#042433]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Таблица / Состояния загрузки */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              {loading ? (
                <div className="flex min-h-60 items-center justify-center">
                  <div className="text-sm text-slate-400">Загрузка водителей...</div>
                </div>
              ) : drivers.length === 0 ? (
                <div className="flex min-h-60 flex-col items-center justify-center px-5 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    {debouncedSearch ? "По вашему запросу ничего не найдено" : "Водителей пока нет"}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="w-[220px] px-4 py-4">№ / ФИО</th>
                        <th className="w-[200px] px-4 py-4">Фирма</th>
                        <th className="w-[180px] px-4 py-4">Автомобиль</th>
                        <th className="w-[160px] px-4 py-4">В/У (Окончание)</th>
                        <th className="w-[180px] px-4 py-4">Справка / ТО / А6</th>
                        <th className="w-32 px-4 py-4 text-center">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {drivers.map((driver) => (
                        <tr
                          key={driver.id}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          {/* № / ФИО */}
                          <td className="px-4 py-4">
                            <div
                              className="group flex min-w-0 cursor-pointer items-center gap-2"
                              title="История осмотров"
                            >
                              <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm transition-colors group-hover:bg-slate-200">
                                №{driver.driver_id || driver.id}
                              </span>
                              <span
                                className="truncate font-semibold text-slate-900 transition-colors group-hover:text-[#042433]"
                                title={driver.name || ""}
                              >
                                {driver.name || "Без имени"}
                              </span>
                              <History
                                size={14}
                                className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
                              />
                            </div>
                          </td>

                          {/* Фирма (Заказчик) */}
                          <td className="px-4 py-4">
                            <div
                              className="truncate text-xs font-medium text-slate-700"
                              title={driver.customer?.name || ""}
                            >
                              {driver.customer?.name || "—"}
                            </div>
                          </td>

                          {/* Автомобиль */}
                          <td className="px-4 py-4 text-xs text-slate-700">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Car size={14} className="shrink-0 text-slate-400" />
                              <span
                                className="truncate font-medium text-slate-800"
                                title={driver.car_brand || ""}
                              >
                                {driver.car_brand || "Марка не указана"}
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono font-semibold text-slate-500">
                              <span className="inline-block rounded border border-slate-200 bg-slate-100/50 px-1.5 py-0.5">
                                {driver.car_number || "Гос. номер не указан"}
                              </span>
                            </div>
                          </td>

                          {/* В/У (Окончание) */}
                          <td className="px-4 py-4 text-xs text-slate-700">
                            <div
                              className="truncate font-mono text-slate-800"
                              title={driver.license_number || ""}
                            >
                              {driver.license_number || "—"}
                            </div>
                            <div className="mt-0.5 text-slate-400">
                              до {formatDate(driver.license_expiry)}
                            </div>
                          </td>

                          {/* Справка / ТО / А6 */}
                          <td className="px-4 py-4 text-xs">
                            <div className="flex flex-col gap-0.5 text-slate-600">
                              <div>
                                Мед: <span className="font-mono text-slate-800">{formatDate(driver.medical_expiry)}</span>
                              </div>
                              <div>
                                ТО: <span className="font-mono text-slate-800">{formatDate(driver.tech_inspection_expiry)}</span>
                              </div>
                              <div>
                                А6: <span className="font-mono text-slate-800">{formatDate(driver.insurance_expiry)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Действия */}
                          <td className="px-4 py-4">
                            <div className="flex w-full flex-col items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditDriver(driver)}
                                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100"
                              >
                                <SquarePen size={14} className="shrink-0 text-sky-600" />
                                <span>Изменить</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(driver)}
                                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#C53030]/20 bg-[#C53030]/5 px-2 py-1.5 text-xs font-medium text-[#C53030] shadow-sm transition-colors hover:bg-[#C53030]/10"
                              >
                                <Trash2 size={14} className="shrink-0" />
                                <span>Удалить</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-2 pt-4 sm:flex-row">
                <button
                  type="button"
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:text-sm"
                >
                  <ChevronLeft size={16} />
                  Назад
                </button>

                <div className="flex max-w-full items-center gap-1 overflow-x-auto px-1">
                  {pages.map((page, index) =>
                    page === "..." ? (
                      <span key={`separator-${index}`} className="px-1 text-xs text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page as number)}
                        className={`h-8 w-8 shrink-0 cursor-pointer rounded-xl text-xs font-medium transition-colors sm:h-9 sm:w-9 sm:text-sm ${
                          currentPage === page
                            ? "bg-[#042433] text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages || loading}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:text-sm"
                >
                  Вперед
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      <DriverModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDriver(null);
        }}
        driver={editingDriver}
        customers={customers}
        onSave={handleSaveDriver}
      />

      <DeleteDriverModal
        isOpen={isDeleteModalOpen}
        driver={deletingDriver}
        loading={deleteLoading}
        errorMessage={deleteError}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}