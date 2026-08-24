import React from "react";
import { AlertTriangle } from "lucide-react";
import { Inspection } from "../../../../../types/database.types";

interface DeleteInspectionModalProps {
  isOpen: boolean;
  inspection: Inspection | null;
  onClose: () => void;
  onExecute: () => void;
}

export default function DeleteInspectionModal({
  isOpen,
  inspection,
  onClose,
  onExecute,
}: DeleteInspectionModalProps) {
  if (!isOpen || !inspection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="rounded-full bg-rose-50 p-3">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Подтвердите удаление</h3>
        </div>
        
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          Вы уверены, что хотите удалить прохождение осмотра водителя <strong className="text-slate-900">{inspection.driver}</strong> (авто: {inspection.car.number}) от {inspection.date}?
        </p>

        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-xs font-medium text-rose-700">
          ⚠️ Это действие необратимо. Данные будут полностью удалены из базы данных без возможности восстановления.
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={onExecute}
            className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}