"use client";

import { useState } from "react";
import { Save, Settings2 } from "lucide-react";

const DEFAULTS = {
  minSystolic: 90,
  maxSystolic: 140,
  minDiastolic: 60,
  maxDiastolic: 90,
};

export default function SettingsTab() {
  const [values, setValues] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const updateValue = (key: keyof typeof DEFAULTS, value: string) => {
    const parsed = Number(value);
    setValues((current) => ({ ...current, [key]: Number.isFinite(parsed) ? parsed : 0 }));
    setSaved(false);
  };

  const handleSave = () => {
    // Пока настройки отображаются на уровне админского интерфейса.
    // Подключение к БД будет добавлено вместе с серверным хранилищем настроек.
    setSaved(true);
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Настройки</h1>
        <p className="mt-1 text-sm text-slate-500">Параметры системы и правила проведения осмотров.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Settings2 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Медицинский допуск</h2>
            <p className="text-xs text-slate-500">Допустимый диапазон артериального давления.</p>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["minSystolic", "Систолическое, минимум"],
            ["maxSystolic", "Систолическое, максимум"],
            ["minDiastolic", "Диастолическое, минимум"],
            ["maxDiastolic", "Диастолическое, максимум"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-xs font-medium text-slate-600">{label}</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={values[key]}
                  onChange={(event) => updateValue(key, event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-14 text-sm text-slate-900 outline-none transition focus:border-[#042433] focus:ring-2 focus:ring-[#042433]/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">мм рт. ст.</span>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">Текущие значения: 90–140 / 60–90 мм рт. ст.</p>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042433] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#06364b]"
          >
            <Save size={16} />
            {saved ? "Сохранено" : "Сохранить"}
          </button>
        </div>
      </div>
    </section>
  );
}
