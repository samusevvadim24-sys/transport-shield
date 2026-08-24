/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Mail,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

import { DatabaseCustomer } from "../../../../types/database.types";

import {
  fetchCustomers,
  deleteCustomerRecord,
  createCustomer,
  updateCustomer,
  CUSTOMERS_PAGE_SIZE,
} from "../../../../services/customers-admin.service";

import CustomerModal from "../components/ui/CustomerEditModal";
import DeleteCustomerModal from "../components/ui/DeleteCustomerModal";

// Через сколько мс после последнего нажатия клавиши отправлять запрос поиска
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Возвращает правильную форму слова "запись" для указанного числа.
 * 1 запись, 2 записи, 5 записей, 11 записей, 21 запись и т.д.
 */
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

  // Модалка создания/редактирования
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<DatabaseCustomer | null>(null);

  // Модалка удаления
  const [deletingCustomer, setDeletingCustomer] =
    useState<DatabaseCustomer | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Номер последнего запущенного запроса к серверу. Нужен, чтобы
  // игнорировать устаревшие ответы, если пользователь успел сменить
  // страницу или поисковый запрос до того, как пришёл предыдущий ответ
  // (без этого список мог "мигать" и показывать не те данные).
  const latestRequestId = useRef(0);

  // ---------------------------------------------------------
  // Debounce поиска — не дёргаем сервер на каждое нажатие клавиши
  // ---------------------------------------------------------

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [search]);

  // При изменении поискового запроса всегда возвращаемся на первую страницу
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // ---------------------------------------------------------
  // Загрузка заказчиков
  // ---------------------------------------------------------

  const loadData = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);

    try {
      const { customers: data, totalCount } = await fetchCustomers({
        currentPage,
        search: debouncedSearch,
      });

      // Если за время запроса пользователь уже переключил страницу
      // или изменил поиск — этот ответ устарел, игнорируем его
      if (requestId !== latestRequestId.current) return;

      setCustomers(data);
      setTotalRecords(totalCount);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;

      console.error("Ошибка загрузки заказчиков:", err);

      setCustomers([]);
      setTotalRecords(0);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.ceil(totalRecords / CUSTOMERS_PAGE_SIZE) || 1;

  // ---------------------------------------------------------
  // Открытие модалки создания
  // ---------------------------------------------------------

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  // ---------------------------------------------------------
  // Открытие модалки редактирования
  // ---------------------------------------------------------

  const handleEditCustomer = (customer: DatabaseCustomer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  // ---------------------------------------------------------
  // Сохранение заказчика
  // ---------------------------------------------------------

  const handleSaveCustomer = async (
    formData: Partial<DatabaseCustomer>
  ): Promise<string | void> => {
    try {
      if (editingCustomer) {
        // Редактирование существующего заказчика
        const { error } = await updateCustomer(
          editingCustomer.id,
          formData
        );

        if (error) {
          return `Не удалось обновить данные заказчика: ${error.message}`;
        }
      } else {
        // Создание нового заказчика.
        //
        // createCustomer вызывает RPC, которая создаёт
        // users и customers в рамках одной транзакции.
        const { error } = await createCustomer(
          formData as Omit<DatabaseCustomer, "id" | "created_at">
        );

        if (error) {
          return `Не удалось создать заказчика: ${error.message}`;
        }
      }

      await loadData();
    } catch (error: any) {
      console.error("Ошибка при сохранении заказчика:", error);

      return (
        error?.message ||
        "Произошла непредвиденная ошибка при сохранении заказчика. Попробуйте ещё раз."
      );
    }
  };

  // ---------------------------------------------------------
  // Открытие модалки удаления
  // ---------------------------------------------------------

  const handleDeleteClick = (customer: DatabaseCustomer) => {
    setDeletingCustomer(customer);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  // ---------------------------------------------------------
  // Подтверждение удаления
  // ---------------------------------------------------------

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const { error } = await deleteCustomerRecord(
        deletingCustomer.id,
        deletingCustomer.user_id
      );

      if (error) {
        setDeleteError(
          error.message || "Не удалось удалить заказчика. Попробуйте ещё раз."
        );
        return;
      }

      // Закрываем модалку сразу, чтобы интерфейс не "прыгал"
      // в процессе пересчёта страницы ниже
      setIsDeleteModalOpen(false);
      setDeletingCustomer(null);
      setDeleteError(null);

      const isLastItemOnPage = customers.length === 1;

      if (isLastItemOnPage && currentPage > 1) {
        // Удалили последнюю запись на странице — просто переходим
        // на предыдущую страницу, смена currentPage сама вызовет
        // повторную загрузку данных (без лишнего "мигания" списка)
        setTotalRecords((prev) => Math.max(0, prev - 1));
        setCurrentPage((prev) => Math.max(1, prev - 1));
        return;
      }

      // В остальных случаях просто убираем заказчика из уже
      // загруженного списка, без лишнего запроса к серверу
      setCustomers((prev) =>
        prev.filter((customer) => customer.id !== deletingCustomer.id)
      );
      setTotalRecords((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Ошибка при удалении заказчика:", error);

      setDeleteError(
        error?.message ||
          "Произошла ошибка при удалении заказчика. Попробуйте ещё раз."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Закрытие модалки удаления
  // ---------------------------------------------------------

  const handleCloseDeleteModal = () => {
    if (deleteLoading) return;

    setIsDeleteModalOpen(false);
    setDeletingCustomer(null);
    setDeleteError(null);
  };

  return (
    <div className="w-full px-2 sm:px-4 md:px-0">
      {/* -------------------------------------------------- */}
      {/* Шапка */}
      {/* -------------------------------------------------- */}

      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Заказчики
          </h2>

          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
            Управление компаниями-партнерами и договорами
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAddCustomer}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#073850] cursor-pointer"
          >
            <Plus size={16} />
            <span>Добавить</span>
          </button>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-500 shadow-sm text-center sm:text-left">
            Страница{" "}
            <strong className="text-slate-900">{currentPage}</strong>{" "}
            из <strong className="text-slate-900">{totalPages}</strong>{" "}
            <span className="text-slate-400">
              ({totalRecords} {pluralizeRecords(totalRecords)})
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Поиск */}
      {/* -------------------------------------------------- */}

      <div className="mb-4 sm:mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative w-full">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру, названию, УНП..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-sm outline-none transition-all focus:border-[#042433] focus:bg-white focus:ring-1 focus:ring-[#042433]"
          />

          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Список заказчиков */}
      {/* -------------------------------------------------- */}

      <div>
        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
            Загрузка списка заказчиков...
          </div>
        ) : customers.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
            {debouncedSearch
              ? `Ничего не найдено по запросу «${debouncedSearch}»`
              : "Заказчики не найдены"}
          </div>
        ) : (
          <>
            {/* Desktop: таблица */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="w-28 px-4 py-4">ID</th>
                      <th className="px-4 py-4">Компания</th>
                      <th className="w-32 px-4 py-4">УНП</th>
                      <th className="w-40 px-4 py-4">Реквизиты договора</th>
                      <th className="px-4 py-4">Контакты</th>
                      <th className="w-36 px-4 py-4 text-center">Действия</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {customers.map((cust) => (
                      <tr
                        key={cust.id}
                        className="align-middle transition-colors hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-2xs">
                            {cust.number ? `№${cust.number}` : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 font-semibold text-slate-900">
                            {cust.type && (
                              <span className="font-normal text-slate-500">
                                {cust.type}
                              </span>
                            )}
                            <span>{cust.name}</span>
                          </div>

                          {cust.address && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              {cust.address}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 font-mono text-xs text-slate-700">
                          {cust.unp || "—"}
                        </td>

                        <td className="px-4 py-4 text-xs">
                          {cust.contract_number ? (
                            <>
                              <div className="font-medium text-slate-800">
                                № {cust.contract_number}
                              </div>
                              {cust.contract_date && (
                                <div className="text-[10px] text-slate-400">
                                  от {cust.contract_date}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs">
                          {cust.contact_person && (
                            <div className="font-medium text-slate-800">
                              {cust.contact_person}
                            </div>
                          )}
                          {cust.phone && (
                            <div className="text-slate-600">{cust.phone}</div>
                          )}
                          {cust.email && (
                            <div className="mt-0.5 flex items-center gap-1 text-slate-400">
                              <Mail size={12} />
                              <span className="max-w-[150px] truncate">
                                {cust.email}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex w-full flex-col items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  `/dashboard/admin/customers/${cust.id}/contract`,
                                  "_blank"
                                )
                              }
                              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                            >
                              <FileText size={14} className="shrink-0 text-slate-500" />
                              <span>Договор</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditCustomer(cust)}
                              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100"
                            >
                              <Edit size={14} className="shrink-0 text-sky-600" />
                              <span>Изменить</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteClick(cust)}
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
            </div>

            {/* Mobile: карточки заказчиков */}
            <div className="grid gap-3 sm:hidden">
              {customers.map((cust) => (
                <article
                  key={cust.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow active:shadow-md"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          {cust.number && (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                              №{cust.number}
                            </span>
                          )}
                          {cust.type && (
                            <span className="rounded-md bg-[#042433]/5 px-2 py-1 text-[10px] font-medium text-[#042433]">
                              {cust.type}
                            </span>
                          )}
                        </div>

                        <h3 className="break-words text-base font-bold leading-5 text-slate-900">
                          {cust.name}
                        </h3>

                        {cust.address && (
                          <p className="mt-1.5 break-words text-xs leading-4 text-slate-500">
                            {cust.address}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 rounded-xl bg-slate-50 p-2 text-slate-400">
                        <FileText size={17} />
                      </div>
                    </div>

                    <div className="my-4 h-px bg-slate-100" />

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          УНП
                        </div>
                        <div className="truncate font-mono text-xs font-medium text-slate-700">
                          {cust.unp || "—"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Договор
                        </div>
                        {cust.contract_number ? (
                          <div className="text-xs font-medium text-slate-700">
                            № {cust.contract_number}
                            {cust.contract_date && (
                              <span className="ml-1 text-[10px] font-normal text-slate-400">
                                от {cust.contract_date}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">Не указан</div>
                        )}
                      </div>
                    </div>

                    {(cust.contact_person || cust.phone || cust.email) && (
                      <div className="mt-4 rounded-xl bg-slate-50/80 p-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Контакты
                        </div>

                        {cust.contact_person && (
                          <div className="text-xs font-semibold text-slate-800">
                            {cust.contact_person}
                          </div>
                        )}

                        {cust.phone && (
                          <a
                            href={`tel:${cust.phone}`}
                            className="mt-1 block text-xs text-slate-600"
                          >
                            {cust.phone}
                          </a>
                        )}

                        {cust.email && (
                          <a
                            href={`mailto:${cust.email}`}
                            className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500"
                          >
                            <Mail size={13} className="shrink-0" />
                            <span className="truncate">{cust.email}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `/dashboard/admin/customers/${cust.id}/contract`,
                          "_blank"
                        )
                      }
                      className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors active:bg-slate-50"
                    >
                      <FileText size={14} />
                      Договор
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditCustomer(cust)}
                      className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 text-[11px] font-semibold text-sky-800 shadow-sm transition-colors active:bg-sky-100"
                    >
                      <Edit size={14} />
                      Изменить
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(cust)}
                      className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[#C53030]/15 bg-[#C53030]/5 px-2 text-[11px] font-semibold text-[#C53030] shadow-sm transition-colors active:bg-[#C53030]/10"
                    >
                      <Trash2 size={14} />
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* -------------------------------------------------- */}
      {/* Пагинация */}
      {/* -------------------------------------------------- */}

      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-4 px-2">
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Назад
          </button>

          <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                );
              })
              .reduce((acc: (number | string)[], page, index, arr) => {
                if (
                  index > 0 &&
                  typeof arr[index - 1] === "number" &&
                  page - (arr[index - 1] as number) > 1
                ) {
                  acc.push("...");
                }

                acc.push(page);

                return acc;
              }, [])
              .map((page, idx) => {
                if (page === "...") {
                  return (
                    <span
                      key={`sep-${idx}`}
                      className="px-1 text-slate-400 text-xs"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = page as number;

                return (
                  <button
                    type="button"
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`cursor-pointer h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-xs sm:text-sm font-medium transition-colors shrink-0 ${
                      currentPage === pageNum
                        ? "bg-[#042433] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            disabled={currentPage === totalPages || loading}
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            className="w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Вперед
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* Модалка создания / редактирования */}
      {/* -------------------------------------------------- */}

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
      />

      {/* -------------------------------------------------- */}
      {/* Модалка удаления */}
      {/* -------------------------------------------------- */}

      <DeleteCustomerModal
        isOpen={isDeleteModalOpen}
        customer={deletingCustomer}
        loading={deleteLoading}
        errorMessage={deleteError}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}