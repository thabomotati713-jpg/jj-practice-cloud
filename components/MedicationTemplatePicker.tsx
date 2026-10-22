'use client';
import { useState } from 'react';
import { MEDICATION_CATALOG, type MedicationTemplate } from '@/lib/medication-catalog';
import styles from './clinical-library.module.css';
export default function MedicationTemplatePicker({onSelect}:{onSelect:(item:MedicationTemplate)=>void}){
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const rows=MEDICATION_CATALOG.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,8);
  return <details className="mb-4"><summary className="label cursor-pointer">Find a generic medication template</summary><div className="mt-3">
    <label className="field"><span className="label">Search the preloaded catalogue</span><input className="input" type="search" maxLength={100} value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} placeholder="Medicine name or strength" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();}if(e.key==='Escape')setOpen(false);}}/></label>
    {open&&<div className={styles.results}>{rows.map(row=><button type="button" key={row.name} className={styles.result} onClick={()=>{onSelect(row);setOpen(false);setQuery('');}}>{row.name}</button>)}{!rows.length&&<p className={styles.resultStatus}>No matching template. You can still enter a medicine manually.</p>}</div>}
    <p className={styles.source}>Fills the product name and strength only. Confirm the formulation and enter the patient’s dose, frequency and duration. Templates do not indicate available stock.</p>
  </div></details>;
}
