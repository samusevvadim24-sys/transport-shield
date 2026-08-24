import React from "react";
import { AlertTriangle, Wine, Wrench, X } from "lucide-react";
import { Inspection } from "../../../../../types/database.types";

interface RejectInspectionModalProps {
  isOpen: boolean;
  inspection: Inspection | null;
  rawAlcoholDigits: string;
  rejectReasons: {
    firstAidKit: boolean;
    extinguisher: boolean;
    baldTires: boolean;
    bodyDamage: boolean;
    lightsFault: boolean;
  };
  onClose: () => void;
  onAlcoholKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  getFormattedAlcoholNumber: () => number;
  setRejectReasons: React.Dispatch<
    React.SetStateAction<{
      firstAidKit: boolean;
      extinguisher: boolean;
      baldTires: boolean;
      bodyDamage: boolean;
      lightsFault: boolean;
    }>
  >;
  onExecute: () => void;
}

export default function RejectInspectionModal({
  isOpen,
  inspection,
  rawAlcoholDigits,
  rejectReasons,
  onClose,
  onAlcoholKeyDown,
  getFormattedAlcoholNumber,
  setRejectReasons,
  onExecute,
}: RejectInspectionModalProps) {
  if (!isOpen || !inspection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-[#042433]">
            <AlertTriangle size={20} className="text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">Проведение осмотра</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="my-4 space-y-4">
          <p className="text-xs text-slate-500">
            Водитель: <strong className="text-slate-800">{inspection.driver}</strong> (авто: {inspection.car.number})
          </p>

          {/* Блок медика */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800 mb-2">
              <Wine size={15} />
              <span>Медицинский осмотр (Алкоголь)</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Показания алкотестора (мг/л): <span className="text-[10px] text-slate-400">(вводите цифры с клавиатуры)</span>
              </label>
              <input
                type="text"
                readOnly
                onKeyDown={onAlcoholKeyDown}
                value={getFormattedAlcoholNumber().toFixed(2)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-mono font-bold text-slate-900 outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]"
                placeholder="0.00"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {getFormattedAlcoholNumber() === 0 ? (
                  <span className="text-emerald-600 font-medium">Статус медика: Допущен (алкоголь 0)</span>
                ) : (
                  <span className="text-rose-600 font-medium">Статус медика: Не допущен (обнаружен алкоголь)</span>
                )}
              </p>
            </div>
          </div>

          {/* Блок механика */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">
              <Wrench size={15} />
              <span>Технический осмотр (Замечания)</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-700">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={rejectReasons.firstAidKit}
                  onChange={(e) => setRejectReasons({ ...rejectReasons, firstAidKit: e.target.checked })}
                  className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]"
                />
                <span>Отсутствие аптечки</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={rejectReasons.extinguisher}
                  onChange={(e) => setRejectReasons({ ...rejectReasons, extinguisher: e.target.checked })}
                  className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]"
                />
                <span>Отсутствие огнетушителя</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={rejectReasons.baldTires}
                  onChange={(e) => setRejectReasons({ ...rejectReasons, baldTires: e.target.checked })}
                  className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]"
                />
                <span>Лысая резина</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={rejectReasons.bodyDamage}
                  onChange={(e) => setRejectReasons({ ...rejectReasons, bodyDamage: e.target.checked })}
                  className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]"
                />
                <span>Повреждение кузова или салона</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={rejectReasons.lightsFault}
                  onChange={(e) => setRejectReasons({ ...rejectReasons, lightsFault: e.target.checked })}
                  className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]"
                />
                <span>Неисправность световых приборов</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onExecute}
            className="cursor-pointer rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031822]"
          >
            Сохранить результаты осмотра
          </button>
        </div>
      </div>
    </div>
  );
}