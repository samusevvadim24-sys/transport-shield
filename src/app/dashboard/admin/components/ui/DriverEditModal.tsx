/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types";
import { getNextDriverNumber } from "@/services/drivers-admin.service";

interface DriverModalProps { isOpen: boolean; onClose: () => void; driver: Driver | null; customers: CustomerOption[]; onSave: (data: DriverFormData) => Promise<string | void>; }

const initialFormData: DriverFormData = { name: "", car_brand: "", car_number: "", customer_id: "", login: "", password: "", driver_id: "", insurance_expiry: "", license_expiry: "", license_number: "", medical_expiry: "", tech_inspection_expiry: "" };

function displayDate(value: string | null | undefined) { if (!value) return ""; const parts = value.split("-"); return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value; }
function isoDate(value: string) { const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return match ? `${match[3]}-${match[2]}-${match[1]}` : value; }

export default function DriverModal({ isOpen, onClose, driver, customers, onSave }: DriverModalProps) {
  const [formData, setFormData] = useState<DriverFormData>(initialFormData);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState(""); const [showCustomers, setShowCustomers] = useState(false); const [numberLoading, setNumberLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (driver) {
      setFormData({ name: driver.name || "", car_brand: driver.car_brand || "", car_number: driver.car_number || "", customer_id: String(driver.customer_id), login: driver.user?.login || "", password: "", driver_id: driver.driver_id || "", insurance_expiry: driver.insurance_expiry || "", license_expiry: driver.license_expiry || "", license_number: driver.license_number || "", medical_expiry: driver.medical_expiry || "", tech_inspection_expiry: driver.tech_inspection_expiry || "" });
      setCustomerQuery(driver.customer?.name || "");
    } else { setFormData(initialFormData); setCustomerQuery(""); }
    setError(null);
  }, [isOpen, driver]);

  const selectedCustomer = useMemo(() => customers.find((c) => String(c.id) === String(formData.customer_id)), [customers, formData.customer_id]);
  const filteredCustomers = useMemo(() => { const q = customerQuery.trim().toLowerCase(); return q ? customers.filter((c) => c.name.toLowerCase().includes(q) || String(c.number ?? "").includes(q)) : customers; }, [customers, customerQuery]);

  if (!isOpen) return null;

  const setField = (name: keyof DriverFormData, value: string) => { setFormData((prev) => ({ ...prev, [name]: value })); if (error) setError(null); };

  const selectCustomer = async (customer: CustomerOption) => {
    setCustomerQuery(customer.name); setShowCustomers(false); setField("customer_id", String(customer.id));
    if (!driver) {
      setNumberLoading(true); setError(null);
      const result = await getNextDriverNumber(customer.id);
      setNumberLoading(false);
      if (result.error || !result.number) { setField("driver_id", ""); setError(result.error?.message || "Не удалось определить номер водителя"); return; }
      setField("driver_id", result.number);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    if (!formData.customer_id) { setError("Выберите заказчика"); setLoading(false); return; }
    if (!formData.name.trim()) { setError("Введите ФИО водителя"); setLoading(false); return; }
    if (!driver && !formData.driver_id) { setError("Не удалось определить номер водителя"); setLoading(false); return; }
    if (!formData.login.trim()) { setError("Укажите логин"); setLoading(false); return; }
    if (!driver && !formData.password?.trim()) { setError("Укажите пароль для нового водителя"); setLoading(false); return; }
    const payload: DriverFormData = { ...formData, license_expiry: formData.license_expiry ? isoDate(formData.license_expiry) : "", medical_expiry: formData.medical_expiry ? isoDate(formData.medical_expiry) : "", tech_inspection_expiry: formData.tech_inspection_expiry ? isoDate(formData.tech_inspection_expiry) : "", insurance_expiry: formData.insurance_expiry ? isoDate(formData.insurance_expiry) : "" };
    const saveError = await onSave(payload); setLoading(false); if (saveError) setError(saveError); else onClose();
  };

  const dateField = (name: keyof DriverFormData, label: string) => (
    <div><label className="mb-1 block text-xs font-medium text-slate-600">{label}</label><input value={displayDate(formData[name] as string)} onChange={(e) => setField(name, e.target.value)} placeholder="ДД.ММ.ГГГГ" maxLength={10} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="text-base font-semibold text-slate-900">{driver ? "Редактирование водителя" : "Новый водитель"}</h3><button type="button" onClick={onClose} disabled={loading} className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button></div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}
          <div className="grid grid-cols-3 gap-2">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Номер</label><div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">{numberLoading ? <span className="text-slate-400">Определение...</span> : <span className={formData.driver_id ? "font-semibold text-slate-800" : "text-slate-400"}>{formData.driver_id || "—"}</span>}</div></div>
            <div className="relative col-span-2"><label className="mb-1 block text-xs font-medium text-slate-600">Фирма (Заказчик) *</label><input required value={customerQuery} onFocus={() => setShowCustomers(true)} onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomers(true); if (selectedCustomer && e.target.value !== selectedCustomer.name) setField("customer_id", ""); }} placeholder="Начните вводить название фирмы..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" />{showCustomers && filteredCustomers.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">{filteredCustomers.map((c) => <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectCustomer(c)} className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"><span>{c.name}</span>{c.number && <span className="ml-2 font-mono text-xs text-slate-400">№{c.number}</span>}</button>)}</div>}</div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-600">ФИО водителя *</label><input required value={formData.name} onChange={(e) => setField("name", e.target.value)} placeholder="Иванов Иван Иванович" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium text-slate-600">Серия и номер В/У</label><input value={formData.license_number} onChange={(e) => setField("license_number", e.target.value.toUpperCase())} placeholder="AB 1234567" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div>{dateField("license_expiry", "В/У (дата окончания)")}</div>
          <div className="grid grid-cols-2 gap-3">{dateField("medical_expiry", "Мед. справка (окончание)")}{dateField("tech_inspection_expiry", "Техосмотр (окончание)")}</div>
          {dateField("insurance_expiry", "Страховка А6 (окончание)")}
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium text-slate-600">Марка автомобиля</label><input value={formData.car_brand} onChange={(e) => setField("car_brand", e.target.value)} placeholder="Volkswagen Polo" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div><div><label className="mb-1 block text-xs font-medium text-slate-600">Гос. номер</label><input value={formData.car_number} onChange={(e) => setField("car_number", e.target.value.toUpperCase())} placeholder="1234AB-7" maxLength={9} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase outline-none transition-all focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /><p className="mt-1 text-[10px] text-slate-400">Формат: 6 символов, дефис и регион (0-8)</p></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-medium text-slate-600">Логин *</label><input required value={formData.login} onChange={(e) => setField("login", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div><div><label className="mb-1 block text-xs font-medium text-slate-600">Пароль {!driver && "*"}</label><input type="password" required={!driver} value={formData.password || ""} onChange={(e) => setField("password", e.target.value)} placeholder={driver ? "Не менять" : "Пароль"} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div></div>
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={loading} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">Отмена</button><button type="submit" disabled={loading || numberLoading} className="cursor-pointer rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29] disabled:opacity-50">{loading ? "Сохранение..." : "Сохранить"}</button></div>
        </form>
      </div>
    </div>
  );
}