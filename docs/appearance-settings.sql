-- Applied to Supabase as practice_appearance_settings.
create table public.appearance_settings (
  scope text primary key,
  practice_id uuid unique references public.practices(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint appearance_scope_check check ((scope = 'global' and practice_id is null) or scope = practice_id::text)
);
alter table public.appearance_settings enable row level security;
revoke all on public.appearance_settings from anon, authenticated;
grant all on public.appearance_settings to service_role;
comment on table public.appearance_settings is 'Appearance only. Access via validated server routes; active superusers are the only writers.';
