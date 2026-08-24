import { supabase } from '@/lib/supabase';
import { User, UserSession } from '@/types/database.types';

const SESSION_KEY = 'ts_user_session';

export const AuthService = {
  /**
   * Авторизация строго по таблице users (полю login)
   */
  async login(loginStr: string, passwordStr: string): Promise<UserSession> {
    const cleanLogin = loginStr.trim();
    const cleanPassword = passwordStr.trim();

    // Запрос в Supabase строго по полю login
    const { data: user, error } = await supabase
      .from('users')
      .select('id, login, password, role')
      .eq('login', cleanLogin)
      .maybeSingle();

    if (error) {
      console.error('Ошибка Supabase при авторизации:', error.message);
      throw new Error('Ошибка соединения с базой данных');
    }

    if (!user) {
      throw new Error('Пользователь с таким логином не найден');
    }

    // Проверка пароля
    if (user.password !== cleanPassword) {
      throw new Error('Неверный пароль');
    }

  
    // Сохранение сессии
    const session: UserSession = {
      id: user.id,
      login: user.login,
      
      role: user.role as User['role']
    };
    

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    return session;
  },

  getSession(): UserSession | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  }
};