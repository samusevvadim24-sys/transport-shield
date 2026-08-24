/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, JSX } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Users, Building2, LogOut, Menu, ChevronLeft } from "lucide-react";
import ChecksTab from "./components/ChecksTab";
import CustomersTab from "./components/CustomersTab";
import DriversTab from "./components/DriversTab";

type TabType = "checks" | "drivers" | "customers";

const NavButton = ({ onClick, isActive, isSidebarOpen, icon, label }: { onClick: () => void; isActive: boolean; isSidebarOpen: boolean; icon: JSX.Element; label: string; }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out ${isActive ? "bg-[#042433] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} title={!isSidebarOpen ? label : ""}>
    <div className="flex w-5 shrink-0 justify-center">{icon}</div>
    <span className={`whitespace-nowrap transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-[120px] opacity-100 delay-150" : "w-0 opacity-0 overflow-hidden"}`}>{label}</span>
  </button>
);

export default function AdminDashboardPage(): JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("checks");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawUser = localStorage.getItem("ts_user_session") || localStorage.getItem("currentUser");
    if (!rawUser) { router.push("/"); return; }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const titles: Record<TabType, string> = { checks: "Журнал осмотров", drivers: "Водители", customers: "Заказчики" };
    document.title = `${titles[activeTab]} — Транспортный щит`;
  }, [activeTab]);

  useEffect(() => {
    const handleOpenCustomer = (event: Event) => {
      const customerName = (event as CustomEvent<string>).detail;
      if (!customerName) return;
      setSelectedCustomerId(customerName);
      setActiveTab("customers");
    };
    window.addEventListener("transport-shield:open-customer", handleOpenCustomer);
    return () => window.removeEventListener("transport-shield:open-customer", handleOpenCustomer);
  }, []);

  useEffect(() => {
    if (activeTab !== "customers" || !selectedCustomerId) return;
    const timer = window.setTimeout(() => {
      const input = document.querySelector('input[placeholder="Поиск по номеру, названию, УНП..."]') as HTMLInputElement | null;
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, selectedCustomerId);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activeTab, selectedCustomerId]);

  const handleLogout = () => { localStorage.removeItem("currentUser"); localStorage.removeItem("ts_user_session"); router.push("/"); };
  const handleCustomerClick = (customerName: string) => { if (!customerName) return; setSelectedCustomerId(customerName); setActiveTab("customers"); };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#042433]" /><p className="text-sm">Проверка доступа...</p></div></div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <aside className={`hidden md:flex ${isSidebarOpen ? "w-64" : "w-16"} flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out overflow-hidden shrink-0`}>
        <div className={`flex h-16 items-center border-b border-slate-100 shrink-0 px-3 ${isSidebarOpen ? "justify-between" : "justify-center"}`}>
          <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isSidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"}`}><img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" /><span className="text-sm font-bold whitespace-nowrap">Транспортный Щит</span></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0">{isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}</button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          <NavButton isSidebarOpen={isSidebarOpen} isActive={activeTab === "checks"} onClick={() => setActiveTab("checks")} icon={<ClipboardCheck size={18} />} label="Журнал осмотров" />
          <NavButton isSidebarOpen={isSidebarOpen} isActive={activeTab === "drivers"} onClick={() => { setSelectedCustomerId(""); setActiveTab("drivers"); }} icon={<Users size={18} />} label="Водители" />
          <NavButton isSidebarOpen={isSidebarOpen} isActive={activeTab === "customers"} onClick={() => setActiveTab("customers")} icon={<Building2 size={18} />} label="Заказчики" />
        </nav>
        <div className="border-t border-slate-100 p-2 shrink-0"><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"><div className="flex w-5 justify-center"><LogOut size={18} /></div><span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "w-auto opacity-100 delay-150" : "w-0 opacity-0 overflow-hidden"}`}>Выйти</span></button></div>
      </aside>
      <header className="flex md:hidden h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shrink-0"><span className="text-sm font-bold">Транспортный Щит</span><button onClick={handleLogout} className="text-slate-600"><LogOut size={18} /></button></header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6"><div className="mx-auto max-w-7xl">{activeTab === "checks" && <ChecksTab onCustomerClick={handleCustomerClick} />}{activeTab === "drivers" && <DriversTab />}{activeTab === "customers" && <CustomersTab />}</div></main>
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 px-2 justify-around items-center z-50 shadow-lg"><button onClick={() => setActiveTab("checks")} className={`flex flex-col items-center flex-1 py-1 text-xs font-medium ${activeTab === "checks" ? "text-[#042433]" : "text-slate-400"}`}><ClipboardCheck size={20} className="mb-1" /> Осмотры</button><button onClick={() => { setSelectedCustomerId(""); setActiveTab("drivers"); }} className={`flex flex-col items-center flex-1 py-1 text-xs font-medium ${activeTab === "drivers" ? "text-[#042433]" : "text-slate-400"}`}><Users size={20} className="mb-1" /> Водители</button><button onClick={() => setActiveTab("customers")} className={`flex flex-col items-center flex-1 py-1 text-xs font-medium ${activeTab === "customers" ? "text-[#042433]" : "text-slate-400"}`}><Building2 size={20} className="mb-1" /> Заказчики</button></nav>
    </div>
  );
}