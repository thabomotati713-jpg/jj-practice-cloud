'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {Appearance,DEFAULT_APPEARANCE,PRESETS,applyAppearance} from '../lib/appearance';
type Practice={id:string;name:string};
export default function AppearanceEditor({practices}:{practices:Practice[]}) {
  const [scope,setScope]=useState('global');
  const [theme,setTheme]=useState<Appearance>(DEFAULT_APPEARANCE);
  const [saved,setSaved]=useState<Appearance>(DEFAULT_APPEARANCE);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [inherited,setInherited]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    async function load() {
      setLoading(true);setNotice('');setError('');
      window.dispatchEvent(new Event('appearance-saved'));
      try {
        const {data:{session}}=await supabase.auth.getSession();
        if(!session) throw new Error('Please sign in again.');
        const response=await fetch(`/api/superuser/appearance?scope=${encodeURIComponent(scope)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
        const data=await response.json();if(!response.ok) throw new Error(data.error);
        if(!cancelled){setTheme(data.settings);setSaved(data.settings);setInherited(data.inherited);}
      } catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load appearance.');}
      finally {if(!cancelled)setLoading(false);}
    }
    void load();
    return ()=>{cancelled=true;};
  },[scope]);
  async function save(reset=false) {
    setBusy(true);setError('');setNotice('');
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error('Please sign in again.');
      const response=await fetch('/api/superuser/appearance',{method:'PUT',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({scope,settings:theme,reset})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      const refreshed=await fetch(`/api/superuser/appearance?scope=${encodeURIComponent(scope)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await refreshed.json();if(!refreshed.ok)throw new Error(data.error);
      setTheme(data.settings);setSaved(data.settings);setInherited(data.inherited);
      window.dispatchEvent(new Event('appearance-saved'));
      setNotice(reset?'Default appearance restored.':'Appearance saved. It applies across devices on the next page load.');
    } catch(e){setError(e instanceof Error?e.message:'Could not save appearance.');}
    finally{setBusy(false);}
  }
  return <section className="card appearance-editor"><div className="card-header"><div><h2 className="card-title">Brand & appearance studio</h2><p className="page-subtitle">Set the platform look or match an individual practice’s brand.</p></div></div><div className="card-body">
    <label className="field"><span className="label">Apply to</span><select className="input" value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="global">Platform default & sign-in screen</option>{practices.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {loading?<p role="status">Loading appearance…</p>:<>
    {inherited&&<p className="alert-info">This practice currently follows the platform default.</p>}
    <fieldset disabled={busy} className="appearance-fields"><legend className="label">Colour palette</legend><div className="theme-swatches">{PRESETS.map(p=><button key={p.color} type="button" aria-pressed={theme.color===p.color} className="theme-swatch" onClick={()=>setTheme({...theme,color:p.color})}><span style={{background:p.color}} />{p.name}</button>)}</div>
    <div className="appearance-options"><label className="field"><span className="label">Custom logo colour</span><input aria-label="Custom logo colour" className="input" type="color" value={theme.color} onChange={e=>setTheme({...theme,color:e.target.value})}/><small>{theme.color.toUpperCase()}</small></label>
    <label className="field"><span className="label">Surface style</span><select className="input" value={theme.finish} onChange={e=>setTheme({...theme,finish:e.target.value as Appearance['finish']})}><option value="solid">Classic solid</option><option value="glass">Frosted glass</option></select></label>
    <label className="field"><span className="label">Corners</span><select className="input" value={theme.radius} onChange={e=>setTheme({...theme,radius:e.target.value as Appearance['radius']})}><option value="soft">Soft rounded</option><option value="square">Crisp square</option></select></label>
    <label className="field"><span className="label">Spacing</span><select className="input" value={theme.density} onChange={e=>setTheme({...theme,density:e.target.value as Appearance['density']})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div></fieldset>
    <div className="page-actions"><button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>applyAppearance(theme)}>Preview on this screen</button><button type="button" disabled={busy} className="btn btn-primary" onClick={()=>void save()}>{busy?'Saving…':'Save appearance'}</button><button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>{setTheme(saved);window.dispatchEvent(new Event('appearance-saved'));}}>Discard preview</button><button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>{if(window.confirm('Restore the default appearance for this selection?'))void save(true);}}>Restore default</button></div>
    <p className="page-subtitle">Client-specific themes apply after sign-in. Preview is temporary until saved. Clinical status colours and printed documents retain their meaning.</p></>}
    {notice&&<p className="alert-success" role="status">{notice}</p>}{error&&<p className="alert-error" role="alert">{error}</p>}
  </div></section>;
}
