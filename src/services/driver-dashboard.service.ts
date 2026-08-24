/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export interface DriverData {
  id: number;
  driver_id: string;
  name: string;
  car_brand: string;
  car_number: string;
  license_number: string;
  license_expiry: string;
  medical_expiry: string;
  tech_inspection_expiry: string;
  insurance_expiry: string;
  customer_id: number;
  user_id?: number;
  customerName?: string;
}

export const DriverDashboardService = {
  /**
   * Получение водителя по логину из сессии (ищет по driver_id или по user_id)
   */
  async getDriverByNumber(userLogin: string): Promise<DriverData | null> {
    // 1. Ищем напрямую по полю drivers.driver_id
    let { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        customers (
          name
        )
      `)
      .eq('driver_id', userLogin)
      .maybeSingle();

    // 2. Если не нашли по driver_id, ищем id пользователя в таблице users по его логину
    if (!data) {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('login', userLogin)
        .maybeSingle();

      if (userData?.id) {
        const { data: driverByUserId, error: driverErr } = await supabase
          .from('drivers')
          .select(`
            *,
            customers (
              name
            )
          `)
          .eq('user_id', userData.id)
          .maybeSingle();

        data = driverByUserId;
        error = driverErr;
      }
    }

    if (error) {
      console.error('Ошибка при запросе водителя:', error.message);
      return null;
    }

    if (!data) {
      console.warn(`Водитель с логином/табельным номером "${userLogin}" не найден в базе drivers.`);
      return null;
    }

    // Маппим customerName из связи с таблицей customers
    return {
      ...data,
      customerName: (data.customers as any)?.name || 'Не указана',
    };
  },

  /**
   * Подписка на осмотры водителя в режиме Realtime
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribeToChecks(driverDbId: number, onUpdate: (inspections: any[]) => void) {
    // Первоначальная загрузка
    supabase
      .from('inspections')
      .select('*')
      .eq('driver_id', driverDbId)
      .order('requested_at', { ascending: false })
      .then(({ data }) => {
        if (data) onUpdate(data);
      });

    // Realtime подписка
    const channel = supabase
      .channel(`driver-inspections-${driverDbId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspections',
          filter: `driver_id=eq.${driverDbId}`,
        },
        async () => {
          const { data } = await supabase
            .from('inspections')
            .select('*')
            .eq('driver_id', driverDbId)
            .order('requested_at', { ascending: false });
          if (data) onUpdate(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Подтверждение вызова на осмотр
   */
  async acknowledgeSummon(inspectionId: number) {
    const { error } = await supabase
      .from('inspections')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ summon_acknowledged: true } as any)
      .eq('id', inspectionId);

    if (error) {
      console.error('Ошибка подтверждения вызова:', error.message);
    }
  },

  /**
   * Создание нового запроса на осмотр в таблице inspections
   */
  async createInspection(driverDbId: number) {
    const newInspection = {
      driver_id: driverDbId,
      requested_at: new Date().toISOString(),
      overall_status: 'Ожидание',
      medical_status: 'Ожидание',
      mechanic_status: 'Ожидание',
    };

    const { error } = await supabase.from('inspections').insert([newInspection]);

    if (error) {
      console.error('Ошибка создания запроса на осмотр:', error.message);
      throw new Error(error.message);
    }
  }
};