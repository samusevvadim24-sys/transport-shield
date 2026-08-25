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
  Activity,
  AlertTriangle,
  Building2,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

interface CheckData extends CustomerInspection {
  dateISO: string;
  time: string;
}

const normalizeString = (value: any): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeStatus = (value: any): string => {
  const status = normalizeString(value).toLowerCase().replace(/\s+/g, "");
  if (status === "допущен") return "Допущен";
  if (["недопущен", "отстранен", "отстранён"].includes(status)) return "Не допущен";
  if (status === "ожидание") return "Ожидание";
  return normalizeString(value);
};

const getFormattedISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const statusTone = (status: string) => {
  if (status === "Допущен") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "Не допущен") return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
};

const statusDot = (status: string) => {
  if (status === "Допущен") return "bg-emerald-500";
  if (status === "Не допущен") return "bg-red-500";
  return "bg-amber-500";
};

export default function CustomerPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    if (!rawUser) {
      router.push("/");
      return;
    }

    let user: any;
    try {
      user = JSON.parse(rawUser);
    } catch {
      router.push("/");
      return;
    }

    if (!user || user.role !== "customer") {
      router.push("/");
      return;
    }

    setCurrentUser(user);

    const load = async () => {
      try {
        const fetchedDrivers = await CustomerDashboardService.getDrivers(user);
        setDrivers(fetchedDrivers);

        const customerId = user.customer_id ?? user.id;
        if (customerId) {
          const { data } = await supabase
            .from("customers")
            .select("balance")
            .eq("id", customerId)
            .maybeSingle();
          if (data) setBalance(Number(data.balance ?? 0));
        }
      } catch (error) {
        console.error("Ошибка загрузки профиля заказчика:", error);
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  useEffect(() => {
    if (!drivers.length) {
      setAllChecks([]);
      setChecksLoading(false);
      return;
    }

    const loadInspections = async () => {
      setChecksLoading(true);
      try {
        const data = await CustomerDashboardService.getInspections(drivers.map((d) => d.id));
        setAllChecks(
          data.map((item) => {
            const date = item.requested_at ? new Date(item.requested_at) : new Date();
            return {
              ...item,
              overall_status: normalizeStatus(item.overall_status),
              medical_status: normalizeStatus(item.medical_status),
              mechanic_status: normalizeStatus(item.mechanic_status),
              dateISO: getFormattedISO(date),
              time: date.toTimeString().slice(0, 5),
            } as CheckData;
          })
        );
      } catch (error) {
        console.error("Ошибка загрузки осмотров:", error);
        setAllChecks([]);
      } finally {
        setChecksLoading(false);
      }
    };

    loadInspections();
    const channel = supabase
      .channel("customer-inspections-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, loadInspections)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [drivers]);

  const selectedISO = getFormattedISO(selectedDate);
  const checks = useMemo(() => allChecks.filter((c) => c.dateISO === selectedISO), [allChecks, selectedISO]);
  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;
  const monthChecks = useMemo(() => allChecks.filter((c) => c.dateISO.startsWith(monthPrefix)), [allChecks, monthPrefix]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => `${d.number} ${d.name} ${d.car_brand} ${d.car_number}`.toLowerCase().includes(q));
  }, [drivers, search]);

  const getChecksForDriver = (id: number) => checks.filter((c) => c.driver_id === id);
  const checkedDriverIds = new Set(checks.map((c) => c.driver_id));
  const monthCheckedDriverIds = new Set(monthChecks.map((c) => c.driver_id));

  const stats = {
    approved: checks.filter((c) => c.overall_status === "Допущен").length,
    rejected: checks.filter((c) => c.overall_status === "Не допущен").length,
    pending: checks.filter((c) => c.overall_status === "Ожидание").length,
    without: Math.max(0, drivers.length - checkedDriverIds.size),
  };

  const monthStats = {
    approved: monthChecks.filter((c) => c.overall_status === "Допущен").length,
    rejected: monthChecks.filter((c) => c.overall_status === "Не допущен").length,
    pending: monthChecks.filter((c) => c.overall_status === "Ожидание").length,
    without: Math.max(0, drivers.length - monthCheckedDriverIds.size),
  };

  const customerName = currentUser?.name || `Заказчик #${currentUser?.customer_id || currentUser?.id || "—"}`;
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(viewDate);
  const formattedDate = selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const changeMonth = (offset: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  const isFuture = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()) > new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const days = Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).filter(
    (day) => !isFuture(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))
  );

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("ts_user_session");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">Загружаем личный кабинет...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#062a3a] text-white shadow-lg">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileMenu(true)} className="rounded-xl p-2 hover:bg-white/10 md:hidden" aria-label="Меню">
              <Menu size={21} />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold sm:text-base">Транспортный Щит</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">Личный кабинет заказчика</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="max-w-[260px] truncate text-sm font-semibold">{customerName}</div>
              <div className="text-xs text-white/50">{currentUser?.login || "Аккаунт заказчика"}</div>
            </div>
            <button onClick={handleLogout} className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white" title="Выйти">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobileMenu && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setMobileMenu(false)}>
          <aside className="h-full w-[300px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between">
              <div className="font-bold">Профиль заказчика</div>
              <button onClick={() => setMobileMenu(false)}><X size={20} /></button>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">Компания</div>
              <div className="mt-1 font-bold">{customerName}</div>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Users size={16} /> {drivers.length} водителей</div>
            </div>
            <button onClick={handleLogout} className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
              <LogOut size={18} /> Выйти
            </button>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#07364a] via-[#062a3a] to-[#041d29] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10">
                <Activity size={14} /> Мониторинг транспорта
              </div>
              <h1 className="max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Добро пожаловать, {customerName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">Контролируйте водителей, прохождения медосмотра и технического осмотра в одном месте.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <Users size={18} className="mb-3 text-white/60" />
                <div className="text-2xl font-bold">{drivers.length}</div>
                <div className="mt-1 text-xs text-white/50">Водителей</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <FileCheck2 size={18} className="mb-3 text-white/60" />
                <div className="text-2xl font-bold">{monthChecks.length}</div>
                <div className="mt-1 text-xs text-white/50">Осмотров за месяц</div>
              </div>
              <div className="col-span-2 rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/10 sm:col-span-1">
                <Wallet size={18} className="mb-3 text-emerald-300" />
                <div className="text-2xl font-bold">{balance === null ? "—" : `${balance.toFixed(2)} BYN`}</div>
                <div className="mt-1 text-xs text-white/50">Баланс</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Допущено</span><CheckCircle2 className="text-emerald-500" size={20} /></div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{stats.approved}</div>
            <div className="mt-1 text-xs text-slate-500">за {formattedDate}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Не допущено</span><XCircle className="text-red-500" size={20} /></div>
            <div className="mt-3 text-3xl font-bold text-red-600">{stats.rejected}</div>
            <div className="mt-1 text-xs text-slate-500">за {formattedDate}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ожидание</span><Clock3 className="text-amber-500" size={20} /></div>
            <div className="mt-3 text-3xl font-bold text-amber-600">{stats.pending}</div>
            <div className="mt-1 text-xs text-slate-500">за {formattedDate}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Без осмотра</span><AlertTriangle className="text-slate-400" size={20} /></div>
            <div className="mt-3 text-3xl font-bold text-slate-700">{stats.without}</div>
            <div className="mt-1 text-xs text-slate-500">из {drivers.length} водителей</div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">Календарь осмотров</div>
              <div className="text-xs text-slate-500">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-1.5 sm:justify-start">
              <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900"><ChevronLeft size={18} /></button>
              <div className="flex max-w-[calc(100vw-130px)] gap-1 overflow-x-auto px-1">
                {days.map((day) => {
                  const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  const selected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  return (
                    <button key={day} onClick={() => setSelectedDate(date)} className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${selected ? "bg-[#062a3a] text-white" : isToday ? "bg-white text-[#062a3a] ring-1 ring-[#062a3a]/20" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => changeMonth(1)} disabled={viewDate.getFullYear() > today.getFullYear() || (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() >= today.getMonth())} className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-30"><ChevronRight size={18} /></button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Водители</h2>
              <p className="mt-1 text-xs text-slate-500">Состояние прохождений на {formattedDate}</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск водителя или автомобиля" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-[#062a3a] focus:bg-white" />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={15} /></button>}
            </div>
          </div>

          {checksLoading && drivers.length > 0 && (
            <div className="flex items-center justify-center gap-2 border-b border-slate-100 py-4 text-sm text-slate-500"><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#062a3a]" /> Обновляем статусы...</div>
          )}

          {filteredDrivers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Users size={24} /></div>
              <div className="mt-4 font-semibold">Водители не найдены</div>
              <p className="mt-1 text-sm text-slate-500">{search ? "Измените поисковый запрос." : "У заказчика пока нет водителей."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDrivers.map((driver) => {
                const driverChecks = getChecksForDriver(driver.id);
                const latest = driverChecks[driverChecks.length - 1];
                return (
                  <div key={driver.id} className="p-5 transition hover:bg-slate-50/70">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#062a3a]/5 text-[#062a3a]"><Car size={22} /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-slate-900">{driver.name || "Без имени"}</h3>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">№ {driver.number || driver.driver_id || "—"}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{driver.car_brand || "Автомобиль не указан"}</span>
                            {driver.car_number && <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono">{driver.car_number}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[560px]">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Медик</div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${statusDot(latest?.medical_status || "Ожидание")}`} />
                            <span className="text-sm font-semibold">{latest?.medical_status || "Нет данных"}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Механик</div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${statusDot(latest?.mechanic_status || "Ожидание")}`} />
                            <span className="text-sm font-semibold">{latest?.mechanic_status || "Нет данных"}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Итог</div>
                          {latest ? <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${statusTone(latest.overall_status)}`}>{latest.overall_status}</span> : <span className="text-sm font-semibold text-slate-400">Нет данных</span>}
                        </div>
                      </div>
                    </div>

                    {driverChecks.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        {driverChecks.map((check) => (
                          <div key={check.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                            <Clock3 size={12} />
                            <span>{check.time || "—"}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(check.overall_status)}`} />
                            <span className="font-semibold text-slate-700">{check.overall_status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold">Сводка за месяц</h2><p className="mt-1 text-xs text-slate-500">Общая картина по выбранному месяцу</p></div>
              <Activity className="text-slate-300" size={22} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-4"><div className="text-2xl font-bold text-emerald-700">{monthStats.approved}</div><div className="mt-1 text-xs text-emerald-700/70">Допущено</div></div>
              <div className="rounded-xl bg-red-50 p-4"><div className="text-2xl font-bold text-red-700">{monthStats.rejected}</div><div className="mt-1 text-xs text-red-700/70">Не допущено</div></div>
              <div className="rounded-xl bg-amber-50 p-4"><div className="text-2xl font-bold text-amber-700">{monthStats.pending}</div><div className="mt-1 text-xs text-amber-700/70">Ожидание</div></div>
              <div className="rounded-xl bg-slate-100 p-4"><div className="text-2xl font-bold text-slate-700">{monthStats.without}</div><div className="mt-1 text-xs text-slate-500">Без осмотра</div></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#062a3a]/5 text-[#062a3a]"><Building2 size={19} /></div><div><h2 className="font-bold">Компания</h2><p className="text-xs text-slate-500">Данные аккаунта</p></div></div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><span className="text-slate-400">Название</span><span className="text-right font-semibold">{customerName}</span></div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><span className="text-slate-400">Логин</span><span className="font-medium">{currentUser?.login || "—"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">Водителей</span><span className="font-semibold">{drivers.length}</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
