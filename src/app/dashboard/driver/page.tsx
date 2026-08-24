/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import {
  DriverDashboardService,
  DriverData,
} from "@/services/driver-dashboard.service";
import {
  Building2,
  Car,
  FileText,
  Hash,
  AlertTriangle,
  XCircle,
  Bell,
  CalendarDays,
  Clock,
  CheckCircle2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";

interface DocWarning {
  name: string;
  date: string;
  daysLeft: number;
  expired: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  Допущен: "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20",
  Ожидание: "bg-amber-50 text-amber-700 border-amber-200",
  "Не допущен": "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20",
  Отстранен: "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20",
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

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewDate, setViewDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const getFormattedISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseExpiryDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;

    const str = String(value).trim();
    if (/^\d{2}\.\d{2}\.\d{4}/.test(str)) {
      const [day, month, year] = str.split(/[.\s:]/);
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    return null;
  };

  const getDaysLeft = (expiryDateRaw: any): number | null => {
    const expiry = parseExpiryDate(expiryDateRaw);
    if (!expiry) return null;

    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startOfExpiry = new Date(
      expiry.getFullYear(),
      expiry.getMonth(),
      expiry.getDate()
    );

    const diffMs = startOfExpiry.getTime() - startOfToday.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getDocWarnings = (): DocWarning[] => {
    if (!driver) return [];

    const docs = [
      { name: "Водительское удостоверение", date: driver.license_expiry },
      { name: "Медицинская справка", date: driver.medical_expiry },
      { name: "Техосмотр", date: driver.tech_inspection_expiry },
      { name: "Страховка", date: driver.insurance_expiry },
    ];

    const warnings: DocWarning[] = [];

    docs.forEach((item) => {
      const daysLeft = getDaysLeft(item.date);
      if (daysLeft !== null && daysLeft <= 3) {
        warnings.push({
          name: item.name,
          date: String(item.date),
          daysLeft,
          expired: daysLeft < 0,
        });
      }
    });

    return warnings;
  };

  const hasExpiredDocs = (): boolean =>
    getDocWarnings().some((w) => w.expired);

  const getCompletionTime = (check: any) => {
    if (check.completed_at) {
      return new Date(check.completed_at).getTime();
    }
    const times = [
      check.medical_date ? new Date(check.medical_date).getTime() : 0,
      check.mechanic_date ? new Date(check.mechanic_date).getTime() : 0,
    ];
    const maxTime = Math.max(...times);
    return maxTime > 0
      ? maxTime
      : new Date(check.requested_at || check.created_at).getTime();
  };

  // Загрузка данных водителя
  useEffect(() => {
    const session = AuthService.getSession();
    const userLogin = session?.login;

    if (!userLogin) {
      console.warn("Сессия отсутствует или login не найден в AuthService");
      setLoadingDriver(false);
      return;
    }

    console.log("Загрузка водителя для логина:", userLogin);

    DriverDashboardService.getDriverByNumber(userLogin).then((data) => {
      if (data) {
        setDriver(data);
      } else {
        console.error(`Водитель не найден для логина: "${userLogin}". Проверьте поля user_id или driver_id в таблице drivers.`);
      }
      setLoadingDriver(false);
    });
  }, []);

  // Realtime подписка на осмотры
  useEffect(() => {
    if (!driver) return;

    const unsubscribe = DriverDashboardService.subscribeToChecks(
      driver.id,
      (inspections) => {
        let latest: any = null;
        let maxTime = 0;
        const counts: Record<string, number> = {};
        const currentSelectedChecks: any[] = [];
        const targetISO = getFormattedISO(selectedDate);
        let activeSummon: any | null = null;

        inspections.forEach((data) => {
          const reqDate = new Date(data.requested_at || data.created_at);
          const iso = getFormattedISO(reqDate);
          counts[iso] = (counts[iso] || 0) + 1;

          if (iso === targetISO) {
            currentSelectedChecks.push(data);
          }

          const time = reqDate.getTime();
          if (time > maxTime) {
            maxTime = time;
            latest = data;
          }

          // Проверяем вызов, если поле summon добавлено в БД
          if (data.summon === true && !data.summon_acknowledged) {
            activeSummon = data;
          }
        });

        currentSelectedChecks.sort(
          (a, b) =>
            new Date(b.requested_at || b.created_at).getTime() -
            new Date(a.requested_at || a.created_at).getTime()
        );

        setMonthChecks(counts);
        setSelectedDateChecks(currentSelectedChecks);
        setSummonCheck(activeSummon);
        setLatestCheck(latest);
      }
    );

    return () => unsubscribe();
  }, [driver, selectedDate]);

  // Расчет таймера кулдауна
  useEffect(() => {
    if (!latestCheck) {
      setTimeRemaining(0);
      return;
    }

    if (latestCheck.overall_status === "Ожидание") {
      setTimeRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const completionTime = getCompletionTime(latestCheck);
      const now = Date.now();
      const diff = now - completionTime;
      const cooldown = 12 * 60 * 60 * 1000; // 12 часов

      if (diff < cooldown && diff >= 0) {
        setTimeRemaining(cooldown - diff);
      } else {
        setTimeRemaining(0);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 60000);
    return () => clearInterval(interval);
  }, [latestCheck]);

  const handleRequestInspection = async () => {
    if (!driver || hasExpiredDocs() || timeRemaining !== 0) return;

    setIsSubmitting(true);
    try {
      await DriverDashboardService.createInspection(driver.id);
    } catch (error) {
      console.error("Ошибка при отправке запроса:", error);
      alert("Произошла ошибка при отправке запроса. Пожалуйста, попробуйте снова.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const isFutureDate = (d: Date) => {
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startOfTarget = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    );
    return startOfTarget > startOfToday;
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeOnly = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const changeMonth = (offset: number) =>
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1)
    );

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} ч. ${minutes} мин.`;
  };

  const getStatusDotColor = (status?: string) => {
    const normalized = status ? status.toLowerCase().trim() : "";
    if (normalized === "допущен") return "bg-[#2F855A]";
    if (normalized === "отстранен" || normalized === "не допущен")
      return "bg-[#C53030]";
    if (normalized === "ожидание") return "bg-amber-500";
    return "bg-slate-300";
  };

  const handleLogout = () => {
    AuthService.logout();
    router.push("/login");
  };

  const handleAcknowledgeSummon = async (inspectionId: number) => {
    await DriverDashboardService.acknowledgeSummon(inspectionId);
    setSummonCheck(null);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOffset = getFirstDayOffset(year, month);

    const monthNames = [
      "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
      "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];

    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDayOffset; i++) {
      days.push(<div key={`e-${i}`} className="h-10" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const isSelected = isSameDay(currentDate, selectedDate);
      const isToday = isSameDay(currentDate, today);
      const isFuture = isFutureDate(currentDate);
      const iso = getFormattedISO(currentDate);
      const checkCount = monthChecks[iso] || 0;

      days.push(
        <button
          key={day}
          type="button"
          disabled={isFuture}
          onClick={() => !isFuture && setSelectedDate(currentDate)}
          className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-md text-xs font-medium transition-colors ${
            isFuture
              ? "cursor-not-allowed text-slate-300 opacity-40"
              : isSelected
              ? "bg-[#042433] font-semibold text-white shadow-sm"
              : isToday
              ? "bg-[#042433]/10 text-[#042433] font-semibold"
              : "text-slate-700 hover:bg-slate-100 cursor-pointer"
          }`}
        >
          <span>{day}</span>
          {!isFuture && checkCount > 0 && (
            <div className="mt-0.5 flex gap-0.5">
              <div
                className={`h-1 w-1 rounded-full ${
                  isSelected ? "bg-white" : "bg-[#2F855A]"
                }`}
              />
            </div>
          )}
        </button>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-sm font-medium text-slate-800">
            {monthNames[month]} {year}
          </span>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={
              viewDate.getFullYear() >= today.getFullYear() &&
              viewDate.getMonth() >= today.getMonth()
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center">
          {daysOfWeek.map((day) => (
            <span key={day} className="text-[11px] font-medium text-slate-400">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">{days}</div>
      </div>
    );
  };

  const renderActionBlock = () => {
    const expired = hasExpiredDocs();
    const isWaiting =
      latestCheck && latestCheck.overall_status === "Ожидание";

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Действия
          </h3>

          {latestCheck && (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                STATUS_STYLES[latestCheck.overall_status] ||
                "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {latestCheck.overall_status || "Ожидание"}
            </span>
          )}
        </div>

        {isWaiting ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-700">
            <Clock size={18} className="animate-pulse text-amber-500" />
            <span>Ваш запрос обрабатывается. Пожалуйста, ожидайте.</span>
          </div>
        ) : timeRemaining && timeRemaining > 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <Clock size={18} className="text-slate-400" />
            <span className="text-[10px] text-slate-400">
              До следующего осмотра:
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
        ) : expired ? (
          <div className="rounded-lg border border-[#C53030]/20 bg-[#C53030]/10 px-4 py-3 text-center text-xs font-medium text-[#C53030]">
            Запрос недоступен: имеются просроченные документы
          </div>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleRequestInspection}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#042433] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29] active:scale-[0.99] disabled:opacity-70 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{isSubmitting ? "Отправка..." : "Пройти осмотр"}</span>
          </button>
        )}
      </div>
    );
  };

  const renderHistoryItem = (check: any, idx: number) => (
    <div
      key={check.id || idx}
      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {formatDateTime(check.requested_at || check.created_at)}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            STATUS_STYLES[check.overall_status] ||
            "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {check.overall_status || "Ожидание"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2">
          <div
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDotColor(
              check.medical_status
            )}`}
          />
          <div className="flex flex-col">
            <span className="font-medium text-slate-700">Мед. осмотр</span>
            {check.medical_date && (
              <span className="text-[10px] text-slate-400">
                {formatTimeOnly(check.medical_date)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDotColor(
              check.mechanic_status
            )}`}
          />
          <div className="flex flex-col">
            <span className="font-medium text-slate-700">Тех. контроль</span>
            {check.mechanic_date && (
              <span className="text-[10px] text-slate-400">
                {formatTimeOnly(check.mechanic_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loadingDriver) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#042433]" />
          <p className="text-sm">Загрузка данных водителя...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C53030]/10 text-[#C53030]">
            <XCircle size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Водитель не найден</h2>
          <p className="mt-2 text-sm text-slate-500">
            Запись водителя отсутствует в Supabase.
          </p>
          <button
            onClick={() => {
              AuthService.logout();
              router.push("/login");
            }}
            className="mt-4 rounded-lg bg-[#042433] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#031d29] cursor-pointer"
          >
            Вернуться к входу
          </button>
        </div>
      </div>
    );
  }

  const formattedDate = selectedDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isSelectedToday = isSameDay(selectedDate, today);
  const warnings = getDocWarnings();

  const docList = [
    { label: "Водительское удостоверение", value: driver.license_expiry },
    { label: "Медицинская справка", value: driver.medical_expiry },
    { label: "Техосмотр", value: driver.tech_inspection_expiry },
    { label: "Страховка", value: driver.insurance_expiry },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1 -ml-1 text-slate-600 md:hidden hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <Menu size={24} />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Транспортный Щит"
              className="h-8 w-8 rounded-lg object-contain"
            />

            <div>
              <h1 className="text-sm font-bold tracking-tight">
                Транспортный Щит
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Личный кабинет водителя
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-[#C53030]/10 hover:text-[#C53030] cursor-pointer"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 relative">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{driver.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {driver.customerName} · Таб. №{" "}
            <span className="font-mono font-medium">{driver.driver_id}</span>
          </p>
        </div>

        {summonCheck && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <Bell size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Вас вызывают на пункт предрейсового осмотра
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Администратор запросил ваше явление. Пожалуйста, подойдите к
                пункту осмотра.
              </p>
              <button
                onClick={() => handleAcknowledgeSummon(summonCheck.id)}
                className="mt-3 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-300 cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-3">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${
                  w.expired
                    ? "border-[#C53030]/20 bg-[#C53030]/10"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                {w.expired ? (
                  <XCircle size={18} className="mt-0.5 shrink-0 text-[#C53030]" />
                ) : (
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                )}
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      w.expired ? "text-[#C53030]" : "text-amber-700"
                    }`}
                  >
                    {w.expired
                      ? "Срок действия истёк"
                      : "Заканчивается срок действия документов"}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      w.expired ? "text-[#C53030]" : "text-amber-600"
                    }`}
                  >
                    {w.name} — {w.date}
                    {!w.expired &&
                      ` (осталось ${w.daysLeft} ${
                        w.daysLeft === 1
                          ? "день"
                          : w.daysLeft < 5
                          ? "дня"
                          : "дней"
                      })`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            className={`fixed inset-y-0 left-0 z-50 w-72 transform overflow-y-auto bg-slate-50 p-4 shadow-xl transition-transform duration-300 md:relative md:col-span-1 md:w-auto md:translate-x-0 md:overflow-visible md:bg-transparent md:p-0 md:shadow-none ${
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-4 flex items-center justify-between md:hidden">
              <h2 className="text-lg font-bold text-slate-900">Информация</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Данные водителя
                </h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Building2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Перевозчик
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {driver.customerName || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="flex items-start gap-3">
                    <Car size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Автомобиль
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {driver.car_brand || "Не указана"}
                        {driver.car_number && (
                          <span className="ml-2 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                            {driver.car_number}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="flex items-start gap-3">
                    <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Водительское удостоверение
                      </p>
                      <p className="text-sm font-semibold text-slate-800 font-mono">
                        {driver.license_number || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="flex items-start gap-3">
                    <Hash size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Табельный номер
                      </p>
                      <p className="text-sm font-semibold text-slate-800 font-mono">
                        {driver.driver_id || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={14} className="text-slate-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Сроки документов
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {docList.map((item, idx) => {
                    const days = getDaysLeft(item.value);
                    const isWarning = days !== null && days <= 3;
                    const isExpired = days !== null && days < 0;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-500">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-semibold ${
                              isExpired
                                ? "text-[#C53030]"
                                : isWarning
                                ? "text-amber-600"
                                : "text-slate-700"
                            }`}
                          >
                            {item.value || "—"}
                          </span>
                          {days !== null && days <= 3 && (
                            <span
                              className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                                isExpired
                                  ? "bg-[#C53030]/10 text-[#C53030]"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {isExpired ? "истёк" : `${days}д`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:col-span-2">
            {/* Отрисовка календаря (находится сверху согласно дизайну) */}
            {renderCalendar()}

            {/* Блок действий с кнопкой (находится прямо под календарем) */}
            {isSelectedToday && renderActionBlock()}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                История осмотров — {formattedDate}
              </h3>

              {selectedDateChecks.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {selectedDateChecks.map((check, idx) =>
                    renderHistoryItem(check, idx)
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 py-8 text-center">
                  <Clock size={20} className="text-slate-300" />
                  <p className="text-xs text-slate-400">
                    Нет данных об осмотрах за эту дату
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}