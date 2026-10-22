-- Synthetic integration checks only. No HTTP/email calls; every row rolls back.
begin;
do $$
declare
 pa uuid:=gen_random_uuid();pb uuid:=gen_random_uuid();ua uuid:=gen_random_uuid();ub uuid:=gen_random_uuid();nurse uuid:=gen_random_uuid();
 patient_a uuid:=gen_random_uuid();consult_a uuid:=gen_random_uuid();invoice_id uuid;claim_id uuid;submission_id uuid;
 claims uuid[]:='{}';submissions uuid[]:='{}';invoices uuid[]:='{}';snap jsonb;stored jsonb;fp text:=repeat('a',64);n integer;got integer;today date:=(now() at time zone 'Africa/Johannesburg')::date;
begin
 insert into public.practices(id,name) values(pa,'Synthetic automated claims A'),(pb,'Synthetic automated claims B');
 insert into auth.users(id,email,aud,role) values(ua,ua::text||'@example.invalid','authenticated','authenticated'),(ub,ub::text||'@example.invalid','authenticated','authenticated'),(nurse,nurse::text||'@example.invalid','authenticated','authenticated');
 insert into public.profiles(id,practice_id,role,active) values(ua,pa,'doctor',true),(ub,pb,'doctor',true),(nurse,pa,'nurse',true);
 insert into public.patients(id,practice_id,patient_id,first_name,last_name,medical_aid_provider,medical_aid_number) values(patient_a,pa,'CLAIM-TEST','Fictional','Patient','Discovery Health Medical Scheme','SYNTHETIC');
 insert into public.consultations(id,practice_id,patient_id,provider_id,consultation_date,chief_complaint,diagnosis_code) values(consult_a,pa,patient_a,ua,now(),'Synthetic only','I10');
 insert into public.claim_automation_settings(practice_id,config,updated_by) values(pa,jsonb_build_object('auto_prepare',true,'submission_enabled',false,'enabled_at',now()-interval '1 minute','providers','{}'::jsonb,'routes',jsonb_build_object('discovery',jsonb_build_object('email','claims@discovery.co.za','confirmed_at',now(),'confirmed_by',ua))),ua);
 for n in 1..5 loop
  invoice_id:=gen_random_uuid();claim_id:=gen_random_uuid();invoices:=array_append(invoices,invoice_id);claims:=array_append(claims,claim_id);
  insert into public.invoices(id,practice_id,patient_id,invoice_number,invoice_date,subtotal,total,balance,status) values(invoice_id,pa,patient_a,'SYNTHETIC-'||n,today,500,500,500,'unpaid');
  insert into public.invoice_items(invoice_id,description,quantity,unit_price,line_total,service_code) values(invoice_id,'Synthetic invoice item',1,500,500,'0000');
  if n=5 then continue; end if;
  snap:=jsonb_build_object('version',1,'claim_id',claim_id,'practice_id',pa,'patient_id',patient_a,'claim_number','SYNTHETIC-CLAIM-'||n,'claim_date',today,'invoice',jsonb_build_object('id',invoice_id,'balance',500),'consultation',jsonb_build_object('id',consult_a),'member',jsonb_build_object('scheme','Discovery Health Medical Scheme','number','SYNTHETIC','dependent','00','main_member','Fictional Member'));
  perform set_config('role','service_role',true);
  if n=1 then
   begin perform public.pc_store_claim_packet(claim_id,invoice_id,snap,fp,'[]',ub);raise exception 'Other practice actor accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
  end if;
  if public.pc_store_claim_packet(claim_id,invoice_id,snap,fp,'[]',ua)<>claim_id then raise exception 'Packet did not save';end if;
  if n=1 then
   begin perform public.pc_enqueue_claim(claim_id,fp,ua,'discovery','claims@discovery.co.za','sender@example.invalid','U1lOVEhFVElD');raise exception 'Disabled route submitted' using errcode='XX000';exception when sqlstate 'P0001' then null;end;
   update public.claim_automation_settings set config=jsonb_set(config,'{submission_enabled}','true') where practice_id=pa;
   begin perform public.pc_enqueue_claim(claim_id,repeat('b',64),ua,'discovery','claims@discovery.co.za','sender@example.invalid','U1lOVEhFVElD');raise exception 'Stale approval accepted' using errcode='XX000';exception when serialization_failure then null;end;
  end if;
  submission_id:=public.pc_enqueue_claim(claim_id,fp,ua,'discovery','claims@discovery.co.za','sender@example.invalid','U1lOVEhFVElD');submissions:=array_append(submissions,submission_id);
  if public.pc_enqueue_claim(claim_id,fp,ua,'discovery','claims@discovery.co.za','sender@example.invalid','U1lOVEhFVElD')<>submission_id then raise exception 'Duplicate approval not idempotent';end if;
  select count(*) into got from public.pc_take_claim_submissions(pa,submission_id,1);if got<>1 then raise exception 'Queue claim failed';end if;
  if exists(select 1 from public.pc_take_claim_submissions(pa,submission_id,1)) then raise exception 'Leased submission taken twice';end if;
  if n=1 then
   perform public.pc_finish_claim_submission(submission_id,'accepted','synthetic-message-1',null);
   if (select status from public.medical_aid_claims where id=claim_id)<>'submitted' then raise exception 'Email acceptance did not record submission';end if;
   perform public.pc_claim_delivery_event('receipt-1','synthetic-message-1','email.delivered');perform public.pc_claim_delivery_event('receipt-1','synthetic-message-1','email.delivered');
   if (select count(*) from public.claim_submission_events where id='resend/receipt-1')<>1 then raise exception 'Receipt replay duplicated';end if;
   perform public.pc_claim_delivery_event('bounce-1','synthetic-message-1','email.bounced');perform public.pc_claim_delivery_event('late-delivered-1','synthetic-message-1','email.delivered');
   if (select state from public.claim_submissions where id=submission_id)<>'bounced' or (select status from public.medical_aid_claims where id=claim_id)<>'submitted' then raise exception 'Bounce rewound or scheme approval invented';end if;
   perform public.pc_store_claim_packet(claim_id,invoice_id,snap||'{"new":"changed"}',repeat('b',64),'[]',ua);
   if (select fingerprint from public.claim_packets cp where cp.claim_id=claims[1])<>fp then raise exception 'Approved snapshot changed';end if;
  elsif n=2 then
   perform public.pc_claim_delivery_event('early-2','synthetic-message-2','email.delivered');perform public.pc_finish_claim_submission(submission_id,'accepted','synthetic-message-2',null);
   if (select state from public.claim_submissions where id=submission_id)<>'delivered' then raise exception 'Early receipt lost';end if;
  elsif n=3 then
   perform public.pc_finish_claim_submission(submission_id,'queued',null,'Rate limit');update public.claim_submissions set next_attempt_at=now()-interval '1 minute' where id=submission_id;
   if not exists(select 1 from public.pc_take_claim_submissions(pa,submission_id,1)) then raise exception 'Safe retry unavailable';end if;
   perform public.pc_finish_claim_submission(submission_id,'needs_review',null,'Synthetic uncertain delivery');
   if exists(select 1 from public.pc_take_claim_submissions(pa,submission_id,1)) then raise exception 'Uncertain delivery retried';end if;
  else
   update public.claim_submissions set locked_at=now()-interval '11 minutes' where id=submission_id;
   perform public.pc_take_claim_submissions(pa,submission_id,1);
   if (select state from public.claim_submissions where id=submission_id)<>'needs_review' then raise exception 'Expired lease replayed';end if;
  end if;
  perform set_config('role','postgres',true);
 end loop;
 perform set_config('role','service_role',true);
 if not exists(select 1 from public.pc_claim_auto_candidates(25) c where c.invoice_id=invoices[5]) then raise exception 'New invoice catch-up missed';end if;
 perform set_config('request.jwt.claim.sub',ua::text,true);perform set_config('role','authenticated',true);
 if not exists(select 1 from public.claim_packets where practice_id=pa) then raise exception 'Claim team cannot read packets';end if;
 begin update public.claim_packets set fingerprint=repeat('b',64) where claim_packets.claim_id=claims[1];raise exception 'Client changed sealed packet' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin update public.medical_aid_claims set status='accepted' where id=claims[1];raise exception 'Client bypassed claim handler' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform pdf_base64 from public.claim_submissions where id=submissions[1];raise exception 'Sealed document exposed through Data API' using errcode='XX000';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',ub::text,true);
 if exists(select 1 from public.claim_packets where practice_id=pa) or exists(select 1 from public.claim_submission_events where practice_id=pa) then raise exception 'Cross-practice claim leak';end if;
 perform set_config('request.jwt.claim.sub',nurse::text,true);
 if exists(select 1 from public.claim_packets where practice_id=pa) then raise exception 'Non-claim role read packet';end if;
 perform set_config('role','postgres',true);
 if has_function_privilege('authenticated','public.pc_enqueue_claim(uuid,text,uuid,text,text,text,text)','execute') or has_function_privilege('anon','public.pc_take_claim_submissions(uuid,uuid,integer)','execute') then raise exception 'Submission RPC exposed';end if;
 raise notice 'PASS: tenant/role isolation, read-only packets, approval and source guards, duplicate prevention, queue leases, bounded retry states, early/replayed receipts, bounce precedence and draft catch-up';
end $$;
rollback;
