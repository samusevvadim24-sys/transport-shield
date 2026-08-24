alter table public.inspections
  add column if not exists blood_pressure_systolic integer,
  add column if not exists blood_pressure_diastolic integer,
  add column if not exists drug_intoxication boolean not null default false;

comment on column public.inspections.blood_pressure_systolic is 'Систолическое артериальное давление, мм рт. ст.';
comment on column public.inspections.blood_pressure_diastolic is 'Диастолическое артериальное давление, мм рт. ст.';
comment on column public.inspections.drug_intoxication is 'Признак наркотического опьянения по результатам медосмотра';
