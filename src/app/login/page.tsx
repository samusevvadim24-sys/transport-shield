/* eslint-disable @next/next/no-img-element */
"use client";

import { ArrowRight, BarChart3, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserRound, Clock3, Globe2 } from "lucide-react";
import { useState } from "react";
import { AuthService, getDashboardPath } from "@/services/auth.service";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setErrorMessage("Введите логин и пароль");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const session = await AuthService.login(login, password);
      const dashboardPath = getDashboardPath(session.role);
      if (!dashboardPath) throw new Error("Для пользователя не настроена роль");
      window.location.assign(dashboardPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Произошла ошибка при входе. Попробуйте позже.");
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061d3b] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/taxi-background.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#041a35]/95 via-[#062b55]/80 to-[#04152d]/65" />
      <div className="absolute inset-0 opacity-25" style={{backgroundImage:"radial-gradient(circle at 68% 22%, #8bd5ff 1px, transparent 2px)",backgroundSize:"30px 30px"}} />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1800px] grid-cols-1 items-center gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(440px,520px)] lg:gap-12 lg:px-14 lg:py-10 xl:px-20">
        <section className="flex flex-col justify-center py-5 sm:py-8 lg:min-h-[calc(100vh-80px)] lg:py-12">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/10 shadow-lg backdrop-blur-sm">
              <ShieldCheck size={34} strokeWidth={1.8} className="text-sky-200" />
            </div>
            <div>
              <div className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">Транспортный Щит</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.19em] text-blue-100/80 sm:text-xs">Система предрейсовых осмотров</div>
            </div>
          </div>
          <div className="mt-10 max-w-2xl sm:mt-14 lg:mt-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-200/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-sky-100 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />
              Безопасность начинается с контроля
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-5xl xl:text-6xl">
              Безопасные водители — <span className="text-sky-200">надёжные поездки</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-6 text-blue-100/90 sm:text-base sm:leading-7">
              Контроль состояния водителей, автомобилей и документов. Все предрейсовые проверки — в одной понятной системе.
            </p>
          </div>
          <div className="mt-8 grid max-w-2xl gap-4 sm:mt-10 sm:grid-cols-3 lg:mt-14 lg:grid-cols-1 xl:grid-cols-3">
            <Feature icon={<ShieldCheck size={21}/>} title="Безопасность" description="Здоровье водителей и готовность автомобиля" />
            <Feature icon={<Clock3 size={21}/>} title="Экономия времени" description="Меньше ручной работы, больше порядка" />
            <Feature icon={<BarChart3 size={21}/>} title="Прозрачность" description="Статусы и история осмотров" />
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-white/15 pt-5 text-xs text-blue-100/65 lg:mt-auto lg:pt-7">
            <Globe2 size={16} />
            <span>Единое цифровое пространство для водителей и организаций</span>
          </div>
        </section>

        <section className="flex items-center justify-center py-2 sm:py-4 lg:py-0">
          <div className="w-full max-w-[520px] rounded-[28px] border border-white/70 bg-white px-6 py-8 text-[#102b50] shadow-[0_30px_100px_rgba(0,12,35,0.38)] sm:px-10 sm:py-10 xl:px-12">
            <div className="mb-9 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0b4b91] text-white shadow-md shadow-blue-900/15">
                  <ShieldCheck size={26} />
                </div>
                <div className="text-lg font-bold leading-tight tracking-tight text-[#0b2b53]">Транспортный<br/>Щит</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                <Globe2 size={15}/> RU
              </div>
            </div>
            <div className="mb-7">
              <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#1766b3]">Личный кабинет</p>
              <h2 className="text-3xl font-semibold tracking-[-.035em] text-[#102b50] sm:text-[38px]">Добро пожаловать!</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Войдите в свой аккаунт, чтобы продолжить работу.</p>
            </div>
            {errorMessage && (
              <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="mt-0.5 font-bold">!</span><span>{errorMessage}</span>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login" className="mb-2 block text-sm font-semibold text-[#18385f]">Логин или табельный номер</label>
                <div className="group relative">
                  <UserRound size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-[#1261b2]"/>
                  <input id="login" name="login" autoComplete="username" value={login} onChange={(e)=>setLogin(e.target.value)} placeholder="Введите логин" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2475c5] focus:ring-4 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#18385f]">Пароль</label>
                <div className="group relative">
                  <LockKeyhole size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-[#1261b2]"/>
                  <input id="password" name="password" autoComplete="current-password" type={showPassword?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Введите пароль" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2475c5] focus:ring-4 focus:ring-blue-100" />
                  <button type="button" aria-label={showPassword?"Скрыть пароль":"Показать пароль"} onClick={()=>setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-[#124f91] focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {showPassword?<EyeOff size={19}/>:<Eye size={19}/>}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-slate-600">
                  <input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#145db0] focus:ring-blue-300"/>
                  Запомнить меня
                </label>
                <button type="button" onClick={()=>setErrorMessage("Для восстановления доступа обратитесь к администратору системы.")} className="font-semibold text-[#1264b6] transition hover:text-[#083e79] hover:underline">Забыли пароль?</button>
              </div>
              <button type="submit" disabled={isLoading} className="group mt-2 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#1260b3] to-[#0a4c98] px-5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-900/20 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-65">
                {isLoading ? <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white"/>Выполняется вход…</> : <>Войти в систему <ArrowRight size={18} className="transition group-hover:translate-x-1"/> </>}
              </button>
            </form>
            <div className="my-6 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[.2em] text-slate-400"><span className="h-px flex-1 bg-slate-200"/>Безопасный доступ<span className="h-px flex-1 bg-slate-200"/></div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#145da9]"><KeyRound size={16}/></span>
              <span>Доступ к системе предоставляется только авторизованным пользователям. Если у вас нет учётной записи, обратитесь к администратору.</span>
            </div>
            <p className="mt-7 text-center text-xs text-slate-400">© ООО «Транспортный Щит» · УНП 193992564</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({icon,title,description}:{icon:React.ReactNode;title:string;description:string}) {
  return <div className="flex items-center gap-4">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-sky-200 backdrop-blur-sm">{icon}</div>
    <div><p className="text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-blue-100/70 sm:text-sm">{description}</p></div>
  </div>;
}
