import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function adminClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('Server configuration is incomplete.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requireProfile(request:Request, superuser=false) {
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token) throw new Error('401');
  const admin=adminClient();
  const {data:{user},error}=await admin.auth.getUser(token);
  if(error || !user) throw new Error('401');
  const {data:profile,error:profileError}=await admin.from('profiles').select('id,role,active,practice_id').eq('id',user.id).single();
  if(profileError || !profile?.active || (superuser && profile.role!=='superuser')) throw new Error('403');
  if(profile.role!=='superuser') {
    const {data:practice}=await admin.from('practices').select('active').eq('id',profile.practice_id).single();
    if(!practice?.active) throw new Error('403');
  }
  return {admin,profile,user};
}
export function accessError(error:unknown) {
  const status=error instanceof Error && ['401','403'].includes(error.message)?Number(error.message):500;
  return Response.json({error:status===401?'Please sign in again.':status===403?'Superuser or active practice access is required.':'Could not complete this request.'},{status});
}
