-- Additive release: paginated lists, database summaries, private drafts and queue locking.
-- All user-facing functions run with the caller's RLS permissions.
create or replace function public.pc_current_practice()
returns uuid language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode='42501'; end if;
  select p.practice_id into v_practice from public.profiles p
  join public.practices r on r.id=p.practice_id and r.active
  where p.id=auth.uid() and p.active;
  if v_practice is null then raise exception 'An active practice account is required.' using errcode='42501'; end if;
  return v_practice;
end $$;
revoke all on function public.pc_current_practice() from public, anon;
grant execute on function public.pc_current_practice() to authenticated;

create index if not exists pc_patients_page_idx on public.patients(practice_id,created_at desc,id);
create index if not exists pc_claims_page_idx on public.medical_aid_claims(practice_id,created_at desc,id);
create index if not exists pc_inventory_page_idx on public.inventory_products(practice_id,name,id);
create index if not exists pc_invoices_dates_idx on public.invoices(practice_id,invoice_date);
create index if not exists pc_payments_dates_idx on public.payments(practice_id,payment_date);
create index if not exists pc_appointments_dates_idx on public.appointments(practice_id,appointment_date,status);

create or replace function public.pc_patients_page(p_search text default '',p_page integer default 0,p_page_size integer default 25)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); v_result jsonb;
begin
  if p_page<0 or p_page>100000 or p_page_size not between 1 and 50 or length(coalesce(p_search,''))>200 then
    raise exception 'Invalid search or page.' using errcode='22023';
  end if;
  with matching as materialized (
    select id,patient_id,title,first_name,middle_name,last_name,date_of_birth,gender,phone,email,status,created_at
    from public.patients where practice_id=v_practice and
      strpos(lower(coalesce(patient_id,'')||' '||coalesce(first_name,'')||' '||coalesce(middle_name,'')||' '||coalesce(last_name,'')||' '||coalesce(phone,'')||' '||coalesce(email,'')),lower(btrim(coalesce(p_search,''))))>0
  ), page_rows as (
    select * from matching order by created_at desc,id limit p_page_size offset p_page*p_page_size
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from page_rows r),'[]'::jsonb),'total',(select count(*) from matching)) into v_result;
  return v_result;
end $$;

create or replace function public.pc_claims_page(p_search text default '',p_page integer default 0,p_page_size integer default 25)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); v_result jsonb;
begin
  if p_page<0 or p_page>100000 or p_page_size not between 1 and 50 or length(coalesce(p_search,''))>200 then raise exception 'Invalid search or page.' using errcode='22023'; end if;
  with base as materialized (
    select c.*,jsonb_build_object('id',p.id,'patient_id',p.patient_id,'first_name',p.first_name,'last_name',p.last_name) as patient,
      lower(coalesce(c.claim_number,'')||' '||coalesce(c.medical_aid_provider,'')||' '||coalesce(c.membership_number,'')||' '||coalesce(c.main_member_name,'')||' '||coalesce(p.patient_id,'')||' '||coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) as search_text
    from public.medical_aid_claims c join public.patients p on p.id=c.patient_id and p.practice_id=v_practice
    where c.practice_id=v_practice
  ), matching as materialized (select * from base where strpos(search_text,lower(btrim(coalesce(p_search,''))))>0),
  page_rows as (select * from matching order by created_at desc,id limit p_page_size offset p_page*p_page_size)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)-'search_text' order by r.created_at desc,r.id) from page_rows r),'[]'::jsonb),'total',(select count(*) from matching),
    'summary',(select jsonb_build_object('count',count(*),'claimed',coalesce(sum(claimed_amount),0),'approved',coalesce(sum(approved_amount),0),'rejected',coalesce(sum(rejected_amount),0),'pending',count(*) filter(where lower(status) in ('pending','submitted'))) from base)) into v_result;
  return v_result;
end $$;

create or replace function public.pc_inventory_page(p_search text default '',p_page integer default 0,p_page_size integer default 25,p_categories text[] default '{}')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); v_result jsonb;
begin
  if p_page<0 or p_page>100000 or p_page_size not between 1 and 50 or length(coalesce(p_search,''))>200 or cardinality(p_categories)>100 then raise exception 'Invalid search or page.' using errcode='22023'; end if;
  with base as materialized (select * from public.inventory_products where practice_id=v_practice),
  matching as materialized (
    select *,case when lower(coalesce(category,''))=any(array(select lower(x) from unnest(p_categories) x)) then 0 else 1 end as priority
    from base where strpos(lower(coalesce(name,'')||' '||coalesce(generic_name,'')||' '||coalesce(product_code,'')||' '||coalesce(barcode,'')||' '||coalesce(category,'')||' '||coalesce(manufacturer,'')),lower(btrim(coalesce(p_search,''))))>0
  ), page_rows as (select * from matching order by priority,name,id limit p_page_size offset p_page*p_page_size)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)-'priority' order by r.priority,r.name,r.id) from page_rows r),'[]'::jsonb),'total',(select count(*) from matching),
    'summary',(select jsonb_build_object('count',count(*),'low',count(*) filter(where current_stock>0 and current_stock<=minimum_stock),'out',count(*) filter(where current_stock<=0),'active',count(*) filter(where active)) from base)) into v_result;
  return v_result;
end $$;

create or replace function public.pc_dashboard_summary()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); v_today date:=(now() at time zone 'Africa/Johannesburg')::date;
v_month date:=date_trunc('month',v_today)::date; v_next_month date:=(date_trunc('month',v_today)+interval '1 month')::date;
v_start timestamptz:=v_today::timestamp at time zone 'Africa/Johannesburg'; v_month_start timestamptz:=v_month::timestamp at time zone 'Africa/Johannesburg';
v_next_month_start timestamptz:=v_next_month::timestamp at time zone 'Africa/Johannesburg'; v_result jsonb;
begin
  select jsonb_build_object('counts',jsonb_build_object(
    'patients',(select count(*) from public.patients where practice_id=v_practice),
    'appointments',(select count(*) from public.appointments where practice_id=v_practice),
    'prescriptions',(select count(*) from public.prescriptions where practice_id=v_practice),
    'sick_notes',(select count(*) from public.sick_notes where practice_id=v_practice),
    'invoices',(select count(*) from public.invoices where practice_id=v_practice),
    'claims',(select count(*) from public.medical_aid_claims where practice_id=v_practice),
    'staff',(select count(*) from public.staff where practice_id=v_practice),
    'inventory',(select count(*) from public.inventory_products where practice_id=v_practice),
    'queue',(select count(*) from public.patient_queue_entries where practice_id=v_practice and checked_in_at>=v_start and checked_in_at<v_start+interval '1 day' and status in ('waiting','called','in_consultation'))),
    'stats',(select jsonb_build_object(
      'invoicedThisMonth',coalesce(sum(total) filter(where invoice_date>=v_month and invoice_date<v_next_month),0),
      'collectedThisMonth',coalesce(sum(amount_paid) filter(where invoice_date>=v_month and invoice_date<v_next_month),0),
      'outstandingTotal',coalesce(sum(balance),0),
      'overdueTotal',coalesce(sum(balance) filter(where due_date<v_today and balance>0),0),
      'receivedThisMonth',(select coalesce(sum(amount),0) from public.payments where practice_id=v_practice and payment_date>=v_month_start and payment_date<v_next_month_start),
      'receivedToday',(select coalesce(sum(amount),0) from public.payments where practice_id=v_practice and payment_date>=v_start and payment_date<v_start+interval '1 day'),
      'upcomingWeek',(select count(*) from public.appointments where practice_id=v_practice and appointment_date>=v_today and appointment_date<v_today+7 and status in ('scheduled','confirmed')))
    from public.invoices where practice_id=v_practice)) into v_result;
  return v_result;
end $$;

revoke all on function public.pc_patients_page(text,integer,integer),public.pc_claims_page(text,integer,integer),public.pc_inventory_page(text,integer,integer,text[]),public.pc_dashboard_summary() from public,anon;
grant execute on function public.pc_patients_page(text,integer,integer),public.pc_claims_page(text,integer,integer),public.pc_inventory_page(text,integer,integer,text[]),public.pc_dashboard_summary() to authenticated;

-- Only the existing authenticated server route may call this privileged operation.
create or replace function public.pc_queue_call_next(p_practice_id uuid)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare v_id uuid; v_start timestamptz:=((now() at time zone 'Africa/Johannesburg')::date)::timestamp at time zone 'Africa/Johannesburg';
begin
  if not exists(select 1 from public.practices where id=p_practice_id and active) then raise exception 'Active practice required.' using errcode='42501'; end if;
  with next_entry as (
    select id from public.patient_queue_entries where practice_id=p_practice_id and status='waiting' and checked_in_at>=v_start and checked_in_at<v_start+interval '1 day'
    order by queue_order_at,id for update skip locked limit 1
  ) update public.patient_queue_entries q set status='called',called_at=now(),updated_at=now()
    from next_entry n where q.id=n.id returning q.id into v_id;
  return v_id;
end $$;
revoke all on function public.pc_queue_call_next(uuid) from public,anon,authenticated;
grant execute on function public.pc_queue_call_next(uuid) to service_role;

create table if not exists public.consultation_drafts (
  id uuid primary key,
  practice_id uuid not null references public.practices(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  context_key text generated always as (coalesce(appointment_id::text,'unscheduled')) stored,
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=150000),
  revision integer not null default 1 check(revision>0),
  updated_at timestamptz not null default now(),
  unique(provider_id,patient_id,context_key)
);
alter table public.consultation_drafts enable row level security;
grant select,insert,update,delete on public.consultation_drafts to authenticated;
create policy "Authors manage their clinical drafts" on public.consultation_drafts for all to authenticated
using(provider_id=(select auth.uid()) and practice_id=(select public.pc_current_practice()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','doctor')))
with check(provider_id=(select auth.uid()) and practice_id=(select public.pc_current_practice()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','doctor'))
  and exists(select 1 from public.patients p where p.id=consultation_drafts.patient_id and p.practice_id=consultation_drafts.practice_id)
  and (appointment_id is null or exists(select 1 from public.appointments a where a.id=consultation_drafts.appointment_id and a.patient_id=consultation_drafts.patient_id and a.practice_id=consultation_drafts.practice_id)));
create index if not exists pc_drafts_patient_idx on public.consultation_drafts(patient_id);
create index if not exists pc_drafts_appointment_idx on public.consultation_drafts(appointment_id);
create index if not exists pc_drafts_practice_idx on public.consultation_drafts(practice_id);

create or replace function public.pc_consultation_draft(p_patient_id uuid,p_appointment_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('owner','doctor')) then raise exception 'Doctor access is required.' using errcode='42501'; end if;
  if not exists(select 1 from public.patients where id=p_patient_id and practice_id=v_practice) then raise exception 'Patient not found.' using errcode='42501'; end if;
  if p_appointment_id is not null and not exists(select 1 from public.appointments where id=p_appointment_id and patient_id=p_patient_id and practice_id=v_practice) then raise exception 'Appointment does not belong to this patient.' using errcode='42501'; end if;
  select jsonb_build_object('id',id,'data',data,'revision',revision,'updated_at',updated_at) into v_result from public.consultation_drafts
  where provider_id=auth.uid() and patient_id=p_patient_id and appointment_id is not distinct from p_appointment_id;
  return v_result;
end $$;
revoke all on function public.pc_consultation_draft(uuid,uuid) from public,anon;
grant execute on function public.pc_consultation_draft(uuid,uuid) to authenticated;

create or replace function public.pc_save_consultation_draft(p_id uuid,p_patient_id uuid,p_appointment_id uuid,p_data jsonb,p_revision integer)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); d public.consultation_drafts;
begin
  if p_id is null or p_revision<0 or p_revision is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>150000 then raise exception 'Invalid consultation draft.' using errcode='22023'; end if;
  if p_revision=0 then
    insert into public.consultation_drafts(id,practice_id,provider_id,patient_id,appointment_id,data)
    values(p_id,v_practice,auth.uid(),p_patient_id,p_appointment_id,p_data)
    on conflict do nothing returning * into d;
  else
    update public.consultation_drafts set data=p_data,revision=revision+1,updated_at=now()
    where id=p_id and provider_id=auth.uid() and practice_id=v_practice and patient_id=p_patient_id and appointment_id is not distinct from p_appointment_id and revision=p_revision returning * into d;
  end if;
  if d.id is null then raise exception 'A newer draft exists or this consultation was already saved. Reload before continuing.' using errcode='40001'; end if;
  return jsonb_build_object('id',d.id,'revision',d.revision,'updated_at',d.updated_at);
end $$;

create or replace function public.pc_finalize_consultation(p_id uuid,p_patient_id uuid,p_appointment_id uuid,p_data jsonb,p_revision integer)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare v_practice uuid:=public.pc_current_practice(); d public.consultation_drafts; v_existing public.consultations;
begin
  if p_id is null or p_revision is null or p_revision<0 or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>150000 then raise exception 'Invalid consultation.' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','doctor') and active) then raise exception 'Doctor access is required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into v_existing from public.consultations where id=p_id;
  if v_existing.id is not null then
    if v_existing.practice_id<>v_practice or v_existing.provider_id<>auth.uid() or v_existing.patient_id<>p_patient_id or v_existing.appointment_id is distinct from p_appointment_id then raise exception 'Consultation does not belong to this visit.' using errcode='42501'; end if;
    return v_existing.id;
  end if;
  select * into d from public.consultation_drafts where id=p_id for update;
  if d.id is null or d.provider_id<>auth.uid() or d.patient_id<>p_patient_id or d.appointment_id is distinct from p_appointment_id or d.revision<>p_revision or d.data<>p_data then raise exception 'The draft changed. Save the latest draft before completing this consultation.' using errcode='40001'; end if;
  if not exists(select 1 from public.patients where id=p_patient_id and practice_id=v_practice) then raise exception 'Patient not found.' using errcode='42501'; end if;
  if p_appointment_id is not null and not exists(select 1 from public.appointments where id=p_appointment_id and patient_id=p_patient_id and practice_id=v_practice) then raise exception 'Appointment does not belong to this patient.' using errcode='42501'; end if;
  if btrim(coalesce(p_data->>'chief_complaint','')||coalesce(p_data->>'diagnosis','')||coalesce(p_data->>'clinical_notes',''))='' then raise exception 'Please enter a chief complaint, diagnosis, or clinical notes.' using errcode='22023'; end if;
  insert into public.consultations(id,practice_id,patient_id,appointment_id,provider_id,consultation_date,chief_complaint,history_of_present_illness,temperature,pulse,respiratory_rate,blood_pressure_systolic,blood_pressure_diastolic,oxygen_saturation,weight,height,examination,diagnosis,diagnosis_code,treatment,procedures,clinical_notes,follow_up_notes,follow_up_date)
  values(p_id,v_practice,p_patient_id,p_appointment_id,auth.uid(),(p_data->>'consultation_date')::date::timestamp at time zone 'Africa/Johannesburg',nullif(p_data->>'chief_complaint',''),nullif(p_data->>'history_of_present_illness',''),nullif(p_data->>'temperature','')::numeric,nullif(p_data->>'pulse','')::integer,nullif(p_data->>'respiratory_rate','')::integer,nullif(p_data->>'blood_pressure_systolic','')::integer,nullif(p_data->>'blood_pressure_diastolic','')::integer,nullif(p_data->>'oxygen_saturation','')::numeric,nullif(p_data->>'weight','')::numeric,nullif(p_data->>'height','')::numeric,nullif(p_data->>'examination',''),nullif(p_data->>'diagnosis',''),nullif(p_data->>'diagnosis_code',''),nullif(p_data->>'treatment',''),nullif(p_data->>'procedures',''),nullif(p_data->>'clinical_notes',''),nullif(p_data->>'follow_up_notes',''),nullif(p_data->>'follow_up_date','')::date);
  if p_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=p_appointment_id and patient_id=p_patient_id and practice_id=v_practice; end if;
  delete from public.consultation_drafts where id=p_id and provider_id=auth.uid();
  return p_id;
end $$;
revoke all on function public.pc_save_consultation_draft(uuid,uuid,uuid,jsonb,integer),public.pc_finalize_consultation(uuid,uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.pc_save_consultation_draft(uuid,uuid,uuid,jsonb,integer),public.pc_finalize_consultation(uuid,uuid,uuid,jsonb,integer) to authenticated;
