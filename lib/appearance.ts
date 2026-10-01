export type Appearance = { color: string; finish: 'solid' | 'glass'; radius: 'soft' | 'square'; density: 'comfortable' | 'compact' };
export const DEFAULT_APPEARANCE: Appearance = { color: '#1f7c7a', finish: 'solid', radius: 'soft', density: 'comfortable' };
export const PRESETS = [
  { name: 'Clinical teal', color: '#1f7c7a' }, { name: 'Ocean blue', color: '#2563eb' },
  { name: 'Royal violet', color: '#7c3aed' }, { name: 'Forest green', color: '#15803d' },
  { name: 'Rose', color: '#be185d' }, { name: 'Warm gold', color: '#a16207' },
  { name: 'Slate', color: '#475569' },
];
export function isAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) && ['solid','glass'].includes(String(v.finish)) && ['soft','square'].includes(String(v.radius)) && ['comfortable','compact'].includes(String(v.density));
}
export function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  const rgb = [1,3,5].map(i => parseInt(value.color.slice(i,i+2),16));
  const mix = (target:number, weight:number) => '#' + rgb.map(c => Math.round(c*(1-weight)+target*weight).toString(16).padStart(2,'0')).join('');
  // Darken only the action colour until white labels have WCAG AA contrast.
  const luminance = (hex:string) => {
    const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  let action=value.color;
  for(let weight=0; luminance(action)>.183 && weight<=1; weight+=.05) action=mix(0,weight);
  const vars:Record<string,string> = {
    '--brand-50':mix(255,.95),'--brand-100':mix(255,.88),'--brand-200':mix(255,.75),'--brand-300':mix(255,.58),
    '--brand-400':mix(255,.3),'--brand-500':action,'--brand-600':action,'--brand-700':mix(0,.35),'--brand-800':mix(0,.55),'--brand-900':mix(0,.72),
    '--pc-accent':value.color,'--pc-action':action,'--pc-sidebar':mix(0,.76),'--pc-ink':mix(0,.8),'--pc-muted':mix(255,.08),
    '--pc-soft':mix(255,.94),'--pc-line':mix(255,.79),'--pc-wash':mix(255,.9),'--pc-page':mix(255,.97),
    '--pc-panel':value.finish==='glass'?'rgba(255,255,255,.73)':'#ffffff',
    '--pc-blur':value.finish==='glass'?'blur(20px) saturate(1.3)':'none',
    '--pc-radius':value.radius==='square'?'5px':'16px','--pc-space':value.density==='compact'?'12px':'20px',
    '--background':mix(255,.97),'--foreground':mix(0,.8),'--surface':value.finish==='glass'?'rgba(255,255,255,.73)':'#ffffff',
    '--border':mix(255,.79),'--border-soft':mix(255,.89),'--muted':'#52646b',
    '--glass-blur':value.finish==='glass'?'blur(20px) saturate(1.3)':'none',
    '--ambient':value.finish==='glass'?`radial-gradient(ellipse at 0% 0%, ${mix(255,.68)}, transparent 65%), radial-gradient(ellipse at 100% 60%, ${mix(255,.8)}, transparent 65%), ${mix(255,.97)}`:mix(255,.97),
  };
  Object.entries(vars).forEach(([key,val])=>root.style.setProperty(key,val));
  root.dataset.appearance = value.finish;
  root.dataset.density = value.density;
}
