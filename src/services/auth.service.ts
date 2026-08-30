import bcryptjs from 'bcryptjs';
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
 * Хеширует пароль через API (работает на сервере)
 * @param password - исходный пароль
 * @returns хешированный пароль
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const response = await fetch('/api/auth/hash-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to hash password');
    }

    const { hashedPassword } = await response.json();
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

/**
 * Проверяет соответствие пароля с его хешем
 * На сервере используется bcryptjs.compare
 * @param password - исходный пароль
 * @param passwordHash - хеш пароля из БД
 * @returns true если пароли совпадают
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, passwordHash);
  } catch {
    return false;
  }
}

export const AuthService = {
  /**
   * Авторизация строго по таблице users (полю login).
   * Сессия хранится в localStorage и переживает перезапуск браузера.
   */
  async login(loginStr: string, passwordStr: string): Promise<UserSession> {
    const cleanLogin = loginStr.trim();
    const cleanPassword = passwordStr.trim();

    if (!cleanLogin || !cleanPassword) {
      throw new Error('Логин и пароль обязательны');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, login, password, role')
      .eq('login', cleanLogin)
      .maybeSingle();

    if (error) {
      console.error('Ошибка Supabase при авторизации:', error.message);
      throw new Error('Ошибка соединения с базой данных');
    }

    if (!user) throw new Error('Пользователь с таким логином не найден');

    // Проверка пароля с использованием bcryptjs
    const isPasswordValid = await verifyPassword(cleanPassword, user.password);
    if (!isPasswordValid) throw new Error('Неверный пароль');

    const role = user.role as User['role'];
    if (!getDashboardPath(role)) throw new Error('Для пользователя не настроена роль');

    const session: UserSession = {
      id: user.id,
      login: user.login,
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
        // Повреждённая canonical-сессия будет заменена ниже или удалена.
      }
      localStorage.removeItem(SESSION_KEY);
    }

    // Однократно поддерживаем старый ключ, чтобы уже авторизованные
    // пользователи не были принудительно разлогинены после обновления.
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
      // Игнорируем повреждённые данные ниже.
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
