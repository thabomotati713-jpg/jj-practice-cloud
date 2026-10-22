-- Transaction-scoped fixtures: no retained accounts, profile or practice data.
begin;
do $$
declare pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); affected integer;
begin
  if has_column_privilege('authenticated','public.profiles','role','UPDATE')
    or has_column_privilege('authenticated','public.profiles','practice_id','UPDATE')
    or has_column_privilege('authenticated','public.profiles','active','UPDATE')
    or has_column_privilege('authenticated','public.profiles','id','UPDATE')
    or has_column_privilege('authenticated','public.profiles','patient_id','UPDATE')
    or has_column_privilege('authenticated','public.profiles','staff_id','UPDATE') then
    raise exception 'Sensitive profile attributes are writable';
  end if;
  if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'Anonymous profile access'; end if;
  if not has_table_privilege('service_role','public.profiles','UPDATE') then raise exception 'Server management blocked'; end if;
  insert into public.practices(id,name) values(pa,'Synthetic catalogue test A'),(pb,'Synthetic catalogue test B');
  insert into auth.users(id,email,aud,role) values(ua,ua::text||'@example.invalid','authenticated','authenticated'),(ub,ub::text||'@example.invalid','authenticated','authenticated');
  insert into public.profiles(id,practice_id,role,active) values(ua,pa,'doctor',true),(ub,pb,'owner',true);
  perform set_config('request.jwt.claim.sub',ua::text,true);
  execute 'set local role authenticated';
  update public.profiles set display_name='Synthetic own name' where id=ua;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Own display name update blocked'; end if;
  update public.profiles set display_name='Cross practice' where id=ub;
  get diagnostics affected=row_count;if affected<>0 then raise exception 'Cross practice update succeeded'; end if;
  begin
    update public.profiles set role='owner' where id=ua;
    raise exception 'Role escalation succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set practice_id=pb where id=ua;
    raise exception 'Tenant reassignment succeeded';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  raise notice 'PASS: protected roles and tenant, safe self edits, cross-practice isolation, anonymous denial and server management';
end $$;
rollback;
