import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const boot=()=>{const tab={dataset:{}};const c={document:{createElement:()=>tab,querySelector:()=>({appendChild(){}})},window:{},localStorage:{getItem:()=>null},render(){},state:{mode:'cards'}};vm.createContext(c);vm.runInContext(read('visual.js'),c);return c.window.QAVisual};
test('seven unique visual lessons with valid answer and conceptual diagram contracts',()=>{const {cards}=boot();assert.equal(cards.length,7);assert.equal(new Set(cards.map(c=>c.id)).size,7);for(const c of cards){assert.ok(c.summary&&c.recall&&c.prompt&&c.why);assert.equal(c.options.length,3);assert.ok(c.correct>=0&&c.correct<3);if(c.nodes){for(const [a,b] of c.edges){assert.ok(c.nodes[a]&&c.nodes[b])}}else assert.ok(['join','boundary','matrix'].includes(c.kind))}});
test('visual recall review interval and local cache contract',()=>{const {record,pick}=boot();assert.ok(pick(1000));assert.equal(record(null,false,1000).due,1201000);assert.equal(record(null,true,1000).due,86401000);const sw=read('voice-sw.js'),html=read('index.html');assert.ok(sw.includes("'./visual.js'")&&sw.includes("'./visual.css'"));assert.match(html,/src="visual\.js"/);assert.match(html,/href="visual\.css"/)});
