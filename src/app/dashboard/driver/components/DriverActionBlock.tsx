import { CheckCircle2, Clock, MapPin } from "lucide-react";

interface Props { latestCheck:any; inspectionAddress:string; getDisplayStatus:(status?:string,address?:string)=>string; getStatusStyle:(status?:string)=>string; hasExpiredDocs:boolean; timeRemaining:number|null; isSubmitting:boolean; onRequest:()=>void; }

export default function DriverActionBlock({latestCheck,inspectionAddress,getDisplayStatus,getStatusStyle,hasExpiredDocs,timeRemaining,isSubmitting,onRequest}:Props){
  const status=latestCheck?.overall_status;
  const waiting=status==="Ожидание";
  const summoned=status==="Явиться";
  const hasCooldown=timeRemaining!==null&&timeRemaining>0;
  const completed=status==="Допущен"||status==="Не допущен";
  const showResult=completed&&hasCooldown;
  const point=latestCheck?.inspection_points;
  const pointName=String(point?.name||"").trim();
  const pointAddress=String(point?.address||"").trim();
  return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Действия</h3></div>
    {showResult&&<div className={`rounded-lg border px-4 py-3 ${status==="Допущен"?"border-[#2F855A]/20 bg-[#2F855A]/10":"border-[#C53030]/20 bg-[#C53030]/10"}`}>
      <div className="text-sm font-semibold text-slate-800">{status==="Допущен"?"Подтверждение получено":"Осмотр не пройден"}</div>
      {pointName&&<div className="mt-2 flex items-start gap-2 text-xs text-slate-600"><MapPin size={15} className="mt-0.5 shrink-0"/><div><div className="font-medium">{pointName}</div>{pointAddress&&<div className="mt-0.5 text-slate-500">{pointAddress}</div>}</div></div>}
    </div>}
    {waiting?<div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700"><Clock size={18} className="animate-pulse shrink-0"/><span>Ваш запрос обрабатывается. Пожалуйста, ожидайте.</span></div>
      :summoned?<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">{getDisplayStatus(status,inspectionAddress)}</div>
      :hasCooldown?<div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center"><Clock size={18} className="mx-auto text-slate-400"/><span className="mt-1 block text-[10px] text-slate-400">До следующего осмотра</span><b className="text-sm text-slate-800">{Math.floor(timeRemaining/3600000)} ч. {Math.floor((timeRemaining%3600000)/60000)} мин.</b></div>
      :hasExpiredDocs?<div className="rounded-lg border border-[#C53030]/20 bg-[#C53030]/10 px-4 py-3 text-center text-xs font-medium text-[#C53030]">Запрос недоступен: имеются просроченные документы</div>
      :<button type="button" disabled={isSubmitting} onClick={onRequest} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#2F855A] px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-[#276749] disabled:opacity-70">{isSubmitting?<span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"/>:<CheckCircle2 size={20}/>} {isSubmitting?"Отправка...":"Получить подтверждение"}</button>}
  </div>;
}
