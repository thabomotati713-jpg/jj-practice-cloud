import { adminClient, requireProfile, accessError } from '../../../lib/serverAccess';
import { DEFAULT_APPEARANCE, isAppearance } from '../../../lib/appearance';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    let admin=adminClient(); let scope='global'; let canEdit=false;
    if(request.headers.has('authorization')) {
      const auth=await requireProfile(request); admin=auth.admin;
      scope=auth.profile.role==='superuser'?'global':auth.profile.practice_id;
      canEdit=!!auth.profile.practice_id && ['owner','admin'].includes(auth.profile.role);
    }
    const {data,error}=await admin.from('appearance_settings').select('scope,settings').in('scope',scope==='global'?['global']:['global',scope]);
    if(error) throw error;
    const settings=data?.find(row=>row.scope===scope)?.settings ?? data?.find(row=>row.scope==='global')?.settings;
    return Response.json({settings:isAppearance(settings)?settings:DEFAULT_APPEARANCE,canEdit,inherited:scope!=='global'&&!data?.some(row=>row.scope===scope)},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return accessError(error); }
}

// Practice administrators can only write their own practice theme. Scope is
// always derived from the verified profile, never from request JSON.
export async function PUT(request:Request) {
  try {
    const {admin,profile,user}=await requireProfile(request);
    if(!profile.practice_id || !['owner','admin'].includes(profile.role)) return Response.json({error:'Only practice administrators can save a practice theme.'},{status:403});
    const body=await request.json().catch(()=>null);
    if(!body || typeof body!=='object' || (body.reset!==undefined&&typeof body.reset!=='boolean') || (body.reset!==true&&!isAppearance(body.settings))) return Response.json({error:'Choose a valid appearance.'},{status:400});
    const scope=profile.practice_id;
    if(body.reset===true) {
      const {error}=await admin.from('appearance_settings').delete().eq('scope',scope);
      if(error)throw error;
    } else {
      const {color,finish,radius,density}=body.settings;
      const {error}=await admin.from('appearance_settings').upsert({scope,practice_id:scope,settings:{color,finish,radius,density},updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'scope'});
      if(error)throw error;
    }
    return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return accessError(error);}
}
