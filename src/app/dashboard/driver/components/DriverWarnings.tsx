import { AlertTriangle, XCircle } from "lucide-react";
import { DriverData } from "@/services/driver-dashboard.service";

export interface DocWarning { name: string; date: string; daysLeft: number; expired: boolean; }

interface Props { driver: DriverData | null; warnings: DocWarning[]; }

export default function DriverWarnings({ driver, warnings }: Props) {
  if (!driver || warnings.length === 0) return null;
  return <div className="space-y-2">{warnings.map((w,i)=><div key={`${w.name}-${i}`} className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${w.expired?"border-[#C53030]/20 bg-[#C53030]/10":"border-amber-200 bg-amber-50"}`}>{w.expired?<XCircle size={18} className="mt-0.5 shrink-0 text-[#C53030]"/>:<AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500"/>}<div><p className={`text-sm font-semibold ${w.expired?"text-[#C53030]":"text-amber-700"}`}>{w.expired?"Срок действия истёк":"Заканчивается срок действия документов"}</p><p className={`mt-0.5 text-xs ${w.expired?"text-[#C53030]":"text-amber-600"}`}>{w.name} — {w.date}{!w.expired&&` (осталось ${w.daysLeft} ${w.daysLeft===1?"день":w.daysLeft<5?"дня":"дней"})`}</p></div></div>)}</div>;
}
