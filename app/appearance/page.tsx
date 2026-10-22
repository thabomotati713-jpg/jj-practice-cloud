'use client';
import Link from 'next/link';
import Image from 'next/image';
import AppearanceEditor from '@/components/AppearanceEditor';
import styles from '@/components/clinical-library.module.css';
export default function AppearanceStudio(){
  return <main className="page-shell"><header className="app-header"><div className="app-header-inner"><Link href="/dashboard" className="app-brand"><Image className="app-brand-logo" src="/logo.jpg" alt="" width={44} height={44} unoptimized/><span className="app-brand-name">J&J Practice Cloud</span></Link><div className="page-actions"><Link href="/settings" className="btn btn-secondary btn-sm">Settings</Link><Link href="/dashboard" className="btn btn-secondary btn-sm">Dashboard</Link></div></div></header><div className="page-inner"><section className={styles.hero}><div className={styles.eyebrow}>APPEARANCE STUDIO</div><h1>Your practice. Your signature.</h1><p>A considered collection of colours, surfaces and layouts. Preview instantly, then save the look that feels right for your team.</p></section><AppearanceEditor practiceMode/></div></main>;
}
