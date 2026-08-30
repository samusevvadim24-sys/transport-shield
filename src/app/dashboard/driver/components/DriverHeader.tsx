"use client";

import { LogOut, Menu } from "lucide-react";

interface Props {
  onMenuOpen: () => void;
  onLogout: () => void;
}

export default function DriverHeader({ onMenuOpen, onLogout }: Props) {
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6"><div className="flex items-center gap-3"><button onClick={onMenuOpen} className="-ml-1 rounded-md p-1 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Открыть меню"><Menu size={24}/></button><img src="/logo.png" alt="Транспортный Щит" className="h-8 w-8 rounded-lg object-contain"/><div><h1 className="text-sm font-bold tracking-tight">Транспортный Щит</h1><p className="text-[10px] uppercase tracking-wider text-slate-500">Личный кабинет водителя</p></div></div><button onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#C53030]/10 hover:text-[#C53030]"><LogOut size={16}/><span className="hidden sm:inline">Выйти</span></button></div></header>;
}
