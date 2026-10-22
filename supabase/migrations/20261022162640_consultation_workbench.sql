-- Completed encounter details are constrained even for direct Data API writes.
create or replace function public.pc_valid_encounter_details(v jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare t jsonb; x jsonb; k text;
begin
  if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>100000 then return false; end if;
  if v='{}'::jsonb then return true; end if;
  if v->'version' is distinct from '1'::jsonb or jsonb_typeof(v->'template_id') is distinct from 'string' or length(v->>'template_id')>80 or jsonb_typeof(v->'tests') is distinct from 'array' or jsonb_array_length(v->'tests')>40 or jsonb_typeof(v->'transcript') is distinct from 'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(v) a(key) where key not in ('version','template_id','tests','transcript')) then return false; end if;
  if (select count(*) from jsonb_array_elements(v->'tests'))<>(select count(distinct item->>'id') from jsonb_array_elements(v->'tests') a(item)) then return false; end if;
  for t in select * from jsonb_array_elements(v->'tests') loop
    if jsonb_typeof(t)<>'object' then return false; end if;
    if exists(select 1 from jsonb_object_keys(t) a(key) where key not in ('id','name','category','status','location','specimen','performed_on','result','unit','reference_range','notes')) then return false; end if;
    foreach k in array array['id','name','category','status','location','specimen','performed_on','result','unit','reference_range','notes'] loop
      if jsonb_typeof(t->k) is distinct from 'string' then return false; end if;
    end loop;
    if (t->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or length(btrim(t->>'name'))=0 or length(t->>'name')>160 or length(t->>'category')>80
      or t->>'status' not in ('planned','ordered','performed','resulted','cancelled')
      or t->>'location' not in ('practice','external') or length(t->>'specimen')>100
      or length(t->>'result')>4000 or length(t->>'notes')>2000 or length(t->>'unit')>40 or length(t->>'reference_range')>200 then return false; end if;
    if t->>'status'='resulted' and btrim(t->>'result')='' then return false; end if;
    if t->>'performed_on'<>'' then
      if (t->>'performed_on')!~'^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (t->>'performed_on')::date;
    end if;
  end loop;
  x:=v->'transcript';
  if exists(select 1 from jsonb_object_keys(x) a(key) where key not in ('text','reviewed','language','mode')) then return false; end if;
  if jsonb_typeof(x->'text') is distinct from 'string' or length(x->>'text')>20000
    or jsonb_typeof(x->'reviewed') is distinct from 'boolean'
    or jsonb_typeof(x->'language') is distinct from 'string' or length(x->>'language')>32
    or jsonb_typeof(x->'mode') is distinct from 'string' or x->>'mode' not in ('typed','local','browser_service') then return false; end if;
  if btrim(x->>'text')<>'' and x->>'reviewed'<>'true' then return false; end if;
  return true;
exception when others then return false;
end $$;
revoke all on function public.pc_valid_encounter_details(jsonb) from public,anon;
grant execute on function public.pc_valid_encounter_details(jsonb) to authenticated,service_role;
alter table public.consultations add column if not exists encounter_details jsonb not null default '{}'::jsonb;
alter table public.consultations add constraint pc_consultation_encounter_check check(public.pc_valid_encounter_details(encounter_details));
comment on column public.consultations.encounter_details is 'Versioned consultation template, recorded investigations and clinician-reviewed transcript text. No audio. Same tenant RLS as the clinical record.';

-- Preserve author/tenant checks, draft revision locking and retry-safe completion.
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
  if not public.pc_valid_encounter_details(coalesce(nullif(p_data->>'encounter_details','')::jsonb,'{}'::jsonb)) then raise exception 'Review the transcript and check investigation details before completing this consultation.' using errcode='22023'; end if;
  insert into public.consultations(id,practice_id,patient_id,appointment_id,provider_id,consultation_date,chief_complaint,history_of_present_illness,temperature,pulse,respiratory_rate,blood_pressure_systolic,blood_pressure_diastolic,oxygen_saturation,weight,height,examination,diagnosis,diagnosis_code,treatment,procedures,clinical_notes,follow_up_notes,follow_up_date,encounter_details)
  values(p_id,v_practice,p_patient_id,p_appointment_id,auth.uid(),(p_data->>'consultation_date')::date::timestamp at time zone 'Africa/Johannesburg',nullif(p_data->>'chief_complaint',''),nullif(p_data->>'history_of_present_illness',''),nullif(p_data->>'temperature','')::numeric,nullif(p_data->>'pulse','')::integer,nullif(p_data->>'respiratory_rate','')::integer,nullif(p_data->>'blood_pressure_systolic','')::integer,nullif(p_data->>'blood_pressure_diastolic','')::integer,nullif(p_data->>'oxygen_saturation','')::numeric,nullif(p_data->>'weight','')::numeric,nullif(p_data->>'height','')::numeric,nullif(p_data->>'examination',''),nullif(p_data->>'diagnosis',''),nullif(p_data->>'diagnosis_code',''),nullif(p_data->>'treatment',''),nullif(p_data->>'procedures',''),nullif(p_data->>'clinical_notes',''),nullif(p_data->>'follow_up_notes',''),nullif(p_data->>'follow_up_date','')::date,coalesce(nullif(p_data->>'encounter_details','')::jsonb,'{}'::jsonb));
  if p_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=p_appointment_id and patient_id=p_patient_id and practice_id=v_practice; end if;
  delete from public.consultation_drafts where id=p_id and provider_id=auth.uid();
  return p_id;
end $$;

revoke all on function public.pc_finalize_consultation(uuid,uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.pc_finalize_consultation(uuid,uuid,uuid,jsonb,integer) to authenticated;
