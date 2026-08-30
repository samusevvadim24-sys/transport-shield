import { CalendarDays } from "lucide-react";
import { DriverData } from "@/services/driver-dashboard.service";

interface Props { driver: DriverData; daysLeft: (value: any) => number | null; }

export default function DriverDocuments({ driver, daysLeft }: Props) {
  const docs = [["Водительское удостоверение", driver.license_expiry], ["Медицинская справка", driver.medical_expiry], ["Техосмотр", driver.tech_inspection_expiry], ["Страховка", driver.insurance_expiry]] as const;
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><CalendarDays size={14} className="text-slate-400"/><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Сроки документов</h3></div><div className="space-y-2.5">{docs.map(([label,value],i)=>{const left=daysLeft(value);const expired=left!==null&&left<0;const warn=left!==null&&left<=3;return <div key={i} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{label}</span><span className={`shrink-0 font-mono font-semibold ${expired?"text-[#C53030]":warn?"text-amber-600":"text-slate-700"}`}>{value||"—"}</span></div>})}</div></div>;
}
