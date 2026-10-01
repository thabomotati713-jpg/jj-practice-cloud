import { requireProfile, accessError } from '../../../../lib/serverAccess';
import { isAppearance, DEFAULT_APPEARANCE } from '../../../../lib/appearance';
const validScope=(scope:string)=>scope==='global'||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope);
export async function GET(request:Request) {
  try {
    const {admin}=await requireProfile(request,true);
    const scope=new URL(request.url).searchParams.get('scope')||'global';
    if(!validScope(scope)) return Response.json({error:'Invalid practice.'},{status:400});
    const {data,error}=await admin.from('appearance_settings').select('scope,settings').in('scope',scope==='global'?['global']:['global',scope]);
    if(error) throw error;
    const own=data?.find(row=>row.scope===scope)?.settings;
    const settings=own??data?.find(row=>row.scope==='global')?.settings??DEFAULT_APPEARANCE;
    return Response.json({settings:isAppearance(settings)?settings:DEFAULT_APPEARANCE,inherited:scope!=='global'&&!own},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return accessError(error);}
}
export async function PUT(request:Request) {
  try {
    const {admin,user}=await requireProfile(request,true);
    const body=await request.json().catch(()=>null);
    if(!body || typeof body!=='object') return Response.json({error:'Invalid request.'},{status:400});
    const scope=body.scope;
    if(typeof scope!=='string'||!validScope(scope)||(body.reset!==undefined&&typeof body.reset!=='boolean')||(body.reset!==true&&!isAppearance(body.settings))) return Response.json({error:'Choose a valid theme and practice.'},{status:400});
    if(scope!=='global') {
      const {data}=await admin.from('practices').select('id').eq('id',scope).maybeSingle();
      if(!data) return Response.json({error:'Practice not found.'},{status:404});
    }
    if(body.reset===true) {
      const {error}=await admin.from('appearance_settings').delete().eq('scope',scope);
      if(error) throw error;
    } else {
      const {color,finish,radius,density}=body.settings;
      const {error}=await admin.from('appearance_settings').upsert({scope,practice_id:scope==='global'?null:scope,settings:{color,finish,radius,density},updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'scope'});
      if(error) throw error;
    }
    return Response.json({success:true});
  } catch(error) {return accessError(error);}
}
