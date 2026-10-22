-- Theme writes and catalogue imports trust the verified profile role and tenant.
-- A self-profile update must never change those authorisation attributes.
-- Staff management and sign-up already use the server service-role client.
revoke all privileges on table public.profiles from public, anon, authenticated;
revoke select (id,practice_id,first_name,last_name,display_name,email,phone,role,active,created_at,updated_at,patient_id,staff_id),
  insert (id,practice_id,first_name,last_name,display_name,email,phone,role,active,created_at,updated_at,patient_id,staff_id),
  update (id,practice_id,first_name,last_name,display_name,email,phone,role,active,created_at,updated_at,patient_id,staff_id),
  references (id,practice_id,first_name,last_name,display_name,email,phone,role,active,created_at,updated_at,patient_id,staff_id)
  on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name,last_name,display_name,phone) on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;
comment on table public.appearance_settings is 'Appearance only. Validated server routes allow active superusers to manage all scopes and practice owners/admins to manage their own practice. No direct browser writes.';
