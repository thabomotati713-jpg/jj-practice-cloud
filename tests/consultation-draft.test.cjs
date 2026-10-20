const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/consultationDraft.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }}).outputText, { exports: exportsObject, Object, JSON, Error, Promise });
const { ConsultationDraftSession, draftSnapshot } = exportsObject;

test('serial saves preserve the newest edit and finalisation waits for pending autosaves', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const calls = [];
  const rpc = async (name,args) => {
    calls.push([name,args]);
    if (calls.length === 1) await blocked;
    return { data: name === 'pc_finalize_consultation' ? 'visit-id' : {revision: args.p_revision + 1}, error: null };
  };
  const session = new ConsultationDraftSession(rpc,'visit-id','patient-id',null,{});
  const a = session.save({clinical_notes:'first'});
  const b = session.save({clinical_notes:'second'});
  const final = session.finalize({clinical_notes:'latest'});
  release();
  await Promise.all([a,b]);
  assert.equal(await final,'visit-id');
  assert.deepEqual(calls.map(c=>c[0]),['pc_save_consultation_draft','pc_save_consultation_draft','pc_save_consultation_draft','pc_finalize_consultation']);
  assert.deepEqual(calls.slice(0,3).map(c=>c[1].p_revision),[0,1,2]);
  assert.equal(calls[3][1].p_data.clinical_notes,'latest');
  assert.equal(session.completed,true);
  await session.save({clinical_notes:'late save'});
  assert.equal(calls.length,4);
});

test('a conflicting tab cannot silently overwrite the newer draft', async () => {
  let calls=0;
  const session = new ConsultationDraftSession(async()=> { calls++;return {data:null,error:{code:'40001',message:'Newer draft exists'}}; },'id','p',null,{note:'old'},1);
  await assert.rejects(session.save({note:'edit'}),/Newer draft/);
  await assert.rejects(session.save({note:'another edit'}),/newer draft/);
  assert.equal(session.conflict,true);
  assert.equal(calls,1);
  assert.equal(session.persisted,draftSnapshot({note:'old'}));
});

test('a failed request leaves changes dirty and can be retried safely', async () => {
  let calls=0;
  const session = new ConsultationDraftSession(async()=> ++calls===1 ? {data:null,error:{message:'offline'}} : {data:{revision:1},error:null},'id','p',null,{});
  await assert.rejects(session.save({note:'recover me'}),/offline/);
  assert.equal(session.revision,0);
  assert.notEqual(session.persisted,draftSnapshot({note:'recover me'}));
  await session.save({note:'recover me'});
  assert.equal(session.revision,1);
  assert.equal(session.persisted,draftSnapshot({note:'recover me'}));
});

test('restored JSON key order does not trigger a new save', async () => {
  const session = new ConsultationDraftSession(async()=>{throw Error('should not save')},'id','p',null,{b:'2',a:'1'},3);
  await session.save({a:'1',b:'2'});
  assert.equal(session.revision,3);
});
