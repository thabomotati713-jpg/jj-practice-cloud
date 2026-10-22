const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const e = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/consultation-speech.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: e, Error });
let starts = 0, aborts = 0, created = 0;
class FakeSpeech {
  constructor() { created++; this.processLocally = false; }
  start() { starts++; }
  abort() { aborts++; }
}
test('on-device preparation forces local processing and never starts a microphone', async () => {
  FakeSpeech.available = async (options) => { assert.equal(options.processLocally, true); assert.equal(options.langs[0], 'en-ZA'); return 'available'; };
  const r = await e.prepareDictation(FakeSpeech, 'local', false, 'en-ZA');
  assert.equal(r.processLocally, true); assert.equal(r.lang, 'en-ZA'); assert.equal(starts, 0);
});
test('missing local support or language pack fails without remote fallback', async () => {
  class Legacy { start() { starts++; } }
  await assert.rejects(e.prepareDictation(Legacy, 'local', false, 'en-ZA'), /On-device/);
  FakeSpeech.available = async () => 'downloadable';
  await assert.rejects(e.prepareDictation(FakeSpeech, 'local', false, 'en-ZA'), /language pack/);
  assert.equal(starts, 0);
});
test('browser speech requires consent before constructing or starting recognition', async () => {
  const before = created;
  await assert.rejects(e.prepareDictation(FakeSpeech, 'browser_service', false, 'en-ZA'), /consent/);
  assert.equal(created, before);
  const r = await e.prepareDictation(FakeSpeech, 'browser_service', true, 'en-ZA');
  assert.equal(r.processLocally, false); assert.equal(starts, 0);
  await assert.rejects(e.prepareDictation(undefined, 'local', false, 'en-ZA'), /unavailable/);
});
test('abort detaches all event handlers before stopping recognition', () => {
  const r = new FakeSpeech(); r.onresult = () => {}; r.onerror = () => {}; r.onend = () => {};
  const before = aborts; e.abortDictation(r);
  assert.equal(aborts, before + 1); assert.equal(r.onresult, null); assert.equal(r.onerror, null); assert.equal(r.onend, null);
});
