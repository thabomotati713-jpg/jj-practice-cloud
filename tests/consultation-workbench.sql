-- Synthetic fixtures only; all data is rolled back.
begin;
do $$
declare
 pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); colleague uuid:=gen_random_uuid();
 patient_a uuid:=gen_random_uuid(); draft_id uuid:=gen_random_uuid(); saved_id uuid; appointment_a uuid:=gen_random_uuid();
 details jsonb; content jsonb; response jsonb; invalid jsonb; today date:=(now() at time zone 'Africa/Johannesburg')::date;
begin
 insert into public.practices(id,name) values(pa,'Synthetic consultation workbench A'),(pb,'Synthetic consultation workbench B');
 insert into auth.users(id,email,aud,role) values(ua,ua::text||'@example.invalid','authenticated','authenticated'),(ub,ub::text||'@example.invalid','authenticated','authenticated'),(colleague,colleague::text||'@example.invalid','authenticated','authenticated');
 insert into public.profiles(id,practice_id,role,active) values(ua,pa,'doctor',true),(ub,pb,'doctor',true),(colleague,pa,'doctor',true);
 insert into public.patients(id,practice_id,patient_id,first_name,last_name) values(patient_a,pa,'WORKBENCH-TEST','Synthetic','Patient');
 insert into public.appointments(id,practice_id,patient_id,appointment_date,start_time) values(appointment_a,pa,patient_a,today,'09:00');
 perform set_config('request.jwt.claim.sub',ua::text,true);
 perform set_config('role','authenticated',true);
 details:=jsonb_build_object('version',1,'template_id','general','tests',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Synthetic test','category','Other','status','resulted','location','practice','specimen','Synthetic sample','performed_on',today,'result','Synthetic recorded result','unit','','reference_range','','notes','Review discussed')),'transcript',jsonb_build_object('text','Synthetic words for integration test','reviewed',false,'language','en-ZA','mode','typed'));
 content:=jsonb_build_object('consultation_date',today,'chief_complaint','Synthetic consultation','encounter_details',details::text);
 response:=public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content,0);
 if response->>'revision'<>'1' or public.pc_consultation_draft(patient_a,appointment_a)->'data'<>content then raise exception 'Extended draft did not round-trip'; end if;
 begin
  perform public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,1);
  raise exception 'Unreviewed transcript finalised';
 exception when invalid_parameter_value then null; end;
 if (select status from public.appointments where id=appointment_a)='completed' or not exists(select 1 from public.consultation_drafts where id=draft_id) then raise exception 'Rejected completion changed the visit'; end if;
 perform set_config('request.jwt.claim.sub',colleague::text,true);
 if public.pc_consultation_draft(patient_a,appointment_a) is not null then raise exception 'Another author read transcript draft'; end if;
 perform set_config('request.jwt.claim.sub',ua::text,true);
 details:=jsonb_set(details,'{transcript,reviewed}','true');
 if not public.pc_valid_encounter_details(details) then raise exception 'Valid details rejected'; end if;
 for invalid in select * from jsonb_array_elements(jsonb_build_array(
  details-'version',details-'tests',details-'transcript',jsonb_set(details,'{version}','"1"'),
  jsonb_set(details,'{transcript,reviewed}','null'),details||'{"unknown":true}',
  jsonb_set(details,'{tests,0,result}','""'),jsonb_set(details,'{tests,0,performed_on}','"2026-02-30"'),
  jsonb_set(details,'{tests,0,id}','"invalid"'),jsonb_set(details,'{tests}',(details->'tests')||(details->'tests')),
  jsonb_set(details,'{transcript,text}',to_jsonb(repeat('x',20001)))
 )) loop
  if public.pc_valid_encounter_details(invalid) then raise exception 'Malformed details accepted: %',invalid; end if;
 end loop;
 content:=jsonb_set(content,'{encounter_details}',to_jsonb(details::text));
 perform public.pc_save_consultation_draft(draft_id,patient_a,appointment_a,content,1);
 saved_id:=public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,2);
 if saved_id<>draft_id or (select encounter_details from public.consultations where id=saved_id)<>details then raise exception 'Investigations or transcript lost at completion'; end if;
 if public.pc_consultation_draft(patient_a,appointment_a) is not null or (select status from public.appointments where id=appointment_a)<>'completed' then raise exception 'Completion was not atomic'; end if;
 if public.pc_finalize_consultation(draft_id,patient_a,appointment_a,content,2)<>saved_id then raise exception 'Completion retry failed'; end if;
 begin
  update public.consultations set encounter_details=jsonb_set(details,'{transcript,reviewed}','false') where id=saved_id;
  raise exception 'Direct unreviewed write bypassed validation';
 exception when check_violation then null; end;
 perform set_config('request.jwt.claim.sub',ub::text,true);
 if exists(select 1 from public.consultations where id=saved_id) then raise exception 'Cross-practice consultation leak'; end if;
 perform set_config('role','postgres',true);
 if has_function_privilege('anon','public.pc_valid_encounter_details(jsonb)','execute') or has_function_privilege('anon','public.pc_finalize_consultation(uuid,uuid,uuid,jsonb,integer)','execute') then raise exception 'Anonymous consultation RPC allowed'; end if;
 raise notice 'PASS: investigations and transcript draft recovery, author and tenant isolation, review enforcement, strict validation, direct-write constraint, atomic completion and retry';
end $$;
rollback;
