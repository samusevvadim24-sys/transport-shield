/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CustomerDashboardService, CustomerDriver, CustomerInspection } from "@/services/customer-dashboard.service";
import {
  Building2,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Car,
  FileText,
  Search,
  Inbox,
  Clock,
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
  if (status === "недопущен" || status === "отстранен" || status === "отстранён") return "Не допущен";
  if (status === "ожидание") return "Ожидание";
  return normalizeString(value);
};

const getFormattedISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CustomerPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [drivers, setDrivers] = useState<CustomerDriver[]>([]);
  const [allChecks, setAllChecks] = useState<CheckData[]>([]);
  const [loading, setLoading] = useState(true);
  const [checksLoading, setChecksLoading] = useState(true);

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewDate, setViewDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

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

    async function loadData() {
      try {
        const fetchedDrivers = await CustomerDashboardService.getDrivers(user);
        setDrivers(fetchedDrivers);
      } catch (err) {
        console.error("Ошибка при загрузке водителей:", err);
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  useEffect(() => {
    if (drivers.length === 0) {
      setAllChecks([]);
      setChecksLoading(false);
      return;
    }

    async function loadInspections() {
      setChecksLoading(true);
      try {
        const driverIds = drivers.map((d) => d.id);
        const data = await CustomerDashboardService.getInspections(driverIds);

        const formattedChecks: CheckData[] = data.map((item) => {
          const reqDate = item.requested_at ? new Date(item.requested_at) : new Date();
          return {
            ...item,
            overall_status: normalizeStatus(item.overall_status),
            medical_status: normalizeStatus(item.medical_status),
            mechanic_status: normalizeStatus(item.mechanic_status),
            dateISO: getFormattedISO(reqDate),
            time: reqDate.toTimeString().slice(0, 5),
          };
        });

        setAllChecks(formattedChecks);
      } catch (err) {
        console.error("Ошибка при загрузке осмотров:", err);
        setAllChecks([]);
      } finally {
        setChecksLoading(false);
      }
    }

    loadInspections();

    const channel = supabase
      .channel("customer-inspections-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inspections" },
        () => {
          loadInspections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [drivers]);

  const selectedISO = getFormattedISO(selectedDate);
  const checks = useMemo(() => allChecks.filter((c) => c.dateISO === selectedISO), [allChecks, selectedISO]);

  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;
  const monthChecks = useMemo(() => allChecks.filter((c) => c.dateISO.startsWith(monthPrefix)), [allChecks, monthPrefix]);

  const getChecksForDriver = (driverDbId: number) => {
    return checks.filter((c) => c.driver_id === driverDbId);
  };

  const checkedDrivers = new Set(checks.map((c) => c.driver_id));
  const stats = {
    total: drivers.length,
    approved: checks.filter((c) => c.overall_status === "Допущен").length,
    rejected: checks.filter((c) => c.overall_status === "Не допущен").length,
    pending: checks.filter((c) => c.overall_status === "Ожидание").length,
    noCheck: Math.max(0, drivers.length - checkedDrivers.size),
  };

  const monthCheckedDrivers = new Set(monthChecks.map((c) => c.driver_id));
  const monthStats = {
    approved: monthChecks.filter((c) => c.overall_status === "Допущен").length,
    rejected: monthChecks.filter((c) => c.overall_status === "Не допущен").length,
    pending: monthChecks.filter((c) => c.overall_status === "Ожидание").length,
    noCheck: Math.max(0, drivers.length - monthCheckedDrivers.size),
  };

  const filteredDrivers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return drivers;
    return drivers.filter((d) => `${d.number} ${d.name} ${d.car_brand} ${d.car_number}`.toLowerCase().includes(value));
  }, [drivers, search]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isFutureDate = (date: Date) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return dateStart > todayStart;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(viewDate);
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const selectedMonthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(selectedDate);
  const formattedDate = selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("ts_user_session");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#042433]" />
          <p className="text-sm">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  const customerName = currentUser?.name || `Заказчик #${currentUser?.customer_id || currentUser?.id}`;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <Building2 className="h-6 w-6 text-[#042433]" />
          <div>
            <h1 className="text-sm font-bold">Транспортный Щит</h1>
            <p className="text-[10px] uppercase text-slate-500">Заказчик</p>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <p className="text-sm font-bold text-slate-900">{customerName}</p>
              <p className="mt-1 text-xs text-slate-500">Водителей: {drivers.length}</p>
            </div>
            <div className="h-px bg-slate-200/80" />
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Users size={14} className="shrink-0 text-slate-400" />
              <span className="font-medium text-slate-800">{drivers.length} водителей</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileText size={14} className="shrink-0 text-slate-400" />
              <span className="font-medium text-slate-800">Логин: {currentUser?.login || "—"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{selectedMonthLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#2F855A]/20 bg-[#2F855A]/10 p-2.5 text-center">
                <div className="text-lg font-bold text-[#2F855A]">{monthStats.approved}</div>
                <div className="text-[10px] font-medium uppercase text-[#2F855A]/80">Допущено</div>
              </div>
              <div className="rounded-lg border border-[#C53030]/20 bg-[#C53030]/10 p-2.5 text-center">
                <div className="text-lg font-bold text-[#C53030]">{monthStats.rejected}</div>
                <div className="text-[10px] font-medium uppercase text-[#C53030]/80">Отстранено</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-center">
                <div className="text-lg font-bold text-amber-700">{monthStats.pending}</div>
                <div className="text-[10px] font-medium uppercase text-amber-600">Ожидание</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center">
                <div className="text-lg font-bold text-slate-700">{monthStats.noCheck}</div>
                <div className="text-[10px] font-medium uppercase text-slate-500">Без осмотра</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-[#C53030]/10 hover:text-[#C53030]"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <button onClick={() => setIsMenuOpen(true)} className="p-1.5 text-slate-600">
            <Building2 size={22} />
          </button>
          <Building2 className="h-6 w-6 text-[#042433]" />
          <h1 className="truncate text-sm font-bold">{customerName}</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Статус на {formattedDate}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isSameDay(selectedDate, today) ? "Текущий день" : "История осмотров"}
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по водителю, авто..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none focus:border-[#042433] focus:bg-white"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="hidden w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm md:flex">
              <button onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[160px] text-center text-sm font-semibold text-slate-800">{monthLabelCapitalized}</span>
              <button
                onClick={() => changeMonth(1)}
                disabled={viewDate.getFullYear() >= today.getFullYear() && viewDate.getMonth() >= today.getMonth()}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
              <div className="mx-2 h-6 w-px bg-slate-200" />
              <div className="flex gap-1">
                {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }, (_, index) => index + 1)
                  .filter((day) => !isFutureDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)))
                  .map((day) => {
                    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                    const selected = isSameDay(date, selectedDate);
                    const todayDate = isSameDay(date, today);
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(date)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${
                          selected
                            ? "bg-[#042433] font-semibold text-white"
                            : todayDate
                            ? "bg-[#042433]/10 font-semibold text-[#042433]"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="mt-1 text-xs font-medium uppercase text-slate-500">Всего водителей</div>
              </div>
              <div className="rounded-xl border border-[#2F855A]/20 bg-[#2F855A]/10 p-4 text-center">
                <div className="text-2xl font-bold text-[#2F855A]">{stats.approved}</div>
                <div className="mt-1 text-xs font-medium uppercase text-[#2F855A]/80">Допущено</div>
              </div>
              <div className="rounded-xl border border-[#C53030]/20 bg-[#C53030]/10 p-4 text-center">
                <div className="text-2xl font-bold text-[#C53030]">{stats.rejected}</div>
                <div className="mt-1 text-xs font-medium uppercase text-[#C53030]/80">Отстранено</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{stats.pending + stats.noCheck}</div>
                <div className="mt-1 text-xs font-medium uppercase text-amber-600">Ожидание / Нет данных</div>
              </div>
            </div>

            {checksLoading && drivers.length > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-4 text-sm text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#042433]" />
                Загрузка прохождений...
              </div>
            )}

            {filteredDrivers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Inbox size={22} />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Водители не найдены</p>
                  <p className="text-xs text-slate-500">{search ? "Попробуйте изменить поиск" : "У этого заказчика пока нет привязанных водителей в базе"}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="w-20 px-4 py-4 text-center">ID</th>
                        <th className="px-4 py-4">Водитель</th>
                        <th className="px-4 py-4">Автомобиль</th>
                        <th className="px-4 py-4">Медицинский</th>
                        <th className="px-4 py-4">Технический</th>
                        <th className="w-32 px-4 py-4 text-center">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDrivers.map((driver) => {
                        const driverChecks = getChecksForDriver(driver.id);
                        return (
                          <tr key={driver.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-4 text-center align-top font-mono font-medium text-slate-600">
                              {driver.number || driver.driver_id}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="font-medium text-slate-900">{driver.name}</div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                <Car size={14} className="text-slate-400" />
                                <span>{driver.car_brand || "—"}</span>
                                {driver.car_number && (
                                  <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                    {driver.car_number}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              {driverChecks.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                  {driverChecks.map((check) => (
                                    <div key={check.id} className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${check.medical_status === "Допущен" ? "bg-[#2F855A]" : check.medical_status === "Не допущен" ? "bg-[#C53030]" : "bg-amber-500"}`} />
                                        <span className="text-xs font-medium text-slate-700">{check.medical_status}</span>
                                      </div>
                                      <div className="flex items-center gap-1 pl-4 font-mono text-[11px] text-slate-400">
                                        <Clock size={11} />
                                        {check.time || "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-top">
                              {driverChecks.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                  {driverChecks.map((check) => (
                                    <div key={check.id} className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${check.mechanic_status === "Допущен" ? "bg-[#2F855A]" : check.mechanic_status === "Не допущен" ? "bg-[#C53030]" : "bg-amber-500"}`} />
                                        <span className="text-xs font-medium text-slate-700">{check.mechanic_status}</span>
                                      </div>
                                      <div className="flex items-center gap-1 pl-4 font-mono text-[11px] text-slate-400">
                                        <Clock size={11} />
                                        {check.time || "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center align-top">
                              {driverChecks.length > 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                  {driverChecks.map((check) => (
                                    <div key={check.id} className="flex flex-col items-center gap-1">
                                      <span className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${check.overall_status === "Допущен" ? "border-[#2F855A]/20 bg-[#2F855A]/10 text-[#2F855A]" : check.overall_status === "Не допущен" ? "border-[#C53030]/20 bg-[#C53030]/10 text-[#C53030]" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                                        {check.overall_status}
                                      </span>
                                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                        <Clock size={11} />
                                        {check.time || "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}