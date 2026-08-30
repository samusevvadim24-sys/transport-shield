import { supabase } from '@/lib/supabase';
import { fetchAdminInspectionPointId } from '@/services/settings.service';

export async function claimInspectionPoint(inspectionId: string | number) {
  const pointId = await fetchAdminInspectionPointId();
  if (!pointId) throw new Error('У администратора не назначен пункт осмотра');

  const { data: claimed, error: claimError } = await supabase
    .from('inspections')
    .update({ inspection_point_id: pointId })
    .eq('id', inspectionId)
    .is('inspection_point_id', null)
    .select('inspection_point_id')
    .maybeSingle();

  if (claimError) throw claimError;
  if (claimed?.inspection_point_id) return Number(claimed.inspection_point_id);

  const { data: current, error } = await supabase
    .from('inspections')
    .select('inspection_point_id')
    .eq('id', inspectionId)
    .maybeSingle();

  if (error) throw error;
  if (!current?.inspection_point_id) throw new Error('Не удалось закрепить пункт осмотра');
  return Number(current.inspection_point_id);
}
