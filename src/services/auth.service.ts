import { supabase } from '@/lib/supabase';
import { User, UserSession } from '@/types/database.types';

export const SESSION_KEY = 'ts_user_session';
export const LEGACY_SESSION_KEY = 'currentUser';
export const AUTH_CHANGE_EVENT = 'ts-auth-change';

const getDashboardPath = (role: UserSession['role'] | string | undefined) => {
  switch (role) {
    case 'admin': return '/dashboard/admin';
    case 'customer': return '/dashboard/customer';
    case 'driver': return '/dashboard/driver';
    default: return null;
  }
};

export { getDashboardPath };

const emitAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
};

/**
 * Хеширует пароль на сервере.
 * Пароль никогда не хешируется bcrypt в браузере перед сохранением.
 */
export async function hashPassword(password: string): Promise<string> {
  const cleanPassword = String(password ?? '');
  if (!cleanPassword.trim()) throw new Error('Пароль не может быть пустым');

  const response = await fetch('/api/auth/hash-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: cleanPassword }),
  });

  let payload: { hashedPassword?: string; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error('Не удалось получить ответ сервера');
  }

  if (!response.ok || !payload.hashedPassword) {
    throw new Error(payload.error || 'Не удалось хешировать пароль');
  }

  return payload.hashedPassword;
}

export const AuthService = {
  /**
   * Авторизация выполняется на сервере: bcrypt-хеш не возвращается браузеру.
   * Старые plaintext-пароли поддерживаются только для миграции: после
   * успешного входа сервер заменяет их на bcrypt-хеш.
   */
  async login(loginStr: string, passwordStr: string): Promise<UserSession> {
    const cleanLogin = loginStr.trim();
    const cleanPassword = passwordStr.trim();

    if (!cleanLogin || !cleanPassword) {
      throw new Error('Логин и пароль обязательны');
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: cleanLogin, password: cleanPassword }),
    });

    let payload: { session?: UserSession; error?: string } = {};
    try {
      payload = await response.json();
    } catch {
      throw new Error('Не удалось получить ответ сервера');
    }

    if (!response.ok || !payload.session) {
      throw new Error(payload.error || 'Не удалось выполнить вход');
    }

    const role = payload.session.role as User['role'];
    if (!getDashboardPath(role)) throw new Error('Для пользователя не настроена роль');

    const session: UserSession = {
      id: payload.session.id,
      login: payload.session.login,
      role,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(LEGACY_SESSION_KEY);
      emitAuthChange();
    }

    return session;
  },

  getSession(): UserSession | null {
    if (typeof window === 'undefined') return null;

    const data = localStorage.getItem(SESSION_KEY);
    if (data) {
      try {
        const session = JSON.parse(data) as UserSession;
        if (session?.id && session?.login && getDashboardPath(session.role)) {
          return session;
        }
      } catch {
        // Повреждённая canonical-сессия будет удалена ниже.
      }
      localStorage.removeItem(SESSION_KEY);
    }

    const legacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) return null;

    try {
      const session = JSON.parse(legacy) as UserSession;
      if (session?.id && session?.login && getDashboardPath(session.role)) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(LEGACY_SESSION_KEY);
        return session;
      }
    } catch {
      // Игнорируем повреждённые данные.
    }

    localStorage.removeItem(LEGACY_SESSION_KEY);
    return null;
  },

  logout() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    emitAuthChange();
  },

  subscribe(callback: (session: UserSession | null) => void) {
    if (typeof window === 'undefined') return () => undefined;

    const notify = () => callback(AuthService.getSession());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === LEGACY_SESSION_KEY) notify();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, notify);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, notify);
    };
  },
};
