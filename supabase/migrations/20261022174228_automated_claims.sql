-- No scheme routes are activated and no claims are sent by this migration.
create table public.claim_automation_settings (
 practice_id uuid primary key references public.practices(id) on delete cascade,
 config jsonb not null default '{"auto_prepare":false,"submission_enabled":false,"enabled_at":null,"providers":{},"routes":{}}',
 updated_by uuid references public.profiles(id),updated_at timestamptz not null default now(),
 check(jsonb_typeof(config)='object' and octet_length(config::text)<50000)
);
create table public.claim_packets (
 claim_id uuid primary key references public.medical_aid_claims(id) on delete cascade,
 practice_id uuid not null references public.practices(id) on delete cascade,
 invoice_id uuid not null unique references public.invoices(id),consultation_id uuid references public.consultations(id),
 snapshot jsonb not null,fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
 issues jsonb not null default '[]',revision integer not null default 1,prepared_at timestamptz not null default now(),
 check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=100000),check(jsonb_typeof(issues)='array')
);
create table public.claim_submissions (
 id uuid primary key default gen_random_uuid(),claim_id uuid not null unique references public.claim_packets(claim_id),
 practice_id uuid not null references public.practices(id) on delete cascade,
 snapshot jsonb not null,fingerprint text not null,recipient text not null,scheme_id text not null,sender text not null,
 pdf_base64 text not null check(length(pdf_base64)<=3000000),
 state text not null default 'queued' check(state in ('queued','sending','accepted','delivered','bounced','failed','needs_review')),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default now(),
 attempts integer not null default 0,locked_at timestamptz,next_attempt_at timestamptz not null default now(),
 provider_message_id text unique,delivery_checked_at timestamptz,last_error text,updated_at timestamptz not null default now()
);
create table public.claim_submission_events (
 id text primary key check(length(id)<=200),submission_id uuid references public.claim_submissions(id),
 practice_id uuid references public.practices(id) on delete cascade,provider_message_id text,
 event_type text not null,message text,created_at timestamptz not null default now()
);
create index claim_packets_practice_idx on public.claim_packets(practice_id,prepared_at desc);
create index claim_packets_consultation_idx on public.claim_packets(consultation_id);
create index claim_settings_actor_idx on public.claim_automation_settings(updated_by);
create index claim_submissions_ready_idx on public.claim_submissions(state,next_attempt_at,approved_at);
create index claim_submissions_practice_idx on public.claim_submissions(practice_id,approved_at desc);
create index claim_submissions_actor_idx on public.claim_submissions(approved_by);
create index claim_events_submission_idx on public.claim_submission_events(submission_id,created_at);
create index claim_events_practice_idx on public.claim_submission_events(practice_id);
create index claim_events_message_idx on public.claim_submission_events(provider_message_id) where provider_message_id is not null;
do $$ declare t text; begin
 foreach t in array array['claim_automation_settings','claim_packets','claim_submissions','claim_submission_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy "Claim team reads own practice" on public.%I for select to authenticated using (practice_id=(select public.pc_current_practice()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''owner'',''admin'',''doctor'',''billing'')))',t);
 end loop;
end $$;
revoke select on public.claim_submissions from authenticated;
grant select(id,claim_id,practice_id,fingerprint,recipient,scheme_id,state,approved_by,approved_at,attempts,locked_at,next_attempt_at,provider_message_id,delivery_checked_at,last_error,updated_at) on public.claim_submissions to authenticated;

create function public.pc_store_claim_packet(p_claim uuid,p_invoice uuid,p_snapshot jsonb,p_fingerprint text,p_issues jsonb,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare i public.invoices;c public.medical_aid_claims;existing_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_invoice::text,42));
 select * into i from public.invoices where id=p_invoice for update;
 if i.id is null or p_snapshot->>'practice_id' is distinct from i.practice_id::text or p_snapshot->>'patient_id' is distinct from i.patient_id::text or p_snapshot#>>'{invoice,id}' is distinct from i.id::text or p_snapshot->>'claim_id' is distinct from p_claim::text then raise exception 'Claim source does not match its invoice'; end if;
 if p_actor is not null and not exists(select 1 from public.profiles where id=p_actor and practice_id=i.practice_id and active and role in ('owner','admin','doctor','billing')) then raise exception 'Claim team access required' using errcode='42501'; end if;
 if not exists(select 1 from public.patients where id=i.patient_id and practice_id=i.practice_id) then raise exception 'Patient practice does not match'; end if;
 if nullif(p_snapshot#>>'{consultation,id}','') is not null and not exists(select 1 from public.consultations where id=(p_snapshot#>>'{consultation,id}')::uuid and practice_id=i.practice_id and patient_id=i.patient_id) then raise exception 'Consultation does not match the patient'; end if;
 select claim_id into existing_id from public.claim_packets where invoice_id=i.id;
 if existing_id is not null and existing_id<>p_claim then return existing_id; end if;
 if exists(select 1 from public.claim_submissions where claim_id=p_claim) then return p_claim; end if;
 if exists(select 1 from public.medical_aid_claims where invoice_id=i.id and id<>p_claim and status<>'cancelled') then raise exception 'This invoice already has a claim. Open its existing claim.' using errcode='23505'; end if;
 select * into c from public.medical_aid_claims where id=p_claim;
 if c.id is not null and (c.practice_id<>i.practice_id or c.patient_id<>i.patient_id or c.invoice_id is distinct from i.id or c.status not in ('draft','ready') or c.submission_date is not null) then raise exception 'This claim cannot be prepared again'; end if;
 insert into public.medical_aid_claims(id,practice_id,patient_id,invoice_id,claim_number,claim_date,medical_aid_provider,membership_number,dependent_code,main_member_name,claimed_amount,status,created_by)
 values(p_claim,i.practice_id,i.patient_id,i.id,p_snapshot->>'claim_number',(p_snapshot->>'claim_date')::date,p_snapshot#>>'{member,scheme}',p_snapshot#>>'{member,number}',p_snapshot#>>'{member,dependent}',p_snapshot#>>'{member,main_member}',i.balance,case when jsonb_array_length(p_issues)=0 then 'ready' else 'draft' end,p_actor)
 on conflict(id) do update set medical_aid_provider=excluded.medical_aid_provider,membership_number=excluded.membership_number,dependent_code=excluded.dependent_code,main_member_name=excluded.main_member_name,claimed_amount=excluded.claimed_amount,status=excluded.status,updated_at=now();
 insert into public.claim_packets(claim_id,practice_id,invoice_id,consultation_id,snapshot,fingerprint,issues)
 values(p_claim,i.practice_id,i.id,nullif(p_snapshot#>>'{consultation,id}','')::uuid,p_snapshot,p_fingerprint,p_issues)
 on conflict(claim_id) do update set snapshot=excluded.snapshot,fingerprint=excluded.fingerprint,issues=excluded.issues,consultation_id=excluded.consultation_id,revision=claim_packets.revision+1,prepared_at=now()
 where claim_packets.fingerprint<>excluded.fingerprint or claim_packets.issues<>excluded.issues;
 return p_claim;
end $$;

create function public.pc_enqueue_claim(p_claim uuid,p_fingerprint text,p_actor uuid,p_scheme text,p_email text,p_sender text,p_pdf text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare packet public.claim_packets;existing_id uuid;cfg jsonb;result_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_claim::text,43));
 select * into packet from public.claim_packets where claim_id=p_claim for update;
 if packet.claim_id is null then raise exception 'Prepare the claim first'; end if;
 if not exists(select 1 from public.profiles p join public.practices pr on pr.id=p.practice_id where p.id=p_actor and p.practice_id=packet.practice_id and p.active and pr.active and p.role in ('owner','admin','doctor','billing')) then raise exception 'Claim team access required' using errcode='42501'; end if;
 select id into existing_id from public.claim_submissions where claim_id=p_claim;
 if existing_id is not null then return existing_id; end if;
 select config into cfg from public.claim_automation_settings where practice_id=packet.practice_id;
 if cfg->>'submission_enabled' is distinct from 'true' or cfg#>>array['routes',p_scheme,'email'] is distinct from p_email then raise exception 'Confirm and enable this scheme route in Claim settings'; end if;
 if packet.fingerprint<>p_fingerprint or jsonb_array_length(packet.issues)<>0 then raise exception 'The claim changed or has missing details. Refresh and review it.' using errcode='40001'; end if;
 if not exists(select 1 from public.medical_aid_claims where id=p_claim and status in ('draft','ready') and submission_date is null) then raise exception 'This claim has already been submitted or closed'; end if;
 insert into public.claim_submissions(claim_id,practice_id,snapshot,fingerprint,recipient,scheme_id,sender,pdf_base64,approved_by)
 values(p_claim,packet.practice_id,packet.snapshot,p_fingerprint,p_email,p_scheme,p_sender,p_pdf,p_actor) returning id into result_id;
 insert into public.claim_submission_events(id,submission_id,practice_id,event_type,message) values('approval/'||result_id,result_id,packet.practice_id,'approved','Practice reviewed and authorised the claim and destination.');
 return result_id;
end $$;

create function public.pc_take_claim_submissions(p_practice uuid default null,p_id uuid default null,p_limit integer default 5)
returns setof public.claim_submissions language plpgsql security invoker set search_path='' as $$
begin
 with stale as (update public.claim_submissions set state='needs_review',last_error='A sending worker stopped before delivery could be confirmed. Reconcile with the scheme before resubmitting.',updated_at=now() where state='sending' and locked_at<now()-interval '10 minutes' and (p_practice is null or practice_id=p_practice) and (p_id is null or id=p_id) returning *)
 insert into public.claim_submission_events(id,submission_id,practice_id,event_type,message) select 'stale/'||id,id,practice_id,'needs_review','Sending worker lease expired; automatic retry stopped.' from stale on conflict do nothing;
 return query with candidates as (select id from public.claim_submissions where state='queued' and next_attempt_at<=now() and (p_practice is null or practice_id=p_practice) and (p_id is null or id=p_id) order by approved_at limit least(greatest(p_limit,1),10) for update skip locked)
 update public.claim_submissions s set state='sending',attempts=attempts+1,locked_at=now(),updated_at=now() from candidates c where s.id=c.id returning s.*;
end $$;

create function public.pc_finish_claim_submission(p_id uuid,p_state text,p_message_id text default null,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.claim_submissions;final_state text;
begin
 select * into s from public.claim_submissions where id=p_id for update;
 if s.id is null or s.state not in ('sending','delivered','bounced') then return; end if;
 if p_state not in ('accepted','failed','needs_review','queued') then raise exception 'Invalid submission state'; end if;
 final_state:=case when s.state in ('delivered','bounced') then s.state when p_state='queued' and s.attempts>=3 then 'failed' else p_state end;
 update public.claim_submissions set state=final_state,provider_message_id=coalesce(provider_message_id,p_message_id),last_error=left(p_error,500),next_attempt_at=now()+interval '2 minutes',updated_at=now() where id=p_id;
 if p_state='accepted' then
  update public.medical_aid_claims set status='submitted',submission_date=(now() at time zone 'Africa/Johannesburg')::date,updated_at=now() where id=s.claim_id and practice_id=s.practice_id and status in ('draft','ready');
  update public.claim_submission_events set submission_id=s.id,practice_id=s.practice_id where provider_message_id=p_message_id and submission_id is null;
  if exists(select 1 from public.claim_submission_events where submission_id=s.id and event_type in ('email.bounced','email.failed','email.complained')) then update public.claim_submissions set state='bounced' where id=s.id;
  elsif exists(select 1 from public.claim_submission_events where submission_id=s.id and event_type='email.delivered') then update public.claim_submissions set state='delivered' where id=s.id; end if;
 end if;
 insert into public.claim_submission_events(id,submission_id,practice_id,provider_message_id,event_type,message)
 values('finish/'||s.id||'/'||s.attempts,s.id,s.practice_id,p_message_id,final_state,left(p_error,500)) on conflict do nothing;
end $$;

create function public.pc_claim_delivery_event(p_event text,p_message text,p_type text)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.claim_submissions;
begin
 if p_type not in ('email.delivered','email.bounced','email.failed','email.complained') then return; end if;
 select * into s from public.claim_submissions where provider_message_id=p_message for update;
 insert into public.claim_submission_events(id,submission_id,practice_id,provider_message_id,event_type) values('resend/'||p_event,s.id,s.practice_id,p_message,p_type) on conflict do nothing;
 if not found then return; end if;
 if s.id is null then return; end if;
 if p_type in ('email.bounced','email.failed','email.complained') then update public.claim_submissions set state='bounced',last_error='Email could not be delivered. Check the scheme route before taking further action.',updated_at=now() where id=s.id;
 elsif s.state in ('sending','accepted','needs_review') then update public.claim_submissions set state='delivered',last_error=null,updated_at=now() where id=s.id; end if;
end $$;
revoke all on function public.pc_store_claim_packet(uuid,uuid,jsonb,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.pc_enqueue_claim(uuid,text,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pc_take_claim_submissions(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.pc_finish_claim_submission(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.pc_claim_delivery_event(text,text,text) from public,anon,authenticated;
grant execute on function public.pc_store_claim_packet(uuid,uuid,jsonb,text,jsonb,uuid) to service_role;
grant execute on function public.pc_enqueue_claim(uuid,text,uuid,text,text,text,text) to service_role;
grant execute on function public.pc_take_claim_submissions(uuid,uuid,integer) to service_role;
grant execute on function public.pc_finish_claim_submission(uuid,text,text,text) to service_role;
grant execute on function public.pc_claim_delivery_event(text,text,text) to service_role;

create index claim_auto_invoices_idx on public.invoices(practice_id,created_at,id);
create function public.pc_claim_auto_candidates(p_limit integer default 20)
returns table(invoice_id uuid,practice_id uuid) language sql stable security invoker set search_path='' as $$
 select i.id,i.practice_id from public.invoices i
 join public.claim_automation_settings s on s.practice_id=i.practice_id
 join public.practices pr on pr.id=i.practice_id and pr.active
 join public.patients p on p.id=i.patient_id and p.practice_id=i.practice_id
 where s.config->>'auto_prepare'='true' and i.created_at>=(s.config->>'enabled_at')::timestamptz
 and i.status in ('unpaid','overdue') and i.amount_paid=0 and i.total>0
 and nullif(btrim(p.medical_aid_number),'') is not null
 and exists(select 1 from public.invoice_items where invoice_id=i.id)
 and not exists(select 1 from public.medical_aid_claims c where c.invoice_id=i.id and c.status<>'cancelled')
 order by i.created_at,i.id limit least(greatest(p_limit,1),25)
$$;
revoke all on function public.pc_claim_auto_candidates(integer) from public,anon,authenticated;
grant execute on function public.pc_claim_auto_candidates(integer) to service_role;

-- Claim writes now go through authenticated claim-team server handlers. Existing
-- financial records remain readable under their existing tenant policies.
revoke insert,update,delete on public.medical_aid_claims from authenticated;

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
    'summary',(select jsonb_build_object('count',count(*),'claimed',coalesce(sum(claimed_amount),0),'approved',coalesce(sum(approved_amount),0),'rejected',coalesce(sum(rejected_amount),0),'pending',count(*) filter(where lower(status) in ('draft','ready','submitted'))) from base)) into v_result;
  return v_result;
end $$;

