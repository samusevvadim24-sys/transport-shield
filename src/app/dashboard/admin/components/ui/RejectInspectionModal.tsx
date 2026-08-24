import React, { useEffect, useState } from "react";
import { AlertTriangle, Wine, Wrench, X, Activity } from "lucide-react";
import { Inspection } from "../../../../../types/database.types";
import { updateInspectionMedical } from "../../../../../services/customer-tab.service";

interface RejectInspectionModalProps {
  isOpen: boolean;
  inspection: Inspection | null;
  rawAlcoholDigits: string;
  rejectReasons: { firstAidKit: boolean; extinguisher: boolean; baldTires: boolean; bodyDamage: boolean; lightsFault: boolean };
  onClose: () => void;
  onAlcoholKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  getFormattedAlcoholNumber: () => number;
  setRejectReasons: React.Dispatch<React.SetStateAction<{ firstAidKit: boolean; extinguisher: boolean; baldTires: boolean; bodyDamage: boolean; lightsFault: boolean }>>;
  onExecute: () => void;
}

export default function RejectInspectionModal({ isOpen, inspection, rawAlcoholDigits, rejectReasons, onClose, onAlcoholKeyDown, getFormattedAlcoholNumber, setRejectReasons, onExecute }: RejectInspectionModalProps) {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [drugIntoxication, setDrugIntoxication] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSystolic(inspection?.bloodPressureSystolic?.toString() ?? "");
    setDiastolic(inspection?.bloodPressureDiastolic?.toString() ?? "");
    setDrugIntoxication(inspection?.drugIntoxication ?? false);
  }, [isOpen, inspection]);

  if (!isOpen || !inspection) return null;

  const systolicNumber = systolic.trim() ? Number(systolic) : null;
  const diastolicNumber = diastolic.trim() ? Number(diastolic) : null;
  const hasPressure = systolicNumber !== null && diastolicNumber !== null && Number.isFinite(systolicNumber) && Number.isFinite(diastolicNumber);
  const pressureOutOfRange = hasPressure && (systolicNumber < 90 || systolicNumber > 140 || diastolicNumber < 60 || diastolicNumber > 90);
  const medicalNotAdmitted = pressureOutOfRange || drugIntoxication || getFormattedAlcoholNumber() !== 0;

  const handleExecute = async () => {
    if (systolicNumber !== null && (!Number.isInteger(systolicNumber) || systolicNumber < 50 || systolicNumber > 300)) { alert("Укажите верхнее давление от 50 до 300 мм рт. ст."); return; }
    if (diastolicNumber !== null && (!Number.isInteger(diastolicNumber) || diastolicNumber < 30 || diastolicNumber > 200)) { alert("Укажите нижнее давление от 30 до 200 мм рт. ст."); return; }
    if (systolicNumber !== null && diastolicNumber !== null && systolicNumber <= diastolicNumber) { alert("Верхнее давление должно быть выше нижнего."); return; }
    setSavingMedical(true);
    try {
      const now = new Date().toISOString();
      const alcoholValue = getFormattedAlcoholNumber();
      const { error } = await updateInspectionMedical(inspection.docId, now, alcoholValue, systolicNumber, diastolicNumber, drugIntoxication);
      if (error) { alert(`Не удалось сохранить медицинские показатели: ${error.message}`); return; }
      onExecute();
    } catch (error) { console.error("Ошибка сохранения медицинских показателей:", error); alert("Не удалось сохранить медицинские показатели."); }
    finally { setSavingMedical(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div className="flex items-center gap-2 text-[#042433]"><AlertTriangle size={20} className="text-amber-500" /><h3 className="text-lg font-bold text-slate-900">Проведение осмотра</h3></div><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
        <div className="my-4 space-y-4">
          <p className="text-xs text-slate-500">Водитель: <strong className="text-slate-800">{inspection.driver}</strong> (авто: {inspection.car.number})</p>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800"><Wine size={15} /><span>Медицинский осмотр</span></div>
            <div className="space-y-3">
              <div><label className="mb-1 block text-xs font-medium text-slate-700">Показания алкотестера (мг/л): <span className="text-[10px] text-slate-400">(вводите цифры с клавиатуры)</span></label><input type="text" readOnly onKeyDown={onAlcoholKeyDown} value={getFormattedAlcoholNumber().toFixed(2)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-mono font-bold text-slate-900 outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" placeholder="0.00" /></div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-700"><Activity size={14} className="text-teal-700" /><span>Артериальное давление (мм рт. ст.)</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="mb-1 block text-[11px] text-slate-500">Верхнее</label><input type="number" inputMode="numeric" min={50} max={300} value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="120" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div>
                  <div><label className="mb-1 block text-[11px] text-slate-500">Нижнее</label><input type="number" inputMode="numeric" min={30} max={200} value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="80" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#042433] focus:ring-1 focus:ring-[#042433]" /></div>
                </div>
                {pressureOutOfRange && <p className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-600">Давление вне допустимого диапазона: 90–140 / 60–90 мм рт. ст.</p>}
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={drugIntoxication} onChange={(e) => setDrugIntoxication(e.target.checked)} className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]" /><span className={drugIntoxication ? "font-semibold text-rose-600" : ""}>Наркотическое опьянение</span></label>
              <p className="mt-1 text-[11px]">{medicalNotAdmitted ? <span className="font-medium text-rose-600">Статус медика: Не допущен</span> : <span className="font-medium text-emerald-600">Статус медика: Допущен</span>}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5"><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800"><Wrench size={15} /><span>Технический осмотр (Замечания)</span></div><div className="grid grid-cols-1 gap-2 text-xs text-slate-700"><label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={rejectReasons.firstAidKit} onChange={(e) => setRejectReasons({ ...rejectReasons, firstAidKit: e.target.checked })} className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]" /><span>Отсутствие аптечки</span></label><label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={rejectReasons.extinguisher} onChange={(e) => setRejectReasons({ ...rejectReasons, extinguisher: e.target.checked })} className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]" /><span>Отсутствие огнетушителя</span></label><label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={rejectReasons.baldTires} onChange={(e) => setRejectReasons({ ...rejectReasons, baldTires: e.target.checked })} className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]" /><span>Лысая резина</span></label><label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={rejectReasons.bodyDamage} onChange={(e) => setRejectReasons({ ...rejectReasons, bodyDamage: e.target.checked })} className="rounded bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors" /><span>Повреждение кузова или салона</span></label><label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-2 border border-slate-200 hover:bg-slate-50 transition-colors"><input type="checkbox" checked={rejectReasons.lightsFault} onChange={(e) => setRejectReasons({ ...rejectReasons, lightsFault: e.target.checked })} className="rounded border-slate-300 text-[#042433] focus:ring-[#042433]" /><span>Неисправность световых приборов</span></label></div></div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={savingMedical} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Отмена</button><button type="button" onClick={handleExecute} disabled={savingMedical} className="cursor-pointer rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031822] disabled:cursor-not-allowed disabled:opacity-60">{savingMedical ? "Сохранение..." : "Сохранить результаты осмотра"}</button></div>
      </div>
    </div>
  );
}