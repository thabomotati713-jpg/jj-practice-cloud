const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>imports[name] || require(name),console,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'}}});
 return exports;
}
const specialties=load('lib/specialties.ts',{});
const medication=load('lib/medication-catalog.ts',{});
const catalogs=load('lib/specialty-catalog.ts',{'./medication-catalog':medication});
for(const spec of specialties.SPECIALTIES) {
 const rows=catalogs.SPECIALTY_CATALOGS[spec.id];
 assert(rows.length>0);
 assert.equal(new Set(rows.map(x=>x.name.toLowerCase())).size,rows.length);
}
const optical=catalogs.SPECIALTY_CATALOGS.optical;
for(const category of ['Frames','Lenses','Contact Lenses','Accessories']) assert(optical.some(x=>x.category===category));
let role='owner', active=true, lookupError=null, stored=[], writes=0;
const client={auth:{getUser:async()=>({data:{user:{id:'user',email:'a@test'}}})},from(table){
 assert(['profiles','practices','staff','inventory_products'].includes(table),`Unexpected table ${table}`);
 const q={select(){return q},eq(){return q},order(){return q},range(start,end){return {then(resolve){resolve({data:stored.slice(start,end+1),error:lookupError})}}},single:async()=>({data:table==='profiles'?{role,active:true,practice_id:'practice'}:{active}}),maybeSingle:async()=>({data:{specialty:'optical'}}),then(resolve){resolve({data:stored,error:lookupError})},upsert(rows,opts){
 assert.equal(opts.onConflict,'practice_id,product_code');assert.equal(opts.ignoreDuplicates,true);
 writes++;const added=rows.filter(x=>!stored.some(y=>y.product_code===x.product_code));stored.push(...added);return {select:async()=>({data:added.map((_,i)=>({id:i})),error:null})};}};return q;
}};
const {POST}=load('app/api/inventory/seed-starter/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},'@supabase/supabase-js':{createClient:()=>client},'@/lib/specialties':specialties,'@/lib/specialty-catalog':catalogs,'@/lib/medication-catalog':medication});
const request=(specialty='optical',auth=true)=>({headers:{get:()=>auth?'Bearer test':null},text:async()=>JSON.stringify({specialty})});
(async()=>{
 assert.equal((await POST(request('optical',false))).status,401);
 role='reception';assert.equal((await POST(request())).status,403);role='inventory';
 active=false;assert.equal((await POST(request())).status,403);active=true;
 assert.equal((await POST(request('invalid'))).status,400);
 lookupError={message:'test'};assert.equal((await POST(request())).status,500);assert.equal(writes,0);lookupError=null;
 const result=await POST(request());assert.equal(result.status,200);assert.equal(result.body.added,optical.length);
 assert(stored.every(x=>x.practice_id==='practice' && x.current_stock===0 && x.purchase_price===0 && x.selling_price===0));
 stored[0].current_stock=9;stored[0].selling_price=123;
 assert.equal((await POST(request())).body.added,0);assert.equal(stored[0].current_stock,9);assert.equal(stored[0].selling_price,123);
 assert.equal((await POST(request('dental'))).body.added,catalogs.SPECIALTY_CATALOGS.dental.length);
 const medRequest=(names)=>({headers:{get:()=> 'Bearer test'},text:async()=>JSON.stringify({medications:names})});
 assert.equal((await POST(medRequest(['made-up drug']))).status,400);
 assert.equal((await POST(medRequest([]))).status,400);
 assert.equal((await POST(medRequest('not an array'))).status,400);
 const selected=medication.MEDICATION_CATALOG.slice(0,3).map(x=>x.name);
 assert.equal((await POST(medRequest(selected))).body.added,3);
 assert.equal((await POST(medRequest(selected))).body.added,0);
 assert(stored.find(x=>x.name===selected[0]).strength);
 // A duplicate beyond row 1,000 must be preserved with its price and stock.
 stored=Array.from({length:1100},(_,i)=>({name:'Existing '+i,product_code:'P'+i}));
 stored.push({name:selected[0],product_code:'tail',current_stock:23,selling_price:75});
 assert.equal((await POST(medRequest([selected[0]]))).body.added,0);
 assert.equal(stored[1100].current_stock,23);assert.equal(stored[1100].selling_price,75);
 // Legacy names without spaces or dosage form do not get duplicate templates.
 stored=[{name:'Amoxicillin 500mg',product_code:'legacy',current_stock:10}];
 const amoxicillin=medication.MEDICATION_CATALOG.find(x=>x.name.startsWith('Amoxicillin 500 mg'));
 assert.equal((await POST(medRequest([amoxicillin.name]))).body.added,0);

 console.log('PASS: all catalogues, optical categories, auth, roles, inactive practice, invalid selection, lookup failure, duplicate reload and stock preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
