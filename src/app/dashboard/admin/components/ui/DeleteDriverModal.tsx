"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import type { Driver } from "@/types/database.types"; // Обновите путь при необходимости

interface DeleteDriverModalProps {
  isOpen: boolean;
  driver: Driver | null;
  loading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDriverModal({
  isOpen,
  driver,
  loading,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteDriverModalProps) {
  if (!isOpen || !driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Удаление водителя
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            Вы уверены, что хотите удалить водителя{" "}
            <strong className="text-slate-900">
              {driver.name || "Без имени"}
            </strong>
            ? 
          </p>
          
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
            <strong>Внимание:</strong> Если у этого водителя есть привязанные истории осмотров, удаление будет отклонено системой до их очистки.
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {loading ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}