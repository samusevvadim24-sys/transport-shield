import { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteCustomerModalProps {
  isOpen: boolean;
  customer: {
    id: number;
    name: string;
    number?: string | null;
  } | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteCustomerModal({
  isOpen,
  customer,
  loading = false,
  errorMessage = null,
  onClose,
  onConfirm,
}: DeleteCustomerModalProps) {
  // Закрытие по Escape (пока идёт удаление — не закрываем)
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

  if (!isOpen || !customer) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            Удаление заказчика
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Содержимое */}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={20} className="text-red-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900">
                Вы действительно хотите удалить заказчика?
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Заказчик{" "}
                <span className="font-semibold text-slate-700">
                  {customer.name}
                </span>
                {customer.number && (
                  <>
                    {" "}
                    №{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {customer.number}
                    </span>
                  </>
                )}{" "}
                будет удалён.
              </p>

              <p className="mt-2 text-xs text-red-600">
                Связанный пользователь также будет удалён. Это действие
                нельзя отменить.
              </p>
            </div>
          </div>

          {/* Ошибка */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={() => {
              // Доп. защита от повторной отправки, если клик
              // произошёл до перерисовки disabled-состояния кнопки
              if (!loading) onConfirm();
            }}
            disabled={loading}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#C53030] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#9B2C2C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
