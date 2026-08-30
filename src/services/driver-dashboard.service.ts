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

const DRIVER_SELECT = `*, customers (name)`;

export const DriverDashboardService = {
  async getDriverByNumber(userLogin: string): Promise<DriverData | null> {
    let { data, error } = await supabase.from('drivers').select(DRIVER_SELECT).eq('driver_id', userLogin).maybeSingle();
    if (!data) {
      const { data: userData } = await supabase.from('users').select('id').eq('login', userLogin).maybeSingle();
      if (userData?.id) {
        const result = await supabase.from('drivers').select(DRIVER_SELECT).eq('user_id', userData.id).maybeSingle();
        data = result.data;
        error = result.error;
      }
    }
    if (error) {
      console.error('Ошибка при запросе водителя:', error.message);
      return null;
    }
    if (!data) return null;
    return { ...data, customerName: (data.customers as any)?.name || 'Не указана', inspection_scope: data.inspection_scope || 'both' };
  },

  subscribeToDriver(driverDbId: number, userLogin: string, onUpdate: (driver: DriverData | null) => void) {
    let active = true;
    let refreshInFlight = false;
    let refreshQueued = false;

    const refresh = async () => {
      if (!active) return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        const driver = await this.getDriverByNumber(userLogin);
        if (active) onUpdate(driver);
      } finally {
        refreshInFlight = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };

    void refresh();
    const channel = supabase.channel(`driver-data-${driverDbId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `id=eq.${driverDbId}` }, () => void refresh())
      .subscribe();

    const interval = window.setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  },

  subscribeToChecks(driverDbId: number, onUpdate: (inspections: any[]) => void) {
    let active = true;
    let requestId = 0;
    let refreshInFlight = false;
    let refreshQueued = false;

    const refresh = async () => {
      if (!active) return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      const currentRequest = ++requestId;
      try {
        const { data, error } = await supabase.from('inspections').select('*').eq('driver_id', driverDbId).order('requested_at', { ascending: false });
        if (!error && active && currentRequest === requestId) onUpdate(data || []);
        if (error) console.error('Ошибка обновления осмотров:', error.message);
      } finally {
        refreshInFlight = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };

    void refresh();
    const channel = supabase.channel(`driver-inspections-${driverDbId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections', filter: `driver_id=eq.${driverDbId}` }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 30000);

    return () => {
      active = false;
      requestId++;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  },

  subscribeToSettings(onUpdate: (settings: any) => void) {
    let active = true;
    const refresh = async () => {
      if (!active) return;
      try {
        const { fetchSystemSettings } = await import('@/services/settings.service');
        const settings = await fetchSystemSettings();
        if (active) onUpdate(settings);
      } catch (error) {
        console.error('Ошибка обновления настроек:', error);
      }
    };
    void refresh();
    const channel = supabase.channel(`driver-system-settings-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings', filter: 'id=eq.1' }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  },

  async acknowledgeSummon(inspectionId: number) {
    const { error } = await supabase.from('inspections').update({ summon_acknowledged: true } as any).eq('id', inspectionId);
    if (error) throw new Error(error.message);
  },

  async createInspection(driverDbId: number) {
    const { data: driver, error: driverError } = await supabase.from('drivers').select('inspection_scope').eq('id', driverDbId).single();
    if (driverError) throw new Error(driverError.message);
    const scope = driver?.inspection_scope || 'both';
    const newInspection: Record<string, any> = { driver_id: driverDbId, requested_at: new Date().toISOString(), overall_status: 'Ожидание' };
    if (scope === 'medical' || scope === 'both') newInspection.medical_status = 'Ожидание';
    if (scope === 'mechanic' || scope === 'both') newInspection.mechanic_status = 'Ожидание';
    const { error } = await supabase.from('inspections').insert([newInspection]);
    if (error) throw new Error(error.message);
  },
};