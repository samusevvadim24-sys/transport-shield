/* eslint-disable prefer-const */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { DatabaseCustomer } from "../../../../../types/database.types";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DatabaseCustomer | null;
  onSave: (
    formData: Partial<DatabaseCustomer>
  ) => Promise<string | void | null | undefined>;
}

/**
 * Переводит дату из БД (YYYY-MM-DD) в формат для UI (ДД.ММ.ГГГГ)
 */
function formatDateForUI(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  const parts = dateStr.split("-");

  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }

  return dateStr;
}

/**
 * Переводит дату из UI (ДД.ММ.ГГГГ) в формат для БД (YYYY-MM-DD).
 * Пустая или неполная строка превращается в null, а не сохраняется
 * как есть — иначе пустая дата уходит в базу как "" и ломает запрос.
 */
function formatDateForDB(dateStr: string | undefined | null): string | null {
  if (!dateStr || dateStr.length !== 10) return null;

  const [day, month, year] = dateStr.split(".");

  if (!day || !month || !year) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Проверяет, что введённая дата (ДД.ММ.ГГГГ) реально существует в
 * календаре — например, "31.02.2024" пройдёт маску ввода, но это
 * не настоящая дата. Возвращает текст ошибки или null, если всё ок.
 */
function validateDateField(label: string, value: string): string | null {
  if (!value) return null; // поле необязательное — пусто это нормально

  if (value.length !== 10) {
    return `Введите полную дату в поле «${label}» в формате ДД.ММ.ГГГГ.`;
  }

  const [dayStr, monthStr, yearStr] = value.split(".");
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!day || !month || !year || month < 1 || month > 12) {
    return `Некорректная дата в поле «${label}».`;
  }

  const date = new Date(year, month - 1, day);

  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isRealDate) {
    return `В поле «${label}» указан несуществующий день.`;
  }

  return null;
}

export default function CustomerModal({
  isOpen,
  onClose,
  customer,
  onSave,
}: CustomerModalProps) {
  const [formData, setFormData] = useState<
    Partial<DatabaseCustomer> & Record<string, any>
  >({});

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (customer) {
      setFormData({
        ...customer,
        contract_date: formatDateForUI(customer.contract_date),
        registration_date: formatDateForUI(customer.registration_date),
      });
    } else {
      setFormData({
        number: "",
        type: "ООО",
        name: "",
        unp: "",
        address: "",
        contract_number: "",
        contract_date: "",
        registration_number: "",
        registration_date: "",
        director_name: "",
        bank_account: "",
        bank_bic: "",
        bank_name: "",
        contact_person: "",
        phone: "",
        email: "",
      });
    }

    setErrorMessage(null);
  }, [customer, isOpen]);

  // Закрытие модалки по Escape (пока идёт сохранение — не закрываем)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    let { name, value } = e.target;

    if (name === "number") {
      // Номер используется как логин/пароль в связанной учётной
      // записи — допускаем только цифры
      value = value.replace(/\D/g, "");
    } else if (name === "unp") {
      value = value.replace(/\D/g, "");
    } else if (name === "phone") {
      value = value.replace(/[^\d+()\-\s]/g, "");
    } else if (name === "contract_date" || name === "registration_date") {
      const digits = value.replace(/\D/g, "").slice(0, 8);

      if (digits.length >= 5) {
        value = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(
          4,
          8
        )}`;
      } else if (digits.length >= 3) {
        value = `${digits.slice(0, 2)}.${digits.slice(2, 4)}`;
      } else {
        value = digits;
      }
    }

    setFormData({
      ...formData,
      [name]: value,
    });

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Защита от повторной отправки, если пользователь успел
    // кликнуть или нажать Enter ещё раз до перерисовки кнопки
    if (loading) return;

    // Проверяем даты до отправки — чтобы не получить невнятную
    // ошибку из базы данных на явно некорректный ввод
    const contractDateError = validateDateField(
      "Дата договора",
      formData.contract_date || ""
    );

    const registrationDateError = validateDateField(
      "Дата свидетельства",
      formData.registration_date || ""
    );

    const dateError = contractDateError || registrationDateError;

    if (dateError) {
      setErrorMessage(dateError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const dataToSave = {
      ...formData,
      contract_date: formatDateForDB(formData.contract_date),
      registration_date: formatDateForDB(formData.registration_date),
    };

    try {
      const saveError = await onSave(dataToSave);

      if (typeof saveError === "string" && saveError.trim() !== "") {
        setErrorMessage(saveError);
        setLoading(false);
        return;
      }

      onClose();
    } catch (error: any) {
      console.error("Ошибка при сохранении:", error);

      setErrorMessage(
        error?.message || "Произошла ошибка при сохранении заказчика."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900">
            {customer ? "Редактировать заказчика" : "Новый заказчик"}
          </h3>

          <button
            onClick={onClose}
            type="button"
            disabled={loading}
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Ошибка */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-500"
              />

              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          {/* Номер / Тип / Название */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Номер *
              </label>

              <input
                required
                name="number"
                placeholder="100"
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.number || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Тип
              </label>

              <select
                name="type"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                value={formData.type || "ООО"}
                onChange={handleChange}
              >
                <option value="ООО">ООО</option>
                <option value="ИП">ИП</option>
                <option value="ЧУП">ЧУП</option>
                <option value="ОАО">ОАО</option>
                <option value="ЗАО">ЗАО</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Название *
              </label>

              <input
                required
                name="name"
                placeholder="МодернТранс"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.name || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* УНП / Адрес */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                УНП
              </label>

              <input
                name="unp"
                placeholder="193123456"
                maxLength={9}
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.unp || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Юридический адрес
              </label>

              <input
                name="address"
                placeholder="г. Минск, ул. ..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.address || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Договор */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                № договора
              </label>

              <input
                name="contract_number"
                placeholder="12/3-а"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.contract_number || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Дата договора
              </label>

              <input
                name="contract_date"
                placeholder="ДД.ММ.ГГГГ"
                maxLength={10}
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.contract_date || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Регистрация */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                № свидетельства о регистрации
              </label>

              <input
                name="registration_number"
                placeholder="193123456"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.registration_number || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Дата свидетельства
              </label>

              <input
                name="registration_date"
                placeholder="ДД.ММ.ГГГГ"
                maxLength={10}
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.registration_date || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Директор */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Полное ФИО директора / представителя (род. падеж)
            </label>

            <input
              name="director_name"
              placeholder="Иванова Ивана Ивановича"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
              type="text"
              value={formData.director_name || ""}
              onChange={handleChange}
            />
          </div>

          {/* Банковские реквизиты */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Расчетный счет (IBAN)
              </label>

              <input
                name="bank_account"
                placeholder="BY38OLMP3015..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.bank_account || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                БИК банка
              </label>

              <input
                name="bank_bic"
                placeholder="OLMPBY2X"
                maxLength={11}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.bank_bic || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Наименование банка
            </label>

            <input
              name="bank_name"
              placeholder='ЗАО «Приорбанк»'
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
              type="text"
              value={formData.bank_name || ""}
              onChange={handleChange}
            />
          </div>

          {/* Контакты */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Контактное лицо
              </label>

              <input
                name="contact_person"
                placeholder="Петров П.П."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.contact_person || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Телефон
              </label>

              <input
                name="phone"
                placeholder="+375 (29) 123-45-67"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                type="text"
                value={formData.phone || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Email
            </label>

            <input
              name="email"
              placeholder="info@company.by"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
              type="email"
              value={formData.email || ""}
              onChange={handleChange}
            />
          </div>

          {/* Кнопки */}
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29] disabled:opacity-50"
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
