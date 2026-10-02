-- J&J PracticeCloud Marketing Command Centre
-- Applied to Supabase production on 2026-10-02.
-- Keep this file as the reproducible schema definition for the marketing workspace.

create table if not exists public.marketing_channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('facebook','instagram','linkedin','whatsapp','x','google_business','email')),
  account_name text not null,
  profile_url text,
  connection_mode text not null default 'share_only' check (connection_mode in ('share_only','api_ready','external_connector')),
  status text not null default 'ready' check (status in ('ready','connected','paused')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, account_name)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null default 'demo_bookings',
  audience text,
  offer text,
  landing_url text,
  status text not null default 'draft' check (status in ('draft','scheduled','active','completed','paused')),
  start_date date,
  end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','linkedin','whatsapp','x','email')),
  title text,
  body text not null,
  cta text,
  target_url text,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','published','cancelled')),
  published_at timestamptz,
  external_post_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  practice_name text,
  email text,
  phone text,
  specialty text,
  province text,
  source text not null default 'website',
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  status text not null default 'new' check (status in ('new','contacted','demo_booked','trial','won','lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  slug text not null unique,
  label text not null,
  destination_url text not null,
  clicks integer not null default 0 check (clicks >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_campaign_status_idx on public.marketing_campaigns(status, created_at desc);
create index if not exists marketing_posts_schedule_idx on public.marketing_posts(status, scheduled_at);
create index if not exists marketing_leads_status_idx on public.marketing_leads(status, created_at desc);
create index if not exists marketing_links_campaign_idx on public.marketing_links(campaign_id);

alter table public.marketing_channels enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_posts enable row level security;
alter table public.marketing_leads enable row level security;
alter table public.marketing_links enable row level security;

revoke all on public.marketing_channels from anon, authenticated;
revoke all on public.marketing_campaigns from anon, authenticated;
revoke all on public.marketing_posts from anon, authenticated;
revoke all on public.marketing_leads from anon, authenticated;
revoke all on public.marketing_links from anon, authenticated;

grant all on public.marketing_channels to service_role;
grant all on public.marketing_campaigns to service_role;
grant all on public.marketing_posts to service_role;
grant all on public.marketing_leads to service_role;
grant all on public.marketing_links to service_role;

-- The application uses server-side service-role access after requireProfile(request, true)
-- verifies that the caller is an active superuser. Policies are retained as defence in depth
-- if direct authenticated access is deliberately granted in future.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marketing_channels',
    'marketing_campaigns',
    'marketing_posts',
    'marketing_leads',
    'marketing_links'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'Superusers manage ' || replace(table_name, 'marketing_', 'marketing '), table_name);
  end loop;
end
$$;

create policy "Superusers manage marketing channels"
on public.marketing_channels for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true));

create policy "Superusers manage marketing campaigns"
on public.marketing_campaigns for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true));

create policy "Superusers manage marketing posts"
on public.marketing_posts for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true));

create policy "Superusers manage marketing leads"
on public.marketing_leads for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true));

create policy "Superusers manage marketing links"
on public.marketing_links for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superuser' and p.active = true));
