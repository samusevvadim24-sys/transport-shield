import { supabase } from '@/lib/supabase';
import { User, UserSession } from '@/types/database.types';

export const SESSION_KEY = 'ts_user_session';
export const LEGACY_SESSION_KEY = 'currentUser';
export const AUTH_CHANGE_EVENT = 'ts-auth-change';

const emitAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
};

export const getDashboardPath = (role: UserSession['role'] | string | undefined) => {
  switch (role) {
    case 'admin': return '/dashboard/admin';
    case 'customer': return '/dashboard/customer';
    case 'driver': return '/dashboard/driver';
    default: return null;
  }
};

export const AuthService = {
  /**
   * Авторизация строго по таблице users (полю login).
   * Сессия хранится в localStorage и переживает перезапуск браузера.
   */
  async login(loginStr: string, passwordStr: string): Promise<UserSession> {
    const cleanLogin = loginStr.trim();
    const cleanPassword = passwordStr.trim();

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
    if (user.password !== cleanPassword) throw new Error('Неверный пароль');

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
    if (!data) return null;

    try {
      const session = JSON.parse(data) as UserSession;
      if (!session?.id || !session?.login || !getDashboardPath(session.role)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  logout() {
    if (typeof window === 'undefined') return;

    // Удаляем оба ключа: canonical и старый legacy, чтобы старые страницы
    // не могли восстановить уже завершённую сессию.
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
