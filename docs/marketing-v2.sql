-- Additive marketing-only migration. No clinical table changes.
alter table public.marketing_posts drop constraint if exists marketing_posts_platform_check;
alter table public.marketing_posts add constraint marketing_posts_platform_check check(platform in ('facebook','google_business','instagram','linkedin','whatsapp','x','email'));
alter table public.marketing_posts drop constraint if exists marketing_posts_status_check;
alter table public.marketing_posts add constraint marketing_posts_status_check check(status in ('draft','ready','scheduled','publishing','review_required','published','cancelled'));
alter table public.marketing_posts add column if not exists auto_publish boolean not null default false;
alter table public.marketing_posts add column if not exists publish_error text;
alter table public.marketing_posts add column if not exists publish_receipt jsonb;
alter table public.marketing_leads add column if not exists external_id text;
alter table public.marketing_leads add column if not exists follow_up_at timestamptz;
alter table public.marketing_leads add column if not exists demo_at timestamptz;
alter table public.marketing_leads add column if not exists demo_url text;
alter table public.marketing_leads add column if not exists utm_source text;
alter table public.marketing_leads add column if not exists utm_medium text;
alter table public.marketing_leads add column if not exists utm_campaign text;
create unique index if not exists marketing_lead_external_idx on public.marketing_leads(source,external_id);
create unique index if not exists marketing_demo_slot_idx on public.marketing_leads(demo_at) where demo_at is not null and status='demo_booked';
create table if not exists public.marketing_insights (
 connector text primary key, account_id text not null, date_from date not null, date_to date not null,
 rows jsonb not null default '[]', fetched_at timestamptz not null default now(), error text
);
alter table public.marketing_insights enable row level security;
revoke all on public.marketing_insights from anon, authenticated;
grant all on public.marketing_insights to service_role;
create or replace function public.marketing_increment_click(link_id uuid) returns void
language sql security invoker set search_path='' as $$
 update public.marketing_links set clicks=clicks+1 where id=link_id;
$$;
revoke all on function public.marketing_increment_click(uuid) from public,anon,authenticated;
grant execute on function public.marketing_increment_click(uuid) to service_role;
