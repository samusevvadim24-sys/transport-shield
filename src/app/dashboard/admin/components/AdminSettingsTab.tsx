"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from "lucide-react";
import {
  fetchSystemSettings,
  updateAdminPassword,
  updateSystemSettings,
  SystemSettings,
} from "../../../../services/settings.service";

const EMPTY: SystemSettings = {
  id: 1,
  medic_surname: "",
  mechanic_surname: "",
  medical_exam_price: 0.9,
  mechanic_exam_price: 0.9,
  organization_name: "",
  organization_address: "",
  organization_bank_account: "",
  organization_unp: "",
  organization_phone: "",
  organization_email: "",
  organization_director_name: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#042433]/40 focus:bg-white focus:ring-4 focus:ring-[#042433]/5";

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export default function AdminSettingsTab() {
  const [v, setV] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pmsg, setPmsg] = useState("");

  useEffect(() => {
    fetchSystemSettings()
      .then(setV)
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof SystemSettings, value: string | number) =>
    setV((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    const { id, ...data } = v;
    const { error } = await updateSystemSettings(data);
    setMsg(error ? error.message : "Настройки сохранены");
    setSaving(false);
  };

  const change = async () => {
    setPmsg("");

    if (!pw.current || !pw.next) {
      setPmsg("Заполните текущий и новый пароль");
      return;
    }

    if (pw.next !== pw.repeat) {
      setPmsg("Новые пароли не совпадают");
      return;
    }

    const raw = localStorage.getItem("ts_user_session");
    const session = raw ? JSON.parse(raw) : null;

    if (!session?.id || session.role !== "admin") {
      setPmsg("Сессия администратора не найдена");
      return;
    }

    const { error } = await updateAdminPassword(session.id, pw.current, pw.next);
    setPmsg(error ? error.message : "Пароль успешно изменён");

    if (!error) {
      setPw({ current: "", next: "", repeat: "" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
        Загрузка настроек...
      </div>
    );
  }

  const messageIsSuccess = msg === "Настройки сохранены";
  const passwordIsSuccess = pmsg === "Пароль успешно изменён";

  return (
    <section className="space-y-7 pb-8">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          <ShieldCheck size={15} />
          Администрирование
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Настройки</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Управление доступом, специалистами, стоимостью осмотров и реквизитами организации.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Пароль */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-6">
          <SectionHeader
            icon={<LockKeyhole size={19} />}
            title="Пароль администратора"
            description="Изменение пароля текущей учётной записи администратора."
          />

          <div className="mt-6 space-y-4">
            <Field label="Текущий пароль">
              <input
                className={inputClass}
                type="password"
                placeholder="Введите текущий пароль"
                value={pw.current}
                onChange={(e) => setPw((x) => ({ ...x, current: e.target.value }))}
              />
            </Field>
            <Field label="Новый пароль">
              <input
                className={inputClass}
                type="password"
                placeholder="Введите новый пароль"
                value={pw.next}
                onChange={(e) => setPw((x) => ({ ...x, next: e.target.value }))}
              />
            </Field>
            <Field label="Повторите новый пароль">
              <input
                className={inputClass}
                type="password"
                placeholder="Повторите новый пароль"
                value={pw.repeat}
                onChange={(e) => setPw((x) => ({ ...x, repeat: e.target.value }))}
              />
            </Field>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-h-8 items-center gap-2 text-xs">
                {pmsg && (
                  <>
                    {passwordIsSuccess ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check size={15} />
                      </span>
                    ) : null}
                    <span className={passwordIsSuccess ? "text-emerald-600" : "text-red-500"}>{pmsg}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={change}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#042433] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#06364b]"
              >
                <KeyRound size={16} />
                Изменить пароль
              </button>
            </div>
          </div>
        </section>

        {/* Специалисты */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-6">
          <SectionHeader
            icon={<Stethoscope size={19} />}
            title="Медик и механик"
            description="Фамилии специалистов и стоимость одного прохождения."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Фамилия медика">
              <input className={inputClass} value={v.medic_surname} onChange={(e) => set("medic_surname", e.target.value)} placeholder="Фамилия" />
            </Field>
            <Field label="Фамилия механика">
              <input className={inputClass} value={v.mechanic_surname} onChange={(e) => set("mechanic_surname", e.target.value)} placeholder="Фамилия" />
            </Field>
            <Field label="Стоимость медосмотра, BYN">
              <div className="relative">
                <input className={`${inputClass} pr-14`} type="number" min="0" step="0.01" value={v.medical_exam_price} onChange={(e) => set("medical_exam_price", Number(e.target.value))} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">BYN</span>
              </div>
            </Field>
            <Field label="Стоимость мехосмотра, BYN">
              <div className="relative">
                <input className={`${inputClass} pr-14`} type="number" min="0" step="0.01" value={v.mechanic_exam_price} onChange={(e) => set("mechanic_exam_price", Number(e.target.value))} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">BYN</span>
              </div>
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
            <Wrench size={15} className="shrink-0 text-slate-400" />
            Стоимость автоматически используется при списании за прохождение осмотра.
          </div>
        </section>
      </div>

      {/* Организация */}
      <section className="rounded-2xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <div className="p-5 sm:p-6">
          <SectionHeader
            icon={<Building2 size={19} />}
            title="Данные организации"
            description="Реквизиты, контактные данные и руководитель организации."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Название организации" className="sm:col-span-2 lg:col-span-2">
              <input className={inputClass} value={v.organization_name} onChange={(e) => set("organization_name", e.target.value)} placeholder="Название организации" />
            </Field>
            <Field label="Имя директора">
              <input className={inputClass} value={v.organization_director_name} onChange={(e) => set("organization_director_name", e.target.value)} placeholder="ФИО директора" />
            </Field>
            <Field label="Адрес" className="sm:col-span-2 lg:col-span-3">
              <input className={inputClass} value={v.organization_address} onChange={(e) => set("organization_address", e.target.value)} placeholder="Юридический / фактический адрес" />
            </Field>
            <Field label="Расчётный счёт">
              <input className={inputClass} value={v.organization_bank_account} onChange={(e) => set("organization_bank_account", e.target.value)} placeholder="Расчётный счёт" />
            </Field>
            <Field label="УНП">
              <input className={inputClass} value={v.organization_unp} onChange={(e) => set("organization_unp", e.target.value)} placeholder="УНП" />
            </Field>
            <Field label="Телефон">
              <input className={inputClass} value={v.organization_phone} onChange={(e) => set("organization_phone", e.target.value)} placeholder="Телефон" />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" value={v.organization_email} onChange={(e) => set("organization_email", e.target.value)} placeholder="Email" />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-b-2xl bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-h-8 items-center gap-2 text-sm">
            {msg && (
              <>
                {messageIsSuccess ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check size={15} />
                  </span>
                ) : null}
                <span className={messageIsSuccess ? "text-emerald-600" : "text-red-500"}>{msg}</span>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#042433] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#06364b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>
      </section>
    </section>
  );
}
