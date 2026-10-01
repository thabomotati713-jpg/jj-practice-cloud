'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '../lib/supabase';
import {applyAppearance,isAppearance} from '../lib/appearance';
export default function AppearanceProvider() {
  const pathname=usePathname();
  useEffect(()=>{
    let disposed=false, version=0;
    async function refresh() {
      const current=++version;
      try {
        const {data:{session}}=await supabase.auth.getSession();
        const response=await fetch('/api/appearance',{headers:session?{Authorization:`Bearer ${session.access_token}`}:{},cache:'no-store'});
        const result=await response.json();
        if(!disposed&&current===version&&response.ok&&isAppearance(result.settings)) applyAppearance(result.settings);
      } catch { /* Preserve readable default styling if offline. */ }
    }
    void refresh();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0);});
    const visible=()=>{if(document.visibilityState==='visible') void refresh();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('appearance-saved',refresh);
    return ()=>{disposed=true;subscription.unsubscribe();document.removeEventListener('visibilitychange',visible);window.removeEventListener('appearance-saved',refresh);};
  },[pathname]);
  return null;
}
