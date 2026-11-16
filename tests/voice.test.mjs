import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('voice scripts parse and all required local assets exist',()=>{
 const voice=read('voice.js'),sw=read('voice-sw.js'),html=read('index.html');
 new vm.Script(voice);new vm.Script(sw);
 assert.match(html,/src="voice\.js"/);assert.match(html,/href="manifest\.webmanifest"/);
 for(const p of ['index.html','learning.css','learning.js','simulator.css','simulator.js','coach.css','coach.js','voice.js','manifest.webmanifest','voice-icon.svg']){assert.ok(read(p).length);assert.ok(sw.includes("'./"+p+"'"))}
 const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
});
test('voice extension uses existing cards, local IndexedDB and manual scoring',()=>{
 const voice=read('voice.js');assert.match(voice,/allCards\.map/);assert.match(voice,/MediaRecorder/);assert.match(voice,/indexedDB\.open/);assert.match(voice,/getUserMedia/);assert.match(voice,/localStorage/);assert.doesNotMatch(voice,/\bfetch\s*\(|XMLHttpRequest|SpeechRecognition/);
 const match=voice.match(/const more=(\[.*?\])\.map\(/s);assert.ok(match);const bank=JSON.parse(match[1]);assert.equal(bank.length,23);assert.equal(new Set(bank.map(x=>x[2])).size,bank.length);
 for(const item of bank){assert.equal(item.length,5);assert.ok(item.slice(0,4).every(x=>typeof x==='string'&&x.length));assert.ok(item[4].length)}
});

test('redesigned entry retains a single bank counter and functional voice CTA wiring',()=>{
 const html=read('index.html'),voice=read('voice.js');
 assert.equal((html.match(/id="bankCount"/g)||[]).length,1);
 assert.match(html,/id="startVoicePractice"/);assert.ok(html.includes("onclick=()=>openMode('voice')"));
 assert.match(html,/dataset\.studyMode=state\.mode/);
 assert.match(voice,/class="voice-recorder"/);assert.match(voice,/class="voice-grade"/);
 assert.match(voice,/panel\.dataset\.phase=phase/);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
});

test('English bank, local speech and recording history contracts',()=>{
 const voice=read('voice.js');const match=voice.match(/const englishMore=(\[.*?\])\.map\(/s);assert.ok(match);
 const bank=JSON.parse(match[1]);assert.equal(bank.length,10);assert.equal(new Set(bank.map(x=>x[1])).size,10);for(const row of bank){assert.equal(row.length,4);assert.ok(row[3].length)}
 assert.match(voice,/v\.localService&&v\.lang/);assert.match(voice,/SpeechSynthesisUtterance/);assert.match(voice,/playbackRate/);assert.match(voice,/MAX_ATTEMPTS=10/);assert.match(voice,/slice\(0,MAX_ATTEMPTS\)/);assert.match(voice,/voiceLanguage/);assert.match(voice,/voiceExport/);assert.match(voice,/voiceImport/);
});
test('legacy recordings remain playable and malformed attempt values are ignored',()=>{
 const voice=read('voice.js');const source=voice.slice(voice.indexOf('function normalizeAttempts('),voice.indexOf('async function storage('));const ctx={Blob};vm.createContext(ctx);vm.runInContext(source,ctx);const b=new Blob(['test']);const old=ctx.normalizeAttempts(b);assert.equal(old.length,1);assert.equal(old[0].blob,b);assert.equal(old[0].id,'legacy');assert.equal(ctx.normalizeAttempts([{id:'ok',blob:b},{id:'bad',blob:'bad'},null]).length,1);assert.equal(ctx.normalizeAttempts(undefined).length,0);
});

test('guided speech begins with an example and separates knowledge from listening',()=>{
 const voice=read('voice.js'),html=read('index.html'),sw=read('voice-sw.js');
 const match=voice.match(/const speechMore=(\[.*?\])\.map\(/s);assert.ok(match);const rows=JSON.parse(match[1]);assert.equal(rows.length,6);assert.equal(new Set(rows.map(x=>x[1])).size,6);
 assert.match(voice,/training='guided'/);assert.match(voice,/guideStage!==4/);assert.match(voice,/qaSpeechGuideV1/);assert.match(voice,/confidence0/);assert.match(voice,/voiceSystemVoice/);assert.match(voice,/practice,blob:b/);assert.match(html,/href="speech\.css"/);assert.ok(sw.includes("'./speech.css'"));new vm.Script(voice);
});
