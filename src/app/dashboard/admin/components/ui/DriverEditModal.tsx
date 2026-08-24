/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import type { Driver, DriverFormData, CustomerOption } from "@/types/database.types"; // Обновите путь при необходимости

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  customers: CustomerOption[];
  onSave: (data: DriverFormData) => Promise<string | void>;
}

const initialFormData: DriverFormData = {
  name: "",
  car_brand: "",
  car_number: "",
  customer_id: "",
  login: "",
  password: "",
  driver_id: "",
  insurance_expiry: "",
  license_expiry: "",
  license_number: "",
  medical_expiry: "",
  tech_inspection_expiry: "",
};

export default function DriverModal({
  isOpen,
  onClose,
  driver,
  customers,
  onSave,
}: DriverModalProps) {
  const [formData, setFormData] = useState<DriverFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (driver) {
        setFormData({
          name: driver.name || "",
          car_brand: driver.car_brand || "",
          car_number: driver.car_number || "",
          customer_id: driver.customer_id.toString(),
          login: driver.user?.login || "",
          password: "", // Пароль оставляем пустым, если не нужно менять
          driver_id: driver.driver_id || "",
          insurance_expiry: driver.insurance_expiry || "",
          license_expiry: driver.license_expiry || "",
          license_number: driver.license_number || "",
          medical_expiry: driver.medical_expiry || "",
          tech_inspection_expiry: driver.tech_inspection_expiry || "",
        });
      } else {
        setFormData(initialFormData);
      }
      setError(null);
    }
  }, [isOpen, driver]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Базовая валидация (дополнительная есть на сервере)
    if (!formData.name.trim()) {
      setError("Введите ФИО водителя");
      setLoading(false);
      return;
    }
    if (!formData.customer_id) {
      setError("Выберите заказчика");
      setLoading(false);
      return;
    }
    if (!driver && !formData.password) {
      setError("Укажите пароль для нового водителя");
      setLoading(false);
      return;
    }

    const saveError = await onSave(formData);
    
    if (saveError) {
      setError(saveError);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">
            {driver ? "Редактирование водителя" : "Новый водитель"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-100">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                <p>{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">
                  Основная информация
                </h3>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    ФИО <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Табельный номер (driver_id)
                  </label>
                  <input
                    type="text"
                    name="driver_id"
                    value={formData.driver_id}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Заказчик <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                  >
                    <option value="" disabled>Выберите заказчика</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">
                  Учетная запись
                </h3>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Логин <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="login"
                    value={formData.login}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Пароль {!driver && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={driver ? "Оставьте пустым для сохранения" : "Введите пароль"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                  />
                </div>
              </div>

              <div className="col-span-1 space-y-4 md:col-span-2">
                <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mt-2">
                  Транспортное средство
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Марка автомобиля <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="car_brand"
                      value={formData.car_brand}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Гос. номер
                    </label>
                    <input
                      type="text"
                      name="car_number"
                      value={formData.car_number}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 space-y-4 md:col-span-2">
                <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mt-2">
                  Документы
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Номер В/У
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={formData.license_number}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      В/У годно до
                    </label>
                    <input
                      type="date"
                      name="license_expiry"
                      value={formData.license_expiry || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Страховка до
                    </label>
                    <input
                      type="date"
                      name="insurance_expiry"
                      value={formData.insurance_expiry || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Медсправка до
                    </label>
                    <input
                      type="date"
                      name="medical_expiry"
                      value={formData.medical_expiry || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Техосмотр до
                    </label>
                    <input
                      type="date"
                      name="tech_inspection_expiry"
                      value={formData.tech_inspection_expiry || ""}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#042433] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#073850] disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}