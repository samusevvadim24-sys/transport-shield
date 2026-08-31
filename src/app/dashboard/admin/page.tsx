/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, JSX } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Users, Building2, LogOut, Menu, ChevronLeft, Settings } from "lucide-react";
import { fetchSystemSettings } from "@/services/settings.service";
import { AuthService } from "@/services/auth.service";
import ChecksTab from "./components/ChecksTab";
import CustomersTab from "./components/CustomersTab";
import DriversTab from "./components/DriversTab";
import AdminSettingsTab from "./components/AdminSettingsTab";

type TabType = "checks" | "drivers" | "customers" | "settings";
type NavButtonProps = { onClick: () => void; isActive: boolean; isSidebarOpen: boolean; icon: JSX.Element; label: string };

const tabs: { id: TabType; label: string; shortLabel: string; icon: JSX.Element }[] = [
  { id: "checks", label: "Журнал осмотров", shortLabel: "Журнал", icon: <ClipboardCheck size={19} /> },
  { id: "drivers", label: "Водители", shortLabel: "Водители", icon: <Users size={19} /> },
  { id: "customers", label: "Заказчики", shortLabel: "Заказчики", icon: <Building2 size={19} /> },
  { id: "settings", label: "Настройки", shortLabel: "Настройки", icon: <Settings size={19} /> },
];

const NavButton = ({ onClick, isActive, isSidebarOpen, icon, label }: NavButtonProps) => (
  <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-[#042433] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} title={!isSidebarOpen ? label : ""}>
    <div className="flex w-5 shrink-0 justify-center">{icon}</div>
    <span className={`whitespace-nowrap transition-all ${isSidebarOpen ? "w-[120px] opacity-100" : "w-0 overflow-hidden opacity-0"}`}>{label}</span>
  </button>
);

export default function AdminDashboardPage(): JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("checks");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [inspectionPointAddress, setInspectionPointAddress] = useState("");
  const [inspectionPointName, setInspectionPointName] = useState("");

  useEffect(() => {
    let active = true;
    void AuthService.getServerSession().then((session) => {
      if (!active) return;
      if (!session || session.role !== "admin") {
        router.replace("/login");
        return;
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const loadInspectionPoint = async () => {
      try {
        const settings = await fetchSystemSettings();
        if (cancelled) return;
        setInspectionPointName(settings.inspection_point_name || "");
        setInspectionPointAddress(settings.inspection_point_address || "");
      } catch (error) {
        console.error("Не удалось загрузить пункт осмотра администратора:", error);
        if (!cancelled) { setInspectionPointName(""); setInspectionPointAddress(""); }
      }
    };
    void loadInspectionPoint();
    return () => { cancelled = true; };
  }, [loading]);

  useEffect(() => {
    const handlePointSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; address?: string }>).detail;
      setInspectionPointName(detail?.name || "");
      setInspectionPointAddress(detail?.address || "");
    };
    window.addEventListener("transport-shield:inspection-point-updated", handlePointSettingsUpdated);
    return () => window.removeEventListener("transport-shield:inspection-point-updated", handlePointSettingsUpdated);
  }, []);

  useEffect(() => {
    const titles: Record<TabType, string> = { checks: "Журнал осмотров", drivers: "Водители", customers: "Заказчики", settings: "Настройки" };
    document.title = `${titles[activeTab]} — Транспортный щит`;
  }, [activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customerId = (event as CustomEvent<string>).detail;
      if (customerId) { setSelectedCustomerId(customerId); setActiveTab("drivers"); }
    };
    window.addEventListener("transport-shield:open-customer", handler);
    return () => window.removeEventListener("transport-shield:open-customer", handler);
  }, []);

  useEffect(() => {
    if (activeTab !== "drivers" || !selectedCustomerId) return;
    const timeout = window.setTimeout(() => {
      const input = document.querySelector('input[placeholder="Поиск по ФИО, номеру, авто..."]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, selectedCustomerId);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [activeTab, selectedCustomerId]);

  const selectTab = (tab: TabType) => {
    if (tab === "drivers") setSelectedCustomerId("");
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const logout = async () => {
    await AuthService.logout();
    router.push("/login");
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Проверка доступа...</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 md:flex-row">
      <aside className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white md:flex ${isSidebarOpen ? "w-64" : "w-16"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-3">
          <div className={`${isSidebarOpen ? "flex" : "hidden"} items-center gap-3`}><img src="/logo.png" alt="Транспортный Щит" className="h-8 w-8 rounded-lg object-contain" /><span className="text-sm font-bold">Транспортный Щит</span></div>
          <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100" aria-label={isSidebarOpen ? "Свернуть меню" : "Развернуть меню"}>{isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}</button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {tabs.map((tab) => <NavButton key={tab.id} isSidebarOpen={isSidebarOpen} isActive={activeTab === tab.id} onClick={() => selectTab(tab.id)} icon={tab.icon} label={tab.label} />)}
          {isSidebarOpen && <div className="mt-3 border-t border-slate-100 px-3 pt-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Адрес пункта</div><div className="mt-1 text-xs font-medium leading-5 text-slate-700">{inspectionPointAddress || "Адрес не указан"}</div>{inspectionPointName && <div className="mt-0.5 truncate text-[10px] text-slate-400" title={inspectionPointName}>{inspectionPointName}</div>}</div>}
        </nav>
        <button type="button" onClick={logout} className="m-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"><LogOut size={18} /><span className={isSidebarOpen ? "" : "hidden"}>Выйти</span></button>
      </aside>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:hidden"><div className="flex min-w-0 items-center gap-2.5"><img src="/logo.png" alt="Транспортный Щит" className="h-8 w-8 rounded-lg object-contain" /><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">Транспортный Щит</div><div className="truncate text-[10px] font-medium text-slate-400">{tabs.find((tab) => tab.id === activeTab)?.label}</div></div></div><button type="button" onClick={logout} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Выйти"><LogOut size={18} /></button></header>
      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:px-4 sm:pt-4 md:p-6 md:pb-6"><div className="mx-auto max-w-7xl">{activeTab === "checks" && <ChecksTab />}{activeTab === "drivers" && <DriversTab />}{activeTab === "customers" && <CustomersTab />}{activeTab === "settings" && <AdminSettingsTab />}</div></main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"><div className="mx-auto grid max-w-lg grid-cols-4 gap-1">{tabs.map((tab) => { const isActive = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold transition-all ${isActive ? "bg-[#042433] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{tab.icon}<span className="leading-none">{tab.shortLabel}</span></button>; })}</div></nav>
    </div>
  );
}
