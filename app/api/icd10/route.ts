import data from '@/data/icd10-who-2019.json';
import { searchIcdCodes } from '@/lib/icd10';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') || '').slice(0,120);
  const chapter = params.get('chapter') || '';
  if (chapter && !data.chapters.some(row => row.id === chapter)) return Response.json({error:'Invalid chapter.'},{status:400});
  const page = Math.min(1000,Math.max(0,Math.floor(Number(params.get('page')) || 0)));
  const limit = Math.min(50,Math.max(1,Math.floor(Number(params.get('limit')) || 20)));
  const rows = searchIcdCodes(data.codes,query,chapter,params.get('terminal') === 'true');
  return Response.json({rows:rows.slice(page*limit,(page+1)*limit),total:rows.length,chapters:data.chapters,version:data.version},
    {headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
}
