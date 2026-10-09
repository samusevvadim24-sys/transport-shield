"use client";

import { ArrowRight, BarChart3, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, Clock3, Globe2, KeyRound } from "lucide-react";
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
    <main className="relative min-h-screen overflow-x-hidden bg-[#06274c] font-sans text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/taxi-background.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#041a35]/45 via-[#062b55]/15 to-transparent" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1920px] grid-cols-1 items-center gap-5 px-3 py-2 sm:px-5 sm:py-2 lg:grid-cols-[minmax(0,1fr)_minmax(420px,540px)] lg:gap-7 lg:px-[2vw] lg:py-0">
        <section className="flex flex-col justify-start self-start pt-2 pb-4 sm:pt-3 lg:min-h-screen lg:pt-5 lg:pb-0">
          <div className="flex items-center gap-6">
            <div className="grid h-[76px] w-[76px] shrink-0 place-items-center text-sky-100">
              <ShieldCheck size={76} strokeWidth={1.65} />
            </div>
            <div>
              <div className="text-3xl font-bold leading-[1.02] tracking-tight sm:text-4xl">Драйв<br />Контроль</div>
              <div className="mt-4 text-[11px] font-medium uppercase leading-[1.5] tracking-[.12em] text-white/90">СИСТЕМА ПРЕДРЕЙСОВЫХ ОСМОТРОВ<br />ВОДИТЕЛЕЙ ТАКСИ</div>
            </div>
          </div>

          <div className="mt-6 max-w-[700px] sm:mt-8 lg:mt-[clamp(1.5rem,3vh,2.5rem)]">
            <h1 className="text-[34px] font-bold leading-[1.25] tracking-[-.025em] sm:text-[38px] lg:text-[40px]">
              Безопасные водители —<br /><span className="text-sky-200">надёжные поездки</span>
            </h1>
            <p className="mt-6 max-w-[500px] text-base leading-[1.45] text-white/95 sm:text-[17px]">
              Контроль состояния водителей, автомобилей<br className="hidden xl:block" /> и документов. Автоматизация медосмотров<br className="hidden xl:block" /> и управление автопарком в единой системе.
            </p>
          </div>

          <div className="mt-6 grid max-w-[560px] gap-4 sm:mt-7">
            <Feature icon={<ShieldCheck size={28} strokeWidth={1.7}/>} title="Забота о безопасности" description="Проверка здоровья и документов" />
            <Feature icon={<Clock3 size={28} strokeWidth={1.7}/>} title="Экономия времени" description="Автоматизация процессов" />
            <Feature icon={<BarChart3 size={28} strokeWidth={1.7}/>} title="Полная прозрачность" description="Отчёты и аналитика в реальном времени" />
          </div>
        </section>

        <section className="flex items-center justify-center py-1 sm:py-2 lg:py-0">
          <div className="w-full max-w-[540px] rounded-[18px] bg-white px-6 py-6 text-[#092d5c] shadow-[0_20px_70px_rgba(0,12,35,0.2)] sm:px-8 sm:py-7 xl:px-10 xl:py-8">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Драйв Контроль" className="h-[68px] w-[68px] shrink-0 object-contain" />
                <div className="text-[25px] font-bold leading-[1.02] tracking-tight text-[#092d5c]">Драйв<br />Контроль</div>
              </div>
              <button type="button" aria-label="Язык интерфейса: русский" className="inline-flex items-center gap-2 rounded-full bg-[#f5f8fc] px-3 py-2 text-sm font-medium text-[#092d5c]">
                <Globe2 size={20} strokeWidth={1.8}/> RU <span className="text-xs">⌄</span>
              </button>
            </div>

            <div className="mb-7">
              <h2 className="text-[29px] font-bold leading-tight tracking-[-.025em] text-[#092d5c] sm:text-[31px]">Добро пожаловать!</h2>
              <p className="mt-3 text-base text-[#5878a7]">Войдите в свой аккаунт, чтобы продолжить</p>
            </div>

            {errorMessage && (
              <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login" className="mb-2 block text-sm font-semibold text-[#092d5c]">Электронная почта или логин</label>
                <div className="relative">
                  <UserRound size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#092d5c]"/>
                  <input id="login" name="login" autoComplete="username" value={login} onChange={(e)=>setLogin(e.target.value)} placeholder="Введите email или логин" className="h-[55px] w-full rounded-[10px] border border-[#d9e4f1] bg-white pl-[52px] pr-4 text-[15px] text-slate-800 outline-none transition placeholder:text-[#7e98bd] focus:border-[#1769c2] focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#092d5c]">Пароль</label>
                <div className="relative">
                  <LockKeyhole size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#092d5c]"/>
                  <input id="password" name="password" autoComplete="current-password" type={showPassword?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Введите пароль" className="h-[55px] w-full rounded-[10px] border border-[#d9e4f1] bg-white pl-[52px] pr-12 text-[15px] text-slate-800 outline-none transition placeholder:text-[#7e98bd] focus:border-[#1769c2] focus:ring-2 focus:ring-blue-100" />
                  <button type="button" aria-label={showPassword?"Скрыть пароль":"Показать пароль"} onClick={()=>setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-[#092d5c] hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {showPassword?<EyeOff size={19}/>:<Eye size={19}/>}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-[13px]">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-[#092d5c]">
                  <input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} className="h-[21px] w-[21px] rounded border-slate-300 accent-[#1261b7] focus:ring-blue-300"/>
                  Запомнить меня
                </label>
                <button type="button" onClick={()=>setErrorMessage("Для восстановления доступа обратитесь к администратору системы.")} className="font-medium text-[#0867c8] hover:underline">Забыли пароль?</button>
              </div>

              <button type="submit" disabled={isLoading} className="group flex h-[54px] w-full items-center justify-center gap-4 rounded-[10px] bg-[#1260bd] px-5 text-sm font-semibold text-white transition hover:bg-[#0c52a5] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-65">
                {isLoading ? <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white"/>Выполняется вход…</> : <>Войти <ArrowRight size={18}/></>}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-4 text-xs font-medium text-[#6a86ae]">
              <span className="h-px flex-1 bg-[#dce6f2]" />
              <span>ИЛИ</span>
              <span className="h-px flex-1 bg-[#dce6f2]" />
            </div>

            <button type="button" onClick={() => setErrorMessage("Вход через SSO пока не настроен. Обратитесь к администратору системы.")} className="mt-4 flex h-[52px] w-full items-center justify-center gap-3 rounded-[9px] bg-[#edf5fe] px-5 text-sm font-semibold text-[#092d5c] transition hover:bg-[#e2effd] focus:outline-none focus:ring-4 focus:ring-blue-100">
              <KeyRound size={20} strokeWidth={1.8} />
              Войти через SSO
            </button>

            <div className="mt-6 flex items-start gap-3 text-xs leading-[1.6] text-[#5c79a4]">
              <ShieldCheck size={29} strokeWidth={1.6} className="shrink-0 text-[#092d5c]"/>
              <span>Только авторизованные пользователи<br />имеют доступ к системе</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({icon,title,description}:{icon:React.ReactNode;title:string;description:string}) {
  return <div className="flex items-center gap-5">
    <div className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[#0870c9]/80 text-white">{icon}</div>
    <div><p className="text-[14px] font-semibold text-white">{title}</p><p className="mt-1 text-[14px] leading-5 text-white/95">{description}</p></div>
  </div>;
}
