import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props { viewDate: Date; selectedDate: Date; today: Date; monthChecks: Record<string,number>; onDateSelect: (date: Date)=>void; onPrev:()=>void; onNext:()=>void; }

export default function DriverCalendar({ viewDate, selectedDate, today, monthChecks, onDateSelect, onPrev, onNext }: Props) {
  const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const future=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate())>new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const months=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const week=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const y=viewDate.getFullYear(),m=viewDate.getMonth(),count=new Date(y,m+1,0).getDate(),offset=new Date(y,m,1).getDay()||7;
  const cells:React.ReactNode[]=[];
  for(let i=1;i<offset;i++) cells.push(<div key={`empty-${i}`} className="h-10"/>);
  for(let d=1;d<=count;d++){const date=new Date(y,m,d),selected=sameDay(date,selectedDate),isToday=sameDay(date,today),isFuture=future(date),countForDay=monthChecks[iso(date)]||0;cells.push(<button key={d} type="button" disabled={isFuture} onClick={()=>!isFuture&&onDateSelect(date)} className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-lg text-xs font-medium transition ${isFuture?"cursor-not-allowed text-slate-300 opacity-40":selected?"bg-[#042433] text-white shadow-sm":isToday?"bg-[#042433]/10 text-[#042433]":"text-slate-700 hover:bg-slate-100"}`}><span>{d}</span>{!isFuture&&countForDay>0&&<span className={`mt-0.5 h-1 w-1 rounded-full ${selected?"bg-white":"bg-[#2F855A]"}`}/></button>)}
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><button type="button" onClick={onPrev} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronLeft size={16}/></button><span className="text-sm font-medium text-slate-800">{months[m]} {y}</span><button type="button" disabled={y>=today.getFullYear()&&m>=today.getMonth()} onClick={onNext} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={16}/></button></div><div className="mb-2 grid grid-cols-7 text-center">{week.map(d=><span key={d} className="text-[11px] font-medium text-slate-400">{d}</span>)}</div><div className="grid grid-cols-7 gap-y-1">{cells}</div></div>;
}
