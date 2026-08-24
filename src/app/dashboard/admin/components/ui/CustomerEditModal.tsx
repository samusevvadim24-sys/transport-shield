/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { DatabaseCustomer } from "../../../../../types/database.types";
import { checkCustomerNumber } from "../../../../../services/customers-admin.service";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DatabaseCustomer | null;
  onSave: (formData: Partial<DatabaseCustomer>) => Promise<string | void | null | undefined>;
}

function formatDateForUI(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
}

function formatDateForDB(dateStr: string | undefined | null): string | null {
  if (!dateStr || dateStr.length !== 10) return null;
  const [day, month, year] = dateStr.split(".");
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function validateDateField(label: string, value: string): string | null {
  if (!value) return null;
  if (value.length !== 10) return `Введите полную дату в поле «${label}» в формате ДД.ММ.ГГГГ.`;
  const [dayStr, monthStr, yearStr] = value.split(".");
  const day = Number(dayStr), month = Number(monthStr), year = Number(yearStr);
  if (!day || !month || !year || month < 1 || month > 12) return `Некорректная дата в поле «${label}».`;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return `В поле «${label}» указан несуществующий день.`;
  return null;
}

export default function CustomerModal({ isOpen, onClose, customer, onSave }: CustomerModalProps) {
  const [formData, setFormData] = useState<Partial<DatabaseCustomer> & Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [numberCheck, setNumberCheck] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");

  useEffect(() => {
    if (!isOpen) return;
    if (customer) {
      setFormData({ ...customer, contract_date: formatDateForUI(customer.contract_date), registration_date: formatDateForUI(customer.registration_date) });
      setNumberCheck("available");
    } else {
      setFormData({ number: "", type: "ООО", name: "", unp: "", address: "", contract_number: "", contract_date: "", registration_number: "", registration_date: "", director_name: "", bank_account: "", bank_bic: "", bank_name: "", contact_person: "", phone: "", email: "" });
      setNumberCheck("idle");
    }
    setErrorMessage(null);
  }, [customer, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    if (name === "number") {
      value = value.replace(/\D/g, "").slice(0, 6);
      setNumberCheck("idle");
    } else if (name === "unp") {
      value = value.replace(/\D/g, "").slice(0, 9);
    } else if (name === "phone") {
      value = value.replace(/[^\d+()\-\s]/g, "");
    } else if (name === "contract_date" || name === "registration_date") {
      value = formatDateInput(value);
    } else if (name === "bank_account" || name === "bank_bic") {
      value = value.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleNumberBlur = async () => {
    const number = String(formData.number ?? "").trim();
    if (!number) { setNumberCheck("idle"); return; }
    setNumberCheck("checking");
    const result = await checkCustomerNumber(number, customer?.id ?? null);
    if (result.error) {
      setNumberCheck("error");
      setErrorMessage("Не удалось проверить номер заказчика. Попробуйте ещё раз.");
      return;
    }
    setNumberCheck(result.exists ? "taken" : "available");
    if (result.exists) setErrorMessage(`Заказчик с номером ${number} уже существует.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const number = String(formData.number ?? "").trim();
    const name = String(formData.name ?? "").trim();
    if (!number) { setErrorMessage("Номер заказчика обязателен."); return; }
    if (!name) { setErrorMessage("Название заказчика обязательно."); return; }

    const contractDateError = validateDateField("Дата договора", formData.contract_date || "");
    const registrationDateError = validateDateField("Дата свидетельства", formData.registration_date || "");
    const dateError = contractDateError || registrationDateError;
    if (dateError) { setErrorMessage(dateError); return; }

    // Повторная проверка непосредственно перед сохранением защищает от гонки,
    // когда другой пользователь занял номер после blur.
    setNumberCheck("checking");
    const numberResult = await checkCustomerNumber(number, customer?.id ?? null);
    if (numberResult.error) { setNumberCheck("error"); setErrorMessage("Не удалось проверить уникальность номера."); return; }
    if (numberResult.exists) { setNumberCheck("taken"); setErrorMessage(`Заказчик с номером ${number} уже существует.`); return; }
    setNumberCheck("available");

    setLoading(true);
    setErrorMessage(null);
    const dataToSave = { ...formData, number, name, contract_date: formatDateForDB(formData.contract_date), registration_date: formatDateForDB(formData.registration_date) };

    try {
      const saveError = await onSave(dataToSave);
      if (typeof saveError === "string" && saveError.trim()) { setErrorMessage(saveError); setLoading(false); return; }
      onClose();
    } catch (error: any) {
      console.error("Ошибка при сохранении:", error);
      setErrorMessage(error?.message || "Произошла ошибка при сохранении заказчика.");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]";
  const monoClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]";
  const dateField = (name: "contract_date" | "registration_date", label: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input name={name} placeholder="ДД.ММ.ГГГГ" maxLength={10} inputMode="numeric" type="text" value={formData[name] || ""} onChange={handleChange} className={monoClass} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => { if (!loading) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900">{customer ? "Редактировать заказчика" : "Новый заказчик"}</h3>
          <button onClick={onClose} type="button" disabled={loading} className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMessage && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" /><span className="break-words">{errorMessage}</span></div>}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Номер *</label>
              <input required name="number" placeholder="100" inputMode="numeric" type="text" value={formData.number || ""} onChange={handleChange} onBlur={handleNumberBlur} className={`${monoClass} ${numberCheck === "taken" ? "border-red-400 ring-1 ring-red-200" : numberCheck === "available" ? "border-emerald-400 ring-1 ring-emerald-100" : ""}`} />
              <div className="mt-1 min-h-[16px] text-[10px]">
                {numberCheck === "checking" && <span className="flex items-center gap-1 text-slate-400"><Loader2 size={11} className="animate-spin" />Проверяем номер...</span>}
                {numberCheck === "available" && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={11} />Номер свободен</span>}
                {numberCheck === "taken" && <span className="text-red-600">Этот номер уже занят</span>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Тип</label>
              <select name="type" className={inputClass} value={formData.type || "ООО"} onChange={handleChange}><option value="ООО">ООО</option><option value="ИП">ИП</option><option value="ЧУП">ЧУП</option><option value="ОАО">ОАО</option><option value="ЗАО">ЗАО</option></select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Название *</label>
              <input required name="name" placeholder="МодернТранс" type="text" value={formData.name || ""} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">УНП</label><input name="unp" placeholder="193123456" maxLength={9} inputMode="numeric" type="text" value={formData.unp || ""} onChange={handleChange} className={monoClass} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Юридический адрес</label><input name="address" placeholder="г. Минск, ул. ..." type="text" value={formData.address || ""} onChange={handleChange} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">№ договора</label><input name="contract_number" placeholder="12/3-а" type="text" value={formData.contract_number || ""} onChange={handleChange} className={monoClass} /></div>
            {dateField("contract_date", "Дата договора")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">№ свидетельства о регистрации</label><input name="registration_number" placeholder="193123456" type="text" value={formData.registration_number || ""} onChange={handleChange} className={monoClass} /></div>
            {dateField("registration_date", "Дата свидетельства")}
          </div>

          <div><label className="mb-1 block text-xs font-medium text-slate-600">Полное ФИО директора / представителя (род. падеж)</label><input name="director_name" placeholder="Иванова Ивана Ивановича" type="text" value={formData.director_name || ""} onChange={handleChange} className={inputClass} /></div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><label className="mb-1 block text-xs font-medium text-slate-600">Расчетный счет (IBAN)</label><input name="bank_account" placeholder="BY38OLMP3015..." type="text" value={formData.bank_account || ""} onChange={handleChange} className={`${monoClass} uppercase`} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">БИК банка</label><input name="bank_bic" placeholder="OLMPBY2X" maxLength={11} type="text" value={formData.bank_bic || ""} onChange={handleChange} className={`${monoClass} uppercase`} /></div>
          </div>

          <div><label className="mb-1 block text-xs font-medium text-slate-600">Наименование банка</label><input name="bank_name" placeholder="ЗАО «Приорбанк»" type="text" value={formData.bank_name || ""} onChange={handleChange} className={inputClass} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Контактное лицо</label><input name="contact_person" placeholder="Петров П.П." type="text" value={formData.contact_person || ""} onChange={handleChange} className={inputClass} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Телефон</label><input name="phone" placeholder="+375 (29) 123-45-67" type="text" value={formData.phone || ""} onChange={handleChange} className={`${monoClass}`} /></div>
          </div>

          <div><label className="mb-1 block text-xs font-medium text-slate-600">Email</label><input name="email" placeholder="info@company.by" type="email" value={formData.email || ""} onChange={handleChange} className={inputClass} /></div>

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={loading} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">Отмена</button>
            <button type="submit" disabled={loading || numberCheck === "checking" || numberCheck === "taken"} className="cursor-pointer rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Сохранение..." : "Сохранить"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
