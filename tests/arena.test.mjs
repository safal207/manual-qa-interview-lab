import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function boot(){const ctx={document:{createElement:()=>({dataset:{}}),querySelector:()=>({appendChild(){}})},window:{},localStorage:{getItem:()=>null},render(){},state:{mode:'cards'}};vm.createContext(ctx);vm.runInContext(read('arena.js'),ctx);return ctx.window.QAArena}
test('four scenarios with three rounds and complete branching response coverage',()=>{const {scenarios}=boot();assert.equal(scenarios.length,4);assert.equal(new Set(scenarios.map(c=>c.id)).size,4);for(const c of scenarios){assert.equal(c.rounds.length,3);c.rounds.forEach((r,i)=>{assert.equal(r.q.length,i?3:1);assert.equal(r.opts.length,3);for(const opt of r.opts){assert.equal(opt.length,4);assert.ok(opt.slice(0,3).every(Boolean));assert.equal(opt[3].length,3);assert.ok(opt[3].every(n=>Number.isInteger(n)&&n>=-1&&n<=2))}})}});
test('strategy score is additive including negative feedback',()=>{const {score}=boot();assert.equal(JSON.stringify(score([{delta:[2,1,1]},{delta:[0,-1,-1]},{delta:[1,2,2]}])),'[3,2,2]')});
test('arena assets wired into local shell',()=>{const sw=read('voice-sw.js'),html=read('index.html');assert.match(html,/src="arena\.js"/);assert.match(html,/href="arena\.css"/);assert.ok(sw.includes("'./arena.js'")&&sw.includes("'./arena.css'"));new vm.Script(read('arena.js'))});
