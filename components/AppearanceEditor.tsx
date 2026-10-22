'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {Appearance,DEFAULT_APPEARANCE,PRESETS,THEME_COLLECTION,applyAppearance,isAppearance} from '@/lib/appearance';
import styles from './appearance-studio.module.css';
type Practice={id:string;name:string};
export default function AppearanceEditor({practices=[],practiceMode=false}:{practices?:Practice[];practiceMode?:boolean}) {
  const [scope,setScope]=useState('global');
  const [theme,setTheme]=useState<Appearance>(DEFAULT_APPEARANCE);
  const [saved,setSaved]=useState<Appearance>(DEFAULT_APPEARANCE);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [inherited,setInherited]=useState(false),[canEdit,setCanEdit]=useState(!practiceMode);
  const endpoint=practiceMode?'/api/appearance':'/api/superuser/appearance';
  const readUrl=practiceMode?endpoint:`${endpoint}?scope=${encodeURIComponent(scope)}`;
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setNotice('');setError('');window.dispatchEvent(new Event('appearance-saved'));
      try{
        const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Please sign in to personalise your practice.');
        const response=await fetch(readUrl,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
        const data=await response.json();if(!response.ok)throw new Error(data.error);
        if(!isAppearance(data.settings))throw new Error('Could not read appearance.');
        if(!cancelled){setTheme(data.settings);setSaved(data.settings);setInherited(data.inherited);setCanEdit(!practiceMode||data.canEdit===true);}
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load appearance.');}
      finally{if(!cancelled)setLoading(false);}
    }
    void load();return()=>{cancelled=true;};
  },[readUrl,practiceMode]);
  async function save(reset=false){
    setBusy(true);setError('');setNotice('');
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Please sign in again.');
      const headers={Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'};
      const response=await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify({scope,settings:theme,reset})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      const refreshed=await fetch(readUrl,{headers,cache:'no-store'});const data=await refreshed.json();
      if(!refreshed.ok||!isAppearance(data.settings))throw new Error('Saved. Refresh to load your appearance.');
      setTheme(data.settings);setSaved(data.settings);setInherited(data.inherited);applyAppearance(data.settings);
      window.dispatchEvent(new Event('appearance-saved'));setNotice(reset?'Default appearance restored.':'Appearance saved across devices.');
    }catch(e){setError(e instanceof Error?e.message:'Could not save appearance.');}finally{setBusy(false);}
  }
  function preview(value:Appearance){setTheme(value);applyAppearance(value);setNotice('Preview applied. Save to use this look across your practice.');}
  return <section className="card appearance-editor"><div className="card-header"><div><h2 className="card-title">Make the workspace yours.</h2><p className="page-subtitle">Eight curated looks. Twelve palettes. Fine control over every surface.</p></div></div><div className="card-body">
    {!practiceMode&&<label className="field"><span className="label">Apply to</span><select className="input" value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="global">Platform default & sign-in screen</option>{practices.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {loading?<p role="status">Loading appearance…</p>:<>
      {inherited&&<p className="alert-info">Your practice follows the platform default. Saving creates a practice-specific appearance.</p>}
      {!canEdit&&<p className="alert-info">Preview the collection here. A practice administrator can save a theme for everyone.</p>}
      <fieldset className={styles.fieldset} disabled={busy}><legend className="label">THE SIGNATURE COLLECTION</legend><div className={styles.collection}>{THEME_COLLECTION.map(preset=>{
        const picked=JSON.stringify(theme)===JSON.stringify(preset.settings);
        return <button type="button" className={styles.tile} key={preset.name} aria-pressed={picked} onClick={()=>preview(preset.settings)}>
          <span className={`${styles.mini} ${styles[preset.settings.finish]}`} style={{'--preview-accent':preset.settings.color} as React.CSSProperties} aria-hidden="true"><span className={styles.miniSidebar}><i/><i/><i/></span><span className={styles.miniBody}><span className={styles.miniLine}/><span className={styles.miniBanner}/><span className={styles.miniStats}><i/><i/><i/></span></span></span>
          <span className={styles.tileLabel}><strong>{preset.name}</strong><span>{picked?'Selected':preset.description}</span></span></button>;
      })}</div></fieldset>
      <fieldset disabled={busy} className="appearance-fields"><legend className="label">REFINE YOUR LOOK</legend><div className="theme-swatches">{PRESETS.map(p=><button key={p.color} type="button" aria-pressed={theme.color===p.color} className="theme-swatch" onClick={()=>preview({...theme,color:p.color})}><span style={{background:p.color}}/>{p.name}</button>)}</div>
        <div className="appearance-options"><label className="field"><span className="label">Custom accent</span><input className="input" type="color" value={theme.color} onChange={e=>preview({...theme,color:e.target.value})}/><small>{theme.color.toUpperCase()}</small></label>
          <label className="field"><span className="label">Surface finish</span><select className="input" value={theme.finish} onChange={e=>preview({...theme,finish:e.target.value as Appearance['finish']})}><option value="solid">Classic solid</option><option value="glass">Frosted glass</option><option value="satin">Pearl satin</option><option value="linen">Warm linen</option></select></label>
          <label className="field"><span className="label">Corners</span><select className="input" value={theme.radius} onChange={e=>preview({...theme,radius:e.target.value as Appearance['radius']})}><option value="soft">Soft rounded</option><option value="square">Crisp square</option></select></label>
          <label className="field"><span className="label">Workspace spacing</span><select className="input" value={theme.density} onChange={e=>preview({...theme,density:e.target.value as Appearance['density']})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
        </div></fieldset>
      <div className={styles.saveBar}><div><strong>{JSON.stringify(theme)===JSON.stringify(saved)?'Your saved appearance':'Previewing changes'}</strong><p>Clinical status colours and printed documents retain their meaning.</p></div><div className="page-actions"><button type="button" disabled={busy} className="btn btn-secondary" onClick={()=>{setTheme(saved);applyAppearance(saved);setNotice('Saved appearance restored.');}}>Discard preview</button><button type="button" disabled={busy||!canEdit} className="btn btn-primary" onClick={()=>void save()}>{busy?'Saving…':'Save appearance'}</button></div></div>
      {canEdit&&<button type="button" disabled={busy} className={styles.reset} onClick={()=>{if(window.confirm('Restore the default appearance for this selection?'))void save(true);}}>Restore default appearance</button>}
    </>}{notice&&<p className="alert-success" role="status">{notice}</p>}{error&&<p className="alert-error" role="alert">{error}</p>}
  </div></section>;
}
