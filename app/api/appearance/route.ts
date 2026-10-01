import { adminClient, requireProfile, accessError } from '../../../lib/serverAccess';
import { DEFAULT_APPEARANCE, isAppearance } from '../../../lib/appearance';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    let admin=adminClient(); let scope='global';
    if(request.headers.has('authorization')) {
      const auth=await requireProfile(request); admin=auth.admin;
      scope=auth.profile.role==='superuser'?'global':auth.profile.practice_id;
    }
    const {data,error}=await admin.from('appearance_settings').select('scope,settings').in('scope',scope==='global'?['global']:['global',scope]);
    if(error) throw error;
    const settings=data?.find(row=>row.scope===scope)?.settings ?? data?.find(row=>row.scope==='global')?.settings;
    return Response.json({settings:isAppearance(settings)?settings:DEFAULT_APPEARANCE},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return accessError(error); }
}
