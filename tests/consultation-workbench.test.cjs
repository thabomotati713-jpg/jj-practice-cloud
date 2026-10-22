const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/consultation-workbench.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:e,TextEncoder,Set,Error});
test('16 templates contain prompts, with no invented measurements or diagnosis defaults',()=>{
 assert.equal(e.VISIT_TEMPLATES.length,16);assert.equal(new Set(e.VISIT_TEMPLATES.map(x=>x.id)).size,16);
 const permitted=['history_of_present_illness','examination','treatment','follow_up_notes'];
 for(const t of e.VISIT_TEMPLATES){assert(Object.keys(t.fields).every(k=>permitted.includes(k)));assert(Object.values(t.fields).every(x=>x.includes(':')));assert(!JSON.stringify(t.fields).match(/no known allergies|afebrile|normal examination|120\/80|36\.5|500mg/i));}
});
test('prefill only fills blank fields and preserves authored notes',()=>{
 const current={history_of_present_illness:'Patient-specific history',examination:'',treatment:'Existing agreed plan',follow_up_notes:'  '};
 const result=e.fillEmptyNotes(current,e.VISIT_TEMPLATES[0]);assert.equal(result.history_of_present_illness,current.history_of_present_illness);assert.equal(result.treatment,current.treatment);assert(result.examination);assert(result.follow_up_notes.trim());assert.equal(current.examination,'');
});
test('record context distinguishes absent information from negative findings',()=>{
 const text=e.patientContext(null,'');assert(text.includes('Not recorded'));assert(!text.includes('No allergies'));assert(e.patientContext('Penicillin','Diabetes').includes('Penicillin'));
});
test('40 test presets create planned entries without fabricated results or dates',()=>{
 assert.equal(e.TEST_CATALOG.length,40);
 for(const [name,category] of e.TEST_CATALOG){const row=e.newInvestigation(name,category,'test-id');assert.equal(row.status,'planned');assert.equal(row.result,'');assert.equal(row.performed_on,'');assert.equal(row.unit,'');}
});
test('encounter draft round-trip preserves investigations and unreviewed text',()=>{
 const d=e.emptyEncounter();d.tests.push(e.newInvestigation('ECG','Assessment','id'));d.transcript.text='Unreviewed wording';
 assert.equal(JSON.stringify(e.parseEncounter(JSON.stringify(d))),JSON.stringify(d));assert.match(e.validateEncounter(d),/Review/);
 d.transcript.reviewed=true;assert.equal(e.validateEncounter(d),null);assert.throws(()=>e.parseEncounter('{bad'),/could not be read/);
});
test('completion requires a result for resulted tests, review, unique IDs and bounded text',()=>{
 const d=e.emptyEncounter();const row=e.newInvestigation('Test','Other','id');row.status='resulted';d.tests=[row];assert.match(e.validateEncounter(d),/Enter the result/);
 row.result='Actual report';assert.equal(e.validateEncounter(d),null);d.tests.push({...row});assert.match(e.validateEncounter(d),/Duplicate/);d.tests.pop();
 d.transcript.text='x'.repeat(20001);assert.match(e.validateEncounter(d),/20,000/);
});
test('speech event collection never repeats a final phrase and keeps interim words separate',()=>{
 const seen=new Set();const first=[{isFinal:true,0:{transcript:'Patient reports'}},{isFinal:false,0:{transcript:'head'}}];
 const a=e.collectSpeech(first,seen);assert.equal(a.final,'Patient reports');assert.equal(a.interim,'head');
 const b=e.collectSpeech([{isFinal:true,0:{transcript:'Patient reports'}},{isFinal:true,0:{transcript:'headache'}}],seen);assert.equal(b.final,'headache');
 assert.equal(e.collectSpeech(first,seen).final,'');
});

test('corrupt saved shapes are rejected instead of replaced with blank details',()=>{
 for(const value of [[],['bad'],{version:1,tests:[{}],transcript:{text:''}},{...e.emptyEncounter(),transcript:{text:'words'}}]) assert.throws(()=>e.parseEncounter(value));
});
test('invalid investigation dates and overlong specimen metadata block completion',()=>{
 const d=e.emptyEncounter();d.tests=[e.newInvestigation('Test','Other','id')];
 d.tests[0].performed_on='2026-02-30';assert.match(e.validateEncounter(d),/valid date/);
 d.tests[0].performed_on='2026-02-28';assert.equal(e.validateEncounter(d),null);
 d.tests[0].specimen='x'.repeat(101);assert.match(e.validateEncounter(d),/Shorten/);
});

test('previous-visit dates use the South African clinical day rather than the UTC day',()=>{
 const ref=e.previousVisitReference({date:'2026-10-21T22:00:00Z',diagnosis:'Prior diagnosis',treatment:null});
 assert(ref.includes('(2026-10-22)'));assert(ref.includes('reference only; reassess today'));assert(ref.includes('Not recorded'));
});
