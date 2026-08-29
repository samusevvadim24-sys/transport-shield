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
  inspection_scope?: 'medical' | 'mechanic' | 'both';
}

const DRIVER_SELECT = `
  *,
  customers (
    name
  )
`;

export const DriverDashboardService = {
  async getDriverByNumber(userLogin: string): Promise<DriverData | null> {
    let { data, error } = await supabase
      .from('drivers')
      .select(DRIVER_SELECT)
      .eq('driver_id', userLogin)
      .maybeSingle();

    if (!data) {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('login', userLogin)
        .maybeSingle();

      if (userData?.id) {
        const result = await supabase
          .from('drivers')
          .select(DRIVER_SELECT)
          .eq('user_id', userData.id)
          .maybeSingle();
        data = result.data;
        error = result.error;
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

    return {
      ...data,
      customerName: (data.customers as any)?.name || 'Не указана',
      inspection_scope: data.inspection_scope || 'both',
    };
  },

  async subscribeToDriver(
    driverDbId: number,
    userLogin: string,
    onUpdate: (driver: DriverData | null) => void
  ) {
    const refresh = async () => {
      const driver = await this.getDriverByNumber(userLogin);
      onUpdate(driver);
    };

    await refresh();

    const channel = supabase
      .channel(`driver-data-${driverDbId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverDbId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async subscribeToChecks(driverDbId: number, onUpdate: (inspections: any[]) => void) {
    const refresh = async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('driver_id', driverDbId)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Ошибка обновления осмотров:', error.message);
        return;
      }
      onUpdate(data || []);
    };

    await refresh();

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
        refresh
      )
      .subscribe();

    // Fallback на случай потери realtime-события/переподключения.
    const interval = setInterval(refresh, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  },

  async acknowledgeSummon(inspectionId: number) {
    const { error } = await supabase
      .from('inspections')
      .update({ summon_acknowledged: true } as any)
      .eq('id', inspectionId);

    if (error) {
      console.error('Ошибка подтверждения вызова:', error.message);
      throw new Error(error.message);
    }
  },

  async createInspection(driverDbId: number) {
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('inspection_scope')
      .eq('id', driverDbId)
      .single();

    if (driverError) {
      console.error('Ошибка получения типа осмотра:', driverError.message);
      throw new Error(driverError.message);
    }

    const scope = driver?.inspection_scope || 'both';
    const newInspection: Record<string, any> = {
      driver_id: driverDbId,
      requested_at: new Date().toISOString(),
      overall_status: 'Ожидание',
    };

    if (scope === 'medical' || scope === 'both') {
      newInspection.medical_status = 'Ожидание';
    }

    if (scope === 'mechanic' || scope === 'both') {
      newInspection.mechanic_status = 'Ожидание';
    }

    const { error } = await supabase.from('inspections').insert([newInspection]);

    if (error) {
      console.error('Ошибка создания запроса на осмотр:', error.message);
      throw new Error(error.message);
    }
  },
};