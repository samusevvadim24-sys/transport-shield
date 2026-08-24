/* eslint-disable @next/next/no-img-element */
"use client";

import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      setErrorMessage("Введите логин и пароль");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const session = await AuthService.login(login, password);

      switch (session.role) {
        case "driver":
          router.push("/dashboard/driver");
          break;
        case "admin":
          router.push("/dashboard/admin");
          break;
        case "customer":
          router.push("/dashboard/customer");
          break;
        default:
          router.push("/");
          break;
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Произошла ошибка при входе. Попробуйте позже.");
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center">
            <img
              src="/logo.png"
              alt="Логотип"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold leading-tight text-[#042433]">
            Цифровая система
          </h1>
          <p className="mt-1 text-xl font-medium tracking-wide text-[#042433]/80">
            предрейсового контроля
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl bg-[#9B2C2C]/10 p-3 text-center text-sm font-medium text-[#9B2C2C] border border-[#9B2C2C]/20">
            {errorMessage}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="relative">
            <User size={20} className="absolute left-4 top-3.5 text-gray-400" />
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Логин или табельный номер"
              className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-4 text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#042433] focus:ring-[#042433]/20"
            />
          </div>

          <div className="relative">
            <Lock size={20} className="absolute left-4 top-3.5 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-12 text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#042433] focus:ring-[#042433]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3.5 text-gray-400 transition hover:text-[#042433] cursor-pointer"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#042433] py-3 font-semibold text-white transition hover:bg-[#0d5c7c] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Войти в систему"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
  <p>© ООО &quot;Транспортный щит&quot; УНП: 193992564</p>
</div>
      </div>
    </main>
  );
}