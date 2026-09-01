create unique index if not exists inspections_one_active_per_driver_idx
  on public.inspections (driver_id)
  where completed_at is null;
