/* Execute the real control-page handlers and transport functions without hardware. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'yogo.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function section(start, end) {
  const a = page.indexOf(start), b = page.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return page.slice(a, b);
}
function fn(name) {
  const match = page.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n\\}'));
  assert(match, name);
  return match[0];
}
function harness(seed = {}) {
  const storage = new Map(Object.entries(seed)), elements = new Map(), timers = new Map();
  const calls = [], configs = [], previews = {};
  let nextTimer = 1;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', handlers: {}, classList: { toggle() {} },
      addEventListener(type, action) { (this.handlers[type] ||= []).push(action); },
      dispatch(type) { for (const action of this.handlers[type] || []) action(); }
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    $: element,
    setTimeout: action => { const id = nextTimer++; timers.set(id, action); return id; },
    clearTimeout: id => timers.delete(id),
    kbCall: async (url, data) => { calls.push({ url, data: plain(data) }); return {}; },
    patchConfig: async config => { configs.push(plain(config)); },
    drawPreview: frame => { previews.dot = plain(frame); },
    drawKeyboard: frame => { previews.kb = plain(frame); },
    markAsleep() {},
  });
  vm.runInContext(`
    const KB_N=84, BL_STREAM=254, DS_CUSTOM=6;
    const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
    let MODE='theme', FW_FX=null, dev={}, RAW=true, GAIN_DOT=false;
    let frames=0,pushOK=0,lastErr='',streamOn=null,streamTask=Promise.resolve(),lightNow='cached';
    let vibeKb='test',vibeSig='cached',calTest=false,THEME='test',ART_PICK=null;
    const pixels=Array.from({length:6},()=>Array.from({length:6},()=>[200,100,50]));
    const keys=Array.from({length:84},()=>[255,128,64]);
    const THEMES={test:{dot:pixels,kb:()=>keys}},STATICS={};
    const blank=()=>Array.from({length:6},()=>Array.from({length:6},()=>[0,0,0]));
    const rows2rgb=rows=>rows,gr=c=>c,ledize=c=>c;
    const paintCal=()=>pushKeys(keys);
    async function applyTheme(){if(await enterStreamMode()){await pushKeys(keys);await pushMatrix(pixels);}}
    async function applyMode(){await applyTheme();}
    function vibePaint(){return applyTheme();}
  ` + fn('brightnessPercent') + fn('storedBrightness') +
    section('let KB_BRIGHT=', '/* 通道增益') +
    ['matrixFrame','keyboardFrame','pushMatrix','_pushMatrix','pushKeys','streamConfig','enterStreamMode'].map(fn).join('\n') +
    section('/* 两路独立亮度：', '/* 白平衡校准 */') +
    section('/* 熄灯快捷键与键盘亮度', '/* 休眠时长 */'), context);
  return {
    context, storage, configs, calls, previews, element,
    run: expression => vm.runInContext(expression, context),
    async flush() { while (timers.size) {
      const pending = [...timers.values()]; timers.clear();
      for (const action of pending) await action();
    } },
    async input(id, value, event='input') {
      const el = element(id); el.value=String(value); el.dispatch(event); await this.flush();
    }
  };
}
async function run() {
  let scenarios = 0;
  for (const [id, type] of [['dotBr','range'],['kbBr','range'],['dotBrV','number'],['kbBrV','number']]) {
    const tag=page.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'))[0];
    for (const attr of ['type="'+type+'"','min="0"','max="100"','step="1"']) assert(tag.includes(attr), id+': '+attr);
  }
  scenarios++;
  for (const [kb,dot] of [[0,0],[0,100],[100,0],[1,73],[37,82]]) {
    const h=harness({yogo_kbbr:String(kb),yogo_dotbr:String(dot)});
    assert.equal(h.run('KB_BRIGHT'),kb); assert.equal(h.run('DOT_BRIGHT'),dot);
    assert.equal(h.element('kbBrV').value,String(kb)); assert.equal(h.element('dotBrV').value,String(dot));
    scenarios++;
  }
  const h=harness({yogo_kbbr:'62',yogo_dotbr:'43'});
  await h.input('kbBr',0);
  assert.equal(h.storage.get('yogo_dotbr'),'43'); assert.equal(h.element('kbBrV').value,'0');
  assert.equal(h.configs.at(-1).blMode,0); assert.equal(h.configs.at(-1).blBright,0);
  assert.equal(h.configs.at(-1).dsBright,90); assert(h.previews.kb.flat().every(v=>v===0));
  assert(h.calls.at(-1).data.rgb.some(v=>v>0)); scenarios++;
  await h.input('dotBrV',0,'change');
  assert.equal(h.configs.at(-1).blMode,0); assert.equal(h.configs.at(-1).dsBright,0);
  assert(h.calls.at(-1).data.rgb.every(v=>v===0)); scenarios++;
  await h.input('dotBr',37);
  assert.equal(h.configs.at(-1).blMode,0); assert.equal(h.storage.get('yogo_kbbr'),'0');
  assert.equal(h.element('dotBrV').value,'37'); assert(h.previews.dot.flat(2).some(v=>v>0)); scenarios++;
  await h.input('dotBr',0);
  await h.input('kbBrV',100,'change');
  assert.equal(h.configs.at(-1).blMode,254); assert.equal(h.configs.at(-1).dsBright,0);
  const sentKeys=h.calls.filter(c=>c.url==='/kb/keys').at(-1).data.rgb565;
  assert.equal(sentKeys.length,168); assert(sentKeys.some(v=>v>0));
  assert(h.calls.filter(c=>c.url==='/kb/matrix').at(-1).data.rgb.every(v=>v===0)); scenarios++;
  await h.input('kbBr',1);
  assert.equal(h.storage.get('yogo_kbbr'),'1');
  assert(h.calls.filter(c=>c.url==='/kb/keys').at(-1).data.rgb565.some(v=>v>0)); scenarios++;
  // Repainting / reconnecting must preserve the muted screen and keyboard percentage.
  h.run('streamOn=null'); await h.run('applyTheme()');
  assert.equal(h.configs.at(-1).dsBright,0); assert.equal(h.run('KB_BRIGHT'),1); scenarios++;
  // Firmware brightness must follow the keyboard value without affecting the screen.
  const f=harness({yogo_kbbr:'63',yogo_dotbr:'0'}); f.run('FW_FX=13');
  await f.run('applyBrightness()');
  assert.equal(f.configs.at(-1).blMode,13); assert.equal(f.configs.at(-1).blBright,63);
  assert.equal(f.configs.at(-1).dsBright,0);
  await f.input('kbBrV',0,'change'); assert.equal(f.configs.at(-1).blMode,0);
  await f.input('dotBrV',81,'change'); assert.equal(f.configs.at(-1).blMode,0);
  await f.input('kbBr',100); assert.equal(f.configs.at(-1).blMode,13); assert.equal(f.configs.at(-1).blBright,100);
  scenarios++;
  // The shortcut remembers the last positive value and only changes the keyboard.
  const b=harness({yogo_kbbr:'37',yogo_dotbr:'83'});
  b.element('kbOff').dispatch('click'); await b.flush();
  assert.equal(b.run('KB_BRIGHT'),0); assert.equal(b.run('DOT_BRIGHT'),83);
  b.element('kbOff').dispatch('click'); await b.flush();
  assert.equal(b.run('KB_BRIGHT'),37); assert.equal(b.element('kbBrV').value,'37'); scenarios++;
  const migrated=harness({yogo_kboff:'1',yogo_kbbr:'44',yogo_dotbr:'21'});
  assert.equal(migrated.run('KB_BRIGHT'),0); assert.equal(migrated.run('DOT_BRIGHT'),21);
  assert.equal(migrated.storage.get('yogo_kbbr'),'0'); assert.equal(migrated.storage.has('yogo_kboff'),false);
  migrated.element('kbOff').dispatch('click'); await migrated.flush(); assert.equal(migrated.run('KB_BRIGHT'),44); scenarios++;
  for (const [input,expected] of [[-1,0],[150,100],[48.6,49],['invalid',49]]) {
    await b.input('dotBrV',input,'change'); assert.equal(b.run('DOT_BRIGHT'),expected);
    assert.equal(b.run('KB_BRIGHT'),37); scenarios++;
  }
  // Concurrent callers must share the updated configuration, never leave an old off state cached.
  const c=harness({yogo_kbbr:'50',yogo_dotbr:'0'});
  await Promise.all([c.run('enterStreamMode()'),c.run('enterStreamMode()'),c.run('enterStreamMode()')]);
  assert.equal(c.configs.length,1); assert.equal(c.configs[0].dsBright,0); scenarios++;
  const before=c.configs.length; await c.input('kbBr',75);
  assert.equal(c.configs.length,before,'software scaling should not rewrite unchanged hardware configuration'); scenarios++;
  for (const script of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  return {scenarios, result:'independent 0–100% brightness passed'};
}
module.exports=run;
if(require.main===module)run().then(result=>console.log(result)).catch(error=>{console.error(error);process.exitCode=1;});
