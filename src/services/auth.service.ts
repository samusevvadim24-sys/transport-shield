import { UserSession } from '@/types/database.types';

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
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

export const AuthService = {
  async login(loginStr: string, passwordStr: string): Promise<UserSession> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ login: loginStr.trim(), password: passwordStr.trim() }),
    });

    let body: { error?: string; session?: UserSession } = {};
    try { body = await response.json(); } catch { /* ignore invalid response */ }
    if (!response.ok || !body.session) throw new Error(body.error || 'Не удалось выполнить вход');

    const session = body.session;
    if (!getDashboardPath(session.role)) throw new Error('Для пользователя не настроена роль');

    // Сессия хранится только на сервере и передается через HttpOnly cookie.
    // Удаляем старые client-side значения, оставшиеся от предыдущей версии.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ts_user_session');
      localStorage.removeItem('currentUser');
      emitAuthChange();
    }

    return session;
  },

  async getServerSession(): Promise<UserSession | null> {
    if (typeof window === 'undefined') return null;
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const body = await response.json() as { session?: UserSession };
      const session = body.session;
      return session?.id && session.login && getDashboardPath(session.role) ? session : null;
    } catch {
      return null;
    }
  },

  async logout() {
    if (typeof window === 'undefined') return;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Cookie/session cleanup is handled by the server route.
    }
    localStorage.removeItem('ts_user_session');
    localStorage.removeItem('currentUser');
    emitAuthChange();
  },

  subscribe(callback: (session: UserSession | null) => void) {
    if (typeof window === 'undefined') return () => undefined;

    let disposed = false;
    const notify = async () => {
      const session = await AuthService.getServerSession();
      if (!disposed) callback(session);
    };

    void notify();
    window.addEventListener(AUTH_CHANGE_EVENT, notify);

    return () => {
      disposed = true;
      window.removeEventListener(AUTH_CHANGE_EVENT, notify);
    };
  },
};
