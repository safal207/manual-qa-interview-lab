import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function boot(){const c={document:{createElement:()=>({dataset:{}}),querySelector:()=>({appendChild(){}})},window:{},render(){},state:{mode:'cards'}};vm.createContext(c);vm.runInContext(read('skill-graph.js'),c);return c.window.QASkillGraph}
const modules={play:[{id:'basic',topic:'Теория QA',q:'QA'},{id:'api',topic:'API',q:'HTTP'},{id:'cash',topic:'Финтех',q:'Платежи'}],visual:[{id:'sql',topic:'SQL',title:'JOIN'}],voice:[{id:'pitch',lang:'ru',section:'Речь и самопрезентация',q:'Представься'},{id:'en',lang:'en',section:'QA English',q:'Explain HTTP'}],arena:[{id:'salary',title:'Оффер'}]};
const asJSON=x=>JSON.parse(JSON.stringify(x));
test('skill prerequisites are known and acyclic',()=>{const g=boot(),ids=new Set(g.skills.map(s=>s.id));assert.equal(ids.size,10);function walk(id,path){assert.ok(!path.includes(id));for(const dep of g.skills.find(s=>s.id===id).requires){assert.ok(ids.has(dep));walk(dep,[...path,id])}}for(const id of ids)walk(id,[])});
test('planner picks a prerequisite before fintech, honours due dates and separates evidence types',()=>{const g=boot(),items=g.catalog(modules),now=1000;assert.equal(items.length,7);const empty=g.snapshot(items,{},now);const first=g.plan(empty,'fintech');assert.ok(first.every(x=>x.reason.startsWith('FOUNDATION_')));assert.ok(first.some(x=>x.skill==='sql'));
 const stores={play:{records:{basic:{attempts:1,last:true,due:999999},api:{attempts:1,last:false,due:900}}},visual:{sql:{attempts:1,last:true,due:999999}},voice:{pitch:{grade:2,due:999999}},arena:{history:[{id:'salary',scores:[2,0,1],at:0}]}};
 const rows=g.snapshot(items,stores,now),rec=g.plan(rows,'fintech');assert.equal(rec[0].id,'api');assert.equal(rec[0].reason,'FOUNDATION_WEAK_DUE');assert.ok(!g.plan(rows).some(x=>x.id==='basic'||x.id==='sql'||x.id==='pitch'||x.id==='salary'));assert.equal(rows.find(x=>x.id==='speech').self[0].grade,2);assert.equal(rows.find(x=>x.id==='negotiation').scenario[0].lane,'scenario');assert.equal(rows.find(x=>x.id==='api').objective[0].last,false);
 assert.deepEqual(asJSON(g.plan(rows,'fintech')),asJSON(g.plan(rows,'fintech')));
});
test('coach is integrated into offline shell with exact exercise routes',()=>{const html=read('index.html'),sw=read('voice-sw.js');assert.match(html,/src="skill-graph\.js"/);assert.ok(sw.includes("'./skill-graph.js'")&&sw.includes("'./skill-graph.css'"));for(const p of ['play.js','visual.js','voice.js','arena.js'])assert.match(read(p),/open\(id\)/)});
