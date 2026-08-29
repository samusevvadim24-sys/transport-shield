/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import { DriverDashboardService, DriverData } from "@/services/driver-dashboard.service";
import { fetchSystemSettings } from "@/services/settings.service";
import {
  AlertTriangle, Bell, Building2, CalendarDays, Car, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, FileText, Hash, LogOut, Menu, XCircle,
} from "lucide-react";

interface DocWarning { name: string; date: string; daysLeft: number; expired: boolean; }

const STATUS_STYLES: Record<string, string> = {
  Допущен: "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20",
  Ожидание: "bg-amber-50 text-amber-700 border-amber-200",
  "Не допущен": "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20",
  Отстранен: "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20",
  Явиться: "bg-amber-50 text-amber-800 border-amber-200",
};

const getDisplayStatus = (status?: string, address?: string) => {
  switch (status) {
    case "Допущен": return "Подтверждено";
    case "Не допущен": return "Отклонено";
    case "Явиться":
      return address
        ? `Необходимо явиться на пункт предрейсового осмотра по адресу: ${address}`
        : "Необходимо явиться на пункт предрейсового осмотра по адресу, указанному администратором";
    case "Ожидание": return "Ожидание";
    default: return status || "Ожидание";
  }
};

export default function DriverPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestCheck, setLatestCheck] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [selectedDateChecks, setSelectedDateChecks] = useState<any[]>([]);
  const [monthChecks, setMonthChecks] = useState<Record<string, number>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [summonCheck, setSummonCheck] = useState<any>(null);
  const [inspectionAddress, setInspectionAddress] = useState("");

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const scope = String((driver as any)?.inspection_scope || "both").toLowerCase();
  const hasMedical = scope === "both" || scope === "medical";
  const hasMechanic = scope === "both" || scope === "mechanic";

  const iso = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const str = String(value).trim();
    if (/^\d{2}\.\d{2}\.\d{4}/.test(str)) {
      const [day, month, year] = str.split(/[.\s:]/);
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const date = new Date(str);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const daysLeft = (value: any) => {
    const date = parseDate(value);
    if (!date) return null;
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return Math.ceil((b - a) / 86400000);
  };

  const warnings = (): DocWarning[] => {
    if (!driver) return [];
    const docs = [
      ["Водительское удостоверение", driver.license_expiry],
      ["Медицинская справка", driver.medical_expiry],
      ["Техосмотр", driver.tech_inspection_expiry],
      ["Страховка", driver.insurance_expiry],
    ] as const;
    return docs.flatMap(([name, value]) => {
      const left = daysLeft(value);
      return left !== null && left <= 3 ? [{ name, date: String(value), daysLeft: left, expired: left < 0 }] : [];
    });
  };

  const hasExpiredDocs = () => warnings().some((w) => w.expired);

  const completionTime = (check: any) => {
    if (check.completed_at) return new Date(check.completed_at).getTime();
    const values = [
      hasMedical && check.medical_date ? new Date(check.medical_date).getTime() : 0,
      hasMechanic && check.mechanic_date ? new Date(check.mechanic_date).getTime() : 0,
    ];
    const max = Math.max(...values);
    return max > 0 ? max : new Date(check.requested_at || check.created_at).getTime();
  };

  useEffect(() => {
    const login = AuthService.getSession()?.login;
    if (!login) { setLoadingDriver(false); return; }
    let cancelled = false;
    DriverDashboardService.getDriverByNumber(login)
      .then((data) => { if (!cancelled) setDriver(data || null); })
      .catch((error) => console.error("Ошибка загрузки водителя:", error))
      .finally(() => { if (!cancelled) setLoadingDriver(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const settings = await fetchSystemSettings();
        if (!cancelled) setInspectionAddress(settings.organization_address.trim());
      } catch (error) {
        console.error("Ошибка загрузки настроек организации:", error);
      }
    };
    loadSettings();
    const interval = window.setInterval(loadSettings, 30000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!driver) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      const unsubscribe = await DriverDashboardService.subscribeToChecks(driver.id, (inspections) => {
        if (cancelled) return;
        let latest: any = null;
        let maxTime = 0;
        let activeSummon: any = null;
        const counts: Record<string, number> = {};
        const selected: any[] = [];
        const target = iso(selectedDate);

        inspections.forEach((data: any) => {
          const date = new Date(data.requested_at || data.created_at);
          const key = iso(date);
          counts[key] = (counts[key] || 0) + 1;
          if (key === target) selected.push(data);
          if (date.getTime() > maxTime) { maxTime = date.getTime(); latest = data; }
          if (data.summon === true && !data.summon_acknowledged) activeSummon = data;
        });

        selected.sort((a, b) => new Date(b.requested_at || b.created_at).getTime() - new Date(a.requested_at || a.created_at).getTime());
        setMonthChecks(counts);
        setSelectedDateChecks(selected);
        setLatestCheck(latest);
        setSummonCheck(activeSummon);
      });
      if (cancelled) unsubscribe(); else cleanup = unsubscribe;
    };

    setup().catch((error) => console.error("Ошибка подписки на осмотры:", error));
    return () => { cancelled = true; cleanup?.(); };
  }, [driver, selectedDate]);

  useEffect(() => {
    if (!latestCheck) { setTimeRemaining(0); return; }
    if (latestCheck.overall_status === "Ожидание" || latestCheck.overall_status === "Явиться") { setTimeRemaining(null); return; }
    const update = () => {
      const left = 12 * 60 * 60 * 1000 - (Date.now() - completionTime(latestCheck));
      setTimeRemaining(left > 0 ? left : 0);
    };
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [latestCheck, hasMedical, hasMechanic]);

  const requestInspection = async () => {
    if (!driver || hasExpiredDocs() || timeRemaining !== 0) return;
    setIsSubmitting(true);
    try { await DriverDashboardService.createInspection(driver.id); }
    catch (error) { console.error("Ошибка при отправке запроса:", error); alert("Произошла ошибка при отправке запроса. Пожалуйста, попробуйте снова."); }
    finally { setIsSubmitting(false); }
  };

  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const future = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()) > new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateTime = (v?: string) => v ? new Date(v).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const time = (v?: string) => v ? new Date(v).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const statusDot = (status?: string) => {
    const s = (status || "").toLowerCase().trim();
    if (s === "допущен") return "bg-[#2F855A]";
    if (s === "отстранен" || s === "не допущен") return "bg-[#C53030]";
    if (s === "ожидание" || s === "явиться") return "bg-amber-500";
    return "bg-slate-300";
  };

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const week = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const calendar = () => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth(), count = new Date(y, m + 1, 0).getDate();
    const offset = new Date(y, m, 1).getDay() || 7;
    const cells: React.ReactNode[] = [];
    for (let i = 1; i < offset; i++) cells.push(<div key={`empty-${i}`} className="h-10" />);
    for (let d = 1; d <= count; d++) {
      const date = new Date(y, m, d), selected = sameDay(date, selectedDate), isToday = sameDay(date, today), isFuture = future(date), countForDay = monthChecks[iso(date)] || 0;
      cells.push(<button key={d} type="button" disabled={isFuture} onClick={() => !isFuture && setSelectedDate(date)} className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-lg text-xs font-medium transition ${isFuture ? "cursor-not-allowed text-slate-300 opacity-40" : selected ? "bg-[#042433] text-white shadow-sm" : isToday ? "bg-[#042433]/10 text-[#042433]" : "text-slate-700 hover:bg-slate-100"}`}><span>{d}</span>{!isFuture && countForDay > 0 && <span className={`mt-0.5 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[#2F855A]"}`} />}</button>);
    }
    return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><button type="button" onClick={() => setViewDate(new Date(y, m - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button><span className="text-sm font-medium text-slate-800">{monthNames[m]} {y}</span><button type="button" disabled={y >= today.getFullYear() && m >= today.getMonth()} onClick={() => setViewDate(new Date(y, m + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={16} /></button></div><div className="mb-2 grid grid-cols-7 text-center">{week.map(d => <span key={d} className="text-[11px] font-medium text-slate-400">{d}</span>)}</div><div className="grid grid-cols-7 gap-y-1">{cells}</div></div>;
  };

  const actionBlock = () => {
    const expired = hasExpiredDocs();
    const status = latestCheck?.overall_status;
    const waiting = status === "Ожидание";
    const summoned = status === "Явиться";
    return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Действия</h3>{latestCheck && <span className={`max-w-[80%] rounded-full border px-2.5 py-1 text-right text-xs font-semibold ${STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>{getDisplayStatus(status, inspectionAddress)}</span>}</div>{waiting ? <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700"><Clock size={18} className="animate-pulse" /><span>Ваш запрос обрабатывается. Пожалуйста, ожидайте.</span></div> : summoned ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">{getDisplayStatus(status, inspectionAddress)}</div> : timeRemaining && timeRemaining > 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center"><Clock size={18} className="mx-auto text-slate-400" /><span className="mt-1 block text-[10px] text-slate-400">До следующего осмотра</span><b className="text-sm text-slate-800">{Math.floor(timeRemaining / 3600000)} ч. {Math.floor((timeRemaining % 3600000) / 60000)} мин.</b></div> : expired ? <div className="rounded-lg border border-[#C53030]/20 bg-[#C53030]/10 px-4 py-3 text-center text-xs font-medium text-[#C53030]">Запрос недоступен: имеются просроченные документы</div> : <button type="button" disabled={isSubmitting} onClick={requestInspection} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#042433] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#031d29] disabled:opacity-70">{isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <CheckCircle2 size={16} />}{isSubmitting ? "Отправка..." : "Пройти осмотр"}</button>}</div>;
  };

  const historyItem = (check: any, idx: number) => <div key={check.id || idx} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><span className="text-xs text-slate-500">{dateTime(check.requested_at || check.created_at)}</span><span className={`max-w-[70%] shrink-0 rounded-full border px-2 py-0.5 text-right text-[10px] font-semibold ${STATUS_STYLES[check.overall_status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>{getDisplayStatus(check.overall_status, inspectionAddress)}</span></div><div className={`grid gap-3 text-xs ${hasMedical && hasMechanic ? "grid-cols-2" : "grid-cols-1"}`}>{hasMedical && <div className="flex items-start gap-2"><i className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(check.medical_status)}`} /><div><span className="font-medium text-slate-700">Мед. осмотр</span>{check.medical_date && <span className="ml-2 text-[10px] text-slate-400">{time(check.medical_date)}</span>}</div></div>}{hasMechanic && <div className="flex items-start gap-2"><i className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(check.mechanic_status)}`} /><div><span className="font-medium text-slate-700">Тех. контроль</span>{check.mechanic_date && <span className="ml-2 text-[10px] text-slate-400">{time(check.mechanic_date)}</span>}</div></div>}</div></div>;

  const handleLogout = () => { AuthService.logout(); router.push("/login"); };
  const handleAcknowledgeSummon = async (inspectionId: number) => { try { await DriverDashboardService.acknowledgeSummon(inspectionId); setSummonCheck(null); } catch (error) { console.error("Ошибка подтверждения вызова:", error); } };

  if (loadingDriver) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center text-slate-500"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#042433]" /><p className="text-sm">Загрузка данных водителя...</p></div></div>;
  if (!driver) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><div className="max-w-sm text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#C53030]/10 text-[#C53030]"><XCircle size={32} /></div><h2 className="text-lg font-bold">Водитель не найден</h2><p className="mt-2 text-sm text-slate-500">Запись водителя отсутствует в Supabase.</p><button onClick={handleLogout} className="mt-4 rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white">Вернуться к входу</button></div></div>;

  const docList = [["Водительское удостоверение", driver.license_expiry], ["Медицинская справка", driver.medical_expiry], ["Техосмотр", driver.tech_inspection_expiry], ["Страховка", driver.insurance_expiry]] as const;
  const selectedLabel = selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const currentWarnings = warnings();

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6"><div className="flex items-center gap-3"><button onClick={() => setIsMobileMenuOpen(true)} className="-ml-1 rounded-md p-1 text-slate-600 hover:bg-slate-100 md:hidden"><Menu size={24} /></button><img src="/logo.png" alt="Транспортный Щит" className="h-8 w-8 rounded-lg object-contain" /><div><h1 className="text-sm font-bold tracking-tight">Транспортный Щит</h1><p className="text-[10px] uppercase tracking-wider text-slate-500">Личный кабинет водителя</p></div></div><button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#C53030]/10 hover:text-[#C53030]"><LogOut size={16} /><span className="hidden sm:inline">Выйти</span></button></div></header>
    <main className="relative mx-auto max-w-5xl space-y-5 p-4 md:p-6"><div><h2 className="text-2xl font-bold tracking-tight">{driver.name}</h2><p className="mt-1 text-sm text-slate-500">{driver.customerName} · Таб. № <span className="font-mono font-medium">{driver.driver_id}</span></p></div>
      {summonCheck && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><Bell size={18} className="mt-0.5 shrink-0 text-amber-600" /><div className="flex-1"><p className="text-sm font-semibold text-amber-800">Вас вызывают на пункт предрейсового осмотра</p><p className="mt-0.5 text-xs text-amber-700">{inspectionAddress ? `Необходимо явиться по адресу: ${inspectionAddress}` : "Администратор запросил ваше явление на пункт предрейсового осмотра."}</p><button onClick={() => handleAcknowledgeSummon(summonCheck.id)} className="mt-3 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-300">Понятно</button></div></div>}
      {currentWarnings.length > 0 && <div className="space-y-2">{currentWarnings.map((w, i) => <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${w.expired ? "border-[#C53030]/20 bg-[#C53030]/10" : "border-amber-200 bg-amber-50"}`}>{w.expired ? <XCircle size={18} className="mt-0.5 shrink-0 text-[#C53030]" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />}<div><p className={`text-sm font-semibold ${w.expired ? "text-[#C53030]" : "text-amber-700"}`}>{w.expired ? "Срок действия истёк" : "Заканчивается срок действия документов"}</p><p className={`mt-0.5 text-xs ${w.expired ? "text-[#C53030]" : "text-amber-600"}`}>{w.name} — {w.date}{!w.expired && ` (осталось ${w.daysLeft} ${w.daysLeft === 1 ? "день" : w.daysLeft < 5 ? "дня" : "дней"})`}</p></div></div>)}</div>}
      {isMobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-slate-50 p-4 shadow-xl transition-transform md:relative md:col-span-1 md:w-auto md:translate-x-0 md:overflow-visible md:bg-transparent md:p-0 md:shadow-none ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="mb-4 flex items-center justify-between md:hidden"><h2 className="text-lg font-bold">Информация</h2><button onClick={() => setIsMobileMenuOpen(false)}><XCircle size={24} /></button></div><div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Данные водителя</h3><div className="space-y-3">{[[Building2, "Перевозчик", driver.customerName || "—"], [Car, "Автомобиль", `${driver.car_brand || "Не указана"}${driver.car_number ? ` · ${driver.car_number}` : ""}`], [FileText, "Водительское удостоверение", driver.license_number || "—"], [Hash, "Табельный номер", driver.driver_id || "—"]].map(([Icon, label, value], i) => { const C = Icon as any; return <div key={i}>{i > 0 && <div className="mb-3 h-px bg-slate-100" />}<div className="flex items-start gap-3"><C size={16} className="mt-0.5 shrink-0 text-slate-400" /><div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label as string}</p><p className="text-sm font-semibold text-slate-800">{value as string}</p></div></div></div>; })}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><CalendarDays size={14} className="text-slate-400" /><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Сроки документов</h3></div><div className="space-y-2.5">{docList.map(([label, value], i) => { const left = daysLeft(value); const expired = left !== null && left < 0; const warn = left !== null && left <= 3; return <div key={i} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{label}</span><span className={`shrink-0 font-mono font-semibold ${expired ? "text-[#C53030]" : warn ? "text-amber-600" : "text-slate-700"}`}>{value || "—"}</span></div>; })}</div></div></div></div><div className="space-y-4 md:col-span-2">{calendar()}{sameDay(selectedDate, today) && actionBlock()}<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">История осмотров</h3><span className="text-xs text-slate-400">{selectedLabel}</span></div>{selectedDateChecks.length ? <div className="divide-y divide-slate-200">{selectedDateChecks.map(historyItem)}</div> : <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 py-8 text-center"><Clock size={20} className="text-slate-300" /><p className="text-xs text-slate-400">Нет данных об осмотрах за эту дату</p></div>}</div></div></div>
    </main>
  </div>;
}
