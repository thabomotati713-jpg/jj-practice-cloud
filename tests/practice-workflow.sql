-- Synthetic integration checks. Every inserted fixture is rolled back.
begin;
do $$
declare
  pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); colleague uuid:=gen_random_uuid();
  patient_a uuid; patient_b uuid:=gen_random_uuid(); patient_second uuid; appointment_a uuid:=gen_random_uuid();
  old_invoice uuid:=gen_random_uuid(); current_invoice uuid; draft_id uuid:=gen_random_uuid(); old_queue uuid:=gen_random_uuid();
  q1 uuid; q2 uuid; r jsonb; summary jsonb; content jsonb; saved_id uuid; started timestamptz;
  local_today date:=(now() at time zone 'Africa/Johannesburg')::date;
  month_start date:=date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date;
begin
  insert into public.practices(id,name) values(pa,'Synthetic workflow test A'),(pb,'Synthetic workflow test B');
  insert into auth.users(id,email,aud,role) values
    (ua,ua::text||'@example.invalid','authenticated','authenticated'),
    (ub,ub::text||'@example.invalid','authenticated','authenticated'),
    (colleague,colleague::text||'@example.invalid','authenticated','authenticated');
  insert into public.profiles(id,practice_id,role,active) values(ua,pa,'doctor',true),(ub,pb,'doctor',true),(colleague,pa,'doctor',true);
  insert into public.patients(practice_id,patient_id,first_name,last_name)
    select pa,'SCALE-'||lpad(n::text,5,'0'),'Synthetic','Patient'||n from generate_series(1,10000) n;
  select id into patient_a from public.patients where practice_id=pa and patient_id='SCALE-10000';
  select id into patient_second from public.patients where practice_id=pa and patient_id='SCALE-00001';
  insert into public.patients(id,practice_id,patient_id,first_name,last_name) values(patient_b,pb,'OTHER-CLINIC','OtherClinic','Hidden');
  insert into public.appointments(id,practice_id,patient_id,appointment_date,start_time) values(appointment_a,pa,patient_a,local_today,'09:00');
  insert into public.invoices(practice_id,patient_id,invoice_number,invoice_date,due_date,total,amount_paid,balance)
    select pa,patient_a,'SCALE-INV-'||n,month_start,local_today+7,100,10,90 from generate_series(1,1205) n;
  select id into current_invoice from public.invoices where practice_id=pa and invoice_number='SCALE-INV-1';
  insert into public.invoices(id,practice_id,patient_id,invoice_number,invoice_date,due_date,total,amount_paid,balance)
    values(old_invoice,pa,patient_a,'OLD',month_start-10,local_today-1,200,50,150);
  insert into public.invoices(practice_id,patient_id,invoice_number,invoice_date,due_date,total,amount_paid,balance)
    values(pa,patient_a,'FUTURE',(month_start+interval '1 month')::date,local_today+60,999,0,999);
  insert into public.payments(practice_id,patient_id,invoice_id,payment_date,amount,payment_method)
    values(pa,patient_a,old_invoice,now(),25,'cash'),(pa,patient_a,current_invoice,now(),7,'cash'),
      (pa,patient_a,current_invoice,month_start::timestamp at time zone 'Africa/Johannesburg'-interval '1 day',40,'cash');
  insert into public.medical_aid_claims(practice_id,patient_id,claim_number,claimed_amount,approved_amount,rejected_amount,status)
    select pa,patient_a,'SCALE-CLM-'||n,100,20,5,'submitted' from generate_series(1,1205) n;
  insert into public.inventory_products(practice_id,product_code,name,category,current_stock,minimum_stock)
    select pa,'SCALE-PRODUCT-'||n,'Synthetic product '||n,'General',0,2 from generate_series(1,1005) n;
  insert into public.inventory_products(practice_id,product_code,name,category,current_stock,minimum_stock)
    values(pa,'OPTICAL','Zulu frame','Frames',1,2);
  insert into public.patient_queue_entries(practice_id,patient_id,status) values(pa,patient_a,'waiting'),(pa,patient_second,'waiting');
  insert into public.patient_queue_entries(id,practice_id,patient_id,status,checked_in_at)
    select old_queue,pa,id,'waiting',now()-interval '2 days' from public.patients where practice_id=pa and patient_id='SCALE-00002';

  perform set_config('request.jwt.claim.sub',ua::text,true);
  perform set_config('role','authenticated',true);
  started:=clock_timestamp();
  r:=public.pc_patients_page('',0,25);
  if (r->>'total')::integer<>10000 or jsonb_array_length(r->'rows')<>25 then raise exception 'Patient pagination failed'; end if;
  r:=public.pc_patients_page('Patient10000',0,25);
  if (r->>'total')::integer<>1 or r->'rows'->0->>'id'<>patient_a::text then raise exception 'Search beyond row 1000 failed'; end if;
  if (public.pc_patients_page('OtherClinic')->>'total')::integer<>0 then raise exception 'Cross-practice patient leak'; end if;
  if (public.pc_patients_page('%')->>'total')::integer<>0 then raise exception 'Search wildcard was not treated literally'; end if;
  r:=public.pc_patients_page('',399,25);
  if jsonb_array_length(r->'rows')<>25 then raise exception 'Last patient page failed'; end if;
  r:=public.pc_claims_page('Patient10000',0,25);
  if (r->>'total')::integer<>1205 or jsonb_array_length(r->'rows')<>25 or (r->'summary'->>'claimed')::numeric<>120500 then raise exception 'Claim search or whole-practice totals failed'; end if;
  r:=public.pc_inventory_page('',0,25,array['Frames']);
  if (r->>'total')::integer<>1006 or r->'rows'->0->>'product_code'<>'OPTICAL' or (r->'summary'->>'out')::integer<>1005 then raise exception 'Inventory ordering, pagination or totals failed'; end if;
  if (public.pc_inventory_page('SCALE-PRODUCT-1005')->>'total')::integer<>1 then raise exception 'Stock search beyond row 1000 failed'; end if;
  summary:=public.pc_dashboard_summary();
  if (summary->'counts'->>'patients')::integer<>10000 or (summary->'counts'->>'invoices')::integer<>1207 then raise exception 'Dashboard counts truncated'; end if;
  if (summary->'stats'->>'invoicedThisMonth')::numeric<>120500 then raise exception 'Invoice month bounds or totals failed'; end if;
  if (summary->'stats'->>'receivedThisMonth')::numeric<>32 or (summary->'stats'->>'receivedToday')::numeric<>32 then raise exception 'Payment-date totals failed'; end if;
  if (summary->'stats'->>'overdueTotal')::numeric<>150 then raise exception 'Overdue totals failed'; end if;
  if (summary->'counts'->>'queue')::integer<>2 then raise exception 'Queue counts include a previous day'; end if;
  raise notice 'Scale search and summaries completed in % ms',extract(milliseconds from clock_timestamp()-started);

  content:=jsonb_build_object('consultation_date',local_today,'chief_complaint','Synthetic test','temperature','36.5','pulse','70');
  r:=public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content,0);
  if (r->>'revision')::integer<>1 then raise exception 'Draft save failed'; end if;
  if public.pc_consultation_draft(patient_a,appointment_a)->'data'<>content then raise exception 'Draft recovery failed'; end if;
  begin
    perform public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content||'{"clinical_notes":"stale"}',0);
    raise exception 'A stale draft overwrote the current version';
  exception when serialization_failure then null; end;
  perform set_config('request.jwt.claim.sub',colleague::text,true);
  if public.pc_consultation_draft(patient_a,appointment_a) is not null then raise exception 'A colleague can read another author draft'; end if;
  if exists(select 1 from public.consultation_drafts where id=draft_id) then raise exception 'Draft RLS leaks to a colleague'; end if;
  perform set_config('request.jwt.claim.sub',ub::text,true);
  begin
    perform public.pc_consultation_draft(patient_a,appointment_a);
    raise exception 'Cross-practice draft access succeeded';
  exception when insufficient_privilege then null; end;
  if (public.pc_claims_page('')->>'total')::integer<>0 then raise exception 'Cross-practice claims leak'; end if;
  if (public.pc_inventory_page('')->>'total')::integer<>0 then raise exception 'Cross-practice stock leak'; end if;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  content:=content||'{"clinical_notes":"Recovered and completed"}';
  perform public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content,1);
  begin
    perform public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,1);
    raise exception 'A stale finalisation succeeded';
  exception when serialization_failure then null; end;
  saved_id:=public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,2);
  if saved_id<>draft_id or public.pc_consultation_draft(patient_a,appointment_a) is not null then raise exception 'Finalisation did not consume the draft'; end if;
  if (select status from public.appointments where id=appointment_a)<>'completed' then raise exception 'Appointment not completed atomically'; end if;
  if public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,2)<>saved_id or (select count(*) from public.consultations where id=saved_id)<>1 then raise exception 'Finalisation retry created a duplicate'; end if;
  begin
    perform public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content,2);
    raise exception 'A late autosave recreated a completed draft';
  exception when serialization_failure then null; end;
  begin
    perform public.pc_queue_call_next(pa);
    raise exception 'Authenticated users bypassed the server queue role check';
  exception when insufficient_privilege then null; end;
  perform set_config('role','service_role',true);
  q1:=public.pc_queue_call_next(pa); q2:=public.pc_queue_call_next(pa);
  if q1 is null or q2 is null or q1=q2 or q1=old_queue or q2=old_queue then raise exception 'Queue allocation failed'; end if;
  if public.pc_queue_call_next(pa) is not null then raise exception 'Queue called a previous-day patient'; end if;
  perform set_config('role','postgres',true);
  if has_function_privilege('anon','public.pc_dashboard_summary()','execute') or has_function_privilege('anon','public.pc_save_consultation_draft(uuid,uuid,uuid,jsonb,integer)','execute') then raise exception 'Anonymous RPC access is enabled'; end if;
  raise notice 'PASS: 10,000 patients, 1,205 claims, 1,006 products, complete dashboard totals, tenant and author isolation, draft conflicts, idempotent finalisation and queue allocation';
end $$;
rollback;
