/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CustomerDashboardService,
  CustomerDriver,
  CustomerInspection,
} from "@/services/customer-dashboard.service";
import {
  Activity, AlertTriangle, Building2, Car, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, FileCheck2, LogOut, Menu, Search, Users, Wallet, X, XCircle,
} from "lucide-react";

interface CheckData extends CustomerInspection { dateISO: string; time: string; }

const normalizeString = (value: any): string => value == null ? "" : String(value).trim();
const normalizeStatus = (value: any): string => {
  const status = normalizeString(value).toLowerCase().replace(/\s+/g, "");
  if (status === "допущен") return "Допущен";
  if (["недопущен", "отстранен", "отстранён"].includes(status)) return "Не допущен";
  if (status === "ожидание") return "Ожидание";
  return normalizeString(value);
};
const getFormattedISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const statusTone = (status: string) => status === "Допущен" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : status === "Не допущен" ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200";
const statusDot = (status: string) => status === "Допущен" ? "bg-emerald-500" : status === "Не допущен" ? "bg-red-500" : "bg-amber-500";

export default function CustomerPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<{ name: string } | null>(null);
  const [drivers, setDrivers] = useState<CustomerDriver[]>([]);
  const [allChecks, setAllChecks] = useState<CheckData[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checksLoading, setChecksLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    const rawUser = localStorage.getItem("ts_user_session") || localStorage.getItem("currentUser");
    if (!rawUser) { router.push("/"); return; }
    let user: any;
    try { user = JSON.parse(rawUser); } catch { router.push("/"); return; }
    if (!user || user.role !== "customer") { router.push("/"); return; }
    setCurrentUser(user);

    const load = async () => {
      try {
        // Определяем именно customers.id. user.id — это ID записи users и
        // не должен использоваться как ID заказчика.
        let customer: { id: number; name: string; balance: number } | null = null;

        if (user.customer_id) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, name, balance")
            .eq("id", user.customer_id)
            .maybeSingle();
          if (!error && data) customer = data as typeof customer;
        }

        if (!customer && user.id) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, name, balance")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!error && data) customer = data as typeof customer;
        }

        if (customer) {
          setCustomerProfile({ name: normalizeString(customer.name) });
          setBalance(Number(customer.balance ?? 0));
          // Передаём сервису реальный customer_id, даже если сессия его не содержала.
          const customerUser = { ...user, customer_id: customer.id };
          setDrivers(await CustomerDashboardService.getDrivers(customerUser));
        } else {
          console.error("Не найдена запись customers для пользователя", user.id);
          setDrivers(await CustomerDashboardService.getDrivers(user));
        }
      } catch (error) {
        console.error("Ошибка загрузки профиля заказчика:", error);
        setDrivers([]);
      } finally { setLoading(false); }
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!drivers.length) { setAllChecks([]); setChecksLoading(false); return; }
    const loadInspections = async () => {
      setChecksLoading(true);
      try {
        const data = await CustomerDashboardService.getInspections(drivers.map((d) => d.id));
        setAllChecks(data.map((item) => {
          const date = item.requested_at ? new Date(item.requested_at) : new Date();
          return { ...item, overall_status: normalizeStatus(item.overall_status), medical_status: normalizeStatus(item.medical_status), mechanic_status: normalizeStatus(item.mechanic_status), dateISO: getFormattedISO(date), time: date.toTimeString().slice(0,5) } as CheckData;
        }));
      } catch (error) { console.error("Ошибка загрузки осмотров:", error); setAllChecks([]); }
      finally { setChecksLoading(false); }
    };
    loadInspections();
    const channel = supabase.channel("customer-inspections-realtime").on("postgres_changes", { event:"*", schema:"public", table:"inspections" }, loadInspections).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [drivers]);

  const selectedISO = getFormattedISO(selectedDate);
  const checks = useMemo(() => allChecks.filter(c => c.dateISO === selectedISO), [allChecks, selectedISO]);
  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,"0")}`;
  const monthChecks = useMemo(() => allChecks.filter(c => c.dateISO.startsWith(monthPrefix)), [allChecks, monthPrefix]);
  const filteredDrivers = useMemo(() => { const q=search.trim().toLowerCase(); return q ? drivers.filter(d => `${d.number} ${d.name} ${d.car_brand} ${d.car_number}`.toLowerCase().includes(q)) : drivers; }, [drivers, search]);
  const getChecksForDriver = (id:number) => checks.filter(c => c.driver_id === id);
  const checkedDriverIds = new Set(checks.map(c => c.driver_id));
  const monthCheckedDriverIds = new Set(monthChecks.map(c => c.driver_id));
  const stats = { approved:checks.filter(c=>c.overall_status==="Допущен").length, rejected:checks.filter(c=>c.overall_status==="Не допущен").length, pending:checks.filter(c=>c.overall_status==="Ожидание").length, without:Math.max(0,drivers.length-checkedDriverIds.size) };
  const monthStats = { approved:monthChecks.filter(c=>c.overall_status==="Допущен").length, rejected:monthChecks.filter(c=>c.overall_status==="Не допущен").length, pending:monthChecks.filter(c=>c.overall_status==="Ожидание").length, without:Math.max(0,drivers.length-monthCheckedDriverIds.size) };
  const customerName = customerProfile?.name || normalizeString(currentUser?.name) || "Заказчик";
  const monthLabel = new Intl.DateTimeFormat("ru-RU", {month:"long",year:"numeric"}).format(viewDate);
  const formattedDate = selectedDate.toLocaleDateString("ru-RU", {day:"numeric",month:"long",year:"numeric"});
  const changeMonth=(offset:number)=>setViewDate(new Date(viewDate.getFullYear(),viewDate.getMonth()+offset,1));
  const isFuture=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate())>new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const isSameDay=(a:Date,b:Date)=>a.toDateString()===b.toDateString();
  const days=Array.from({length:new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate()},(_,i)=>i+1).filter(day=>!isFuture(new Date(viewDate.getFullYear(),viewDate.getMonth(),day)));
  const handleLogout=()=>{localStorage.removeItem("currentUser");localStorage.removeItem("ts_user_session");router.push("/");};

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><div className="text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"/><p className="text-sm text-white/60">Загружаем личный кабинет...</p></div></div>;

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#062a3a] text-white shadow-lg"><div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button onClick={()=>setMobileMenu(true)} className="rounded-xl p-2 hover:bg-white/10 md:hidden"><Menu size={21}/></button><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/10"><img src="/logo.png" alt="Транспортный Щит" className="h-full w-full object-contain p-1"/></div><div className="min-w-0"><div className="truncate text-sm font-bold sm:text-base">Транспортный Щит</div><div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">Личный кабинет заказчика</div></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="max-w-[260px] truncate text-sm font-semibold">{customerName}</div><div className="text-xs text-white/50">{currentUser?.login || "Аккаунт заказчика"}</div></div><button onClick={handleLogout} className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white" title="Выйти"><LogOut size={18}/></button></div></div></header>
      {mobileMenu && <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={()=>setMobileMenu(false)}><aside className="h-full w-[300px] bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="mb-8 flex items-center justify-between"><div className="font-bold">Профиль заказчика</div><button onClick={()=>setMobileMenu(false)}><X size={20}/></button></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wider text-slate-400">Компания</div><div className="mt-1 font-bold">{customerName}</div><div className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Users size={16}/> {drivers.length} водителей</div></div><button onClick={handleLogout} className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={18}/> Выйти</button></aside></div>}
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#07364a] via-[#062a3a] to-[#041d29] p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10"><Activity size={14}/> Мониторинг транспорта</div><h1 className="max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Добро пожаловать, {customerName}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">Контролируйте водителей, прохождения медосмотра и технического осмотра в одном месте.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><Users size={18} className="mb-3 text-white/60"/><div className="text-2xl font-bold">{drivers.length}</div><div className="mt-1 text-xs text-white/50">Водителей</div></div><div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><FileCheck2 size={18} className="mb-3 text-white/60"/><div className="text-2xl font-bold">{monthChecks.length}</div><div className="mt-1 text-xs text-white/50">Осмотров за месяц</div></div><div className="col-span-2 rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/10 sm:col-span-1"><Wallet size={18} className="mb-3 text-emerald-300"/><div className="text-2xl font-bold">{balance===null?"—":`${balance.toFixed(2)} BYN`}</div><div className="mt-1 text-xs text-white/50">Баланс</div></div></div></div></section>
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Допущено",stats.approved,CheckCircle2,"text-emerald-500"],["Не допущено",stats.rejected,XCircle,"text-red-500"],["Ожидание",stats.pending,Clock3,"text-amber-500"],["Без осмотра",stats.without,AlertTriangle,"text-slate-400"]].map(([label,value,Icon,color])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span><Icon className={String(color)} size={20}/></div><div className="mt-3 text-3xl font-bold text-slate-900">{value as number}</div><div className="mt-1 text-xs text-slate-500">за {formattedDate}</div></div>)}</section>
        <section className="mt-6 grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><button onClick={()=>changeMonth(-1)} className="rounded-xl p-2 hover:bg-slate-100"><ChevronLeft size={18}/></button><div className="text-sm font-bold capitalize">{monthLabel}</div><button onClick={()=>changeMonth(1)} disabled={viewDate.getFullYear()===today.getFullYear()&&viewDate.getMonth()===today.getMonth()} className="rounded-xl p-2 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18}/></button></div><div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><div key={d}>{d}</div>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{Array.from({length:(new Date(viewDate.getFullYear(),viewDate.getMonth(),1).getDay()+6)%7}).map((_,i)=><div key={`empty-${i}`}/>) }{days.map(day=>{const date=new Date(viewDate.getFullYear(),viewDate.getMonth(),day);const selected=isSameDay(date,selectedDate);const count=allChecks.filter(c=>c.dateISO===getFormattedISO(date)).length;return <button key={day} onClick={()=>setSelectedDate(date)} className={`relative h-9 rounded-lg text-xs font-semibold ${selected?'bg-[#0b6078] text-white':'hover:bg-slate-100'}`}>{day}{count>0&&<span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected?'bg-white':'bg-[#0b6078]'}`}/>}</button>})}</div><button onClick={()=>{setSelectedDate(today);setViewDate(new Date(today.getFullYear(),today.getMonth(),1));}} className="mt-4 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Сегодня</button></div>
          <div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Водители</h2><p className="mt-1 text-sm text-slate-500">Результаты осмотров на {formattedDate}</p></div><div className="relative w-full sm:w-[280px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск водителя или авто..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0b6078]"/></div></div>{checksLoading?<div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Загружаем результаты...</div>:<div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filteredDrivers.map(driver=>{const driverChecks=getChecksForDriver(driver.id);const latest=driverChecks[driverChecks.length-1];return <div key={driver.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Car size={14}/> {driver.car_brand||'Автомобиль'} {driver.car_number?`• ${driver.car_number}`:''}</div><div className="mt-2 truncate text-base font-bold">{driver.name||'Без имени'}</div>{driver.number&&<div className="mt-1 text-xs text-slate-400">Табельный № {driver.number}</div>}</div><div className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${latest?statusTone(latest.overall_status):'border-slate-200 bg-slate-50 text-slate-400'}`}>{latest?latest.overall_status:'Нет осмотра'}</div></div>{latest?<div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs"><div className="flex items-center justify-between"><span className="text-slate-500">Медик</span><span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${statusDot(latest.medical_status)}`}/>{latest.medical_status||'—'}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Механик</span><span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${statusDot(latest.mechanic_status)}`}/>{latest.mechanic_status||'—'}</span></div><div className="flex items-center justify-between text-slate-400"><span>Время</span><span>{latest.time}</span></div></div>:<div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">За выбранную дату осмотр не зарегистрирован.</div>}</div>})}</div>}</div></section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Сводка</div><h3 className="mt-1 text-lg font-bold capitalize">{monthLabel}</h3></div><Activity className="text-[#0b6078]" size={22}/></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Допущено",monthStats.approved,"text-emerald-600"],["Не допущено",monthStats.rejected,"text-red-600"],["Ожидание",monthStats.pending,"text-amber-600"],["Без осмотра",monthStats.without,"text-slate-500"]].map(([label,value,color])=><div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><div className={`text-2xl font-bold ${String(color)}`}>{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>)}</div></div><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5"><Building2 size={19} className="text-slate-600"/></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Компания</div><h3 className="mt-1 text-lg font-bold">{customerName}</h3></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Логин</div><div className="mt-1 font-semibold">{currentUser?.login||'—'}</div></div><div className="rounded-2xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Водителей</div><div className="mt-1 font-semibold">{drivers.length}</div></div></div></div></section>
      </main>
    </div>
  );
}
