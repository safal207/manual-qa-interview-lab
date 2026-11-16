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
