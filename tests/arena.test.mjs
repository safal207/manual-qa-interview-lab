import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function boot(){const ctx={document:{createElement:()=>({dataset:{}}),querySelector:()=>({appendChild(){}})},window:{},localStorage:{getItem:()=>null},render(){},state:{mode:'cards'}};vm.createContext(ctx);vm.runInContext(read('arena.js'),ctx);return ctx.window.QAArena}
test('four scenarios with three rounds and complete branching response coverage',()=>{const {scenarios}=boot();assert.equal(scenarios.length,4);assert.equal(new Set(scenarios.map(c=>c.id)).size,4);for(const c of scenarios){assert.equal(c.rounds.length,3);c.rounds.forEach((r,i)=>{assert.equal(r.q.length,i?3:1);assert.equal(r.opts.length,3);for(const opt of r.opts){assert.equal(opt.length,4);assert.ok(opt.slice(0,3).every(Boolean));assert.equal(opt[3].length,3);assert.ok(opt[3].every(n=>Number.isInteger(n)&&n>=-1&&n<=2))}})}});
test('strategy score is additive including negative feedback',()=>{const {score}=boot();assert.equal(JSON.stringify(score([{delta:[2,1,1]},{delta:[0,-1,-1]},{delta:[1,2,2]}])),'[3,2,2]')});
test('arena assets wired into local shell',()=>{const sw=read('voice-sw.js'),html=read('index.html');assert.match(html,/src="arena\.js"/);assert.match(html,/href="arena\.css"/);assert.ok(sw.includes("'./arena.js'")&&sw.includes("'./arena.css'"));new vm.Script(read('arena.js'))});

test('complete graph state-transition matrix: 266 terminal paths, no invalid or duplicate advances',()=>{
 const g=boot();let paths=0,edges=0,terminal3=0,terminal4=0;const nodes=new Set(),rules=new Set(),repair={trust:0,evidence:0,clarity:0};
 function visit(c,s){
  if(g.sessionPhase(s)==='COMPLETE'){paths++;if(s.answers.length===3)terminal3++;else if(s.answers.length===4)terminal4++;else assert.fail('unexpected terminal length');assert.equal(g.transition(c,s,{type:'CHOOSE',choice:0}),null);assert.equal(g.transition(c,s,{type:'ADVANCE'}),null);return}
  assert.equal(g.sessionPhase(s),'AWAIT_ANSWER');const n=g.nodeFor(c,s.answers,s.round,2);assert.ok(n);nodes.add(n.id);rules.add(n.rule);if(s.round===3)repair[n.id.split(':').pop()]++;
  assert.equal(g.transition(c,s,{type:'ADVANCE'}),null);assert.equal(g.transition(c,s,{type:'CHOOSE',choice:99}),null);const before=JSON.stringify(s);
  for(let i=0;i<3;i++){const a=g.transition(c,s,{type:'CHOOSE',choice:i});assert.equal(g.sessionPhase(a),'REVIEW');assert.equal(a.answers.at(-1).nodeId,n.id);assert.equal(g.transition(c,a,{type:'CHOOSE',choice:i}),null);const b=g.transition(c,a,{type:'ADVANCE'});assert.ok(b);assert.equal(a.answers.length,b.answers.length);assert.equal(JSON.stringify(s),before);edges+=2;visit(c,b)}
 }
 for(const c of g.scenarios)visit(c,{id:c.id,graphVersion:2,round:0,answers:[],draft:'',complete:false});
 assert.deepEqual({paths,edges,terminal3,terminal4,nodes:nodes.size,rules:rules.size,repair},{paths:266,edges:786,terminal3:29,terminal4:237,nodes:38,rules:7,repair:{trust:70,evidence:6,clarity:3}});
});
test('legacy sessions keep three rounds and low-score version-two sessions add one repair',()=>{
 const g=boot(),c=g.scenarios[0];for(const version of [1,2]){let s={id:c.id,graphVersion:version,round:0,answers:[],draft:'',complete:false};while(!s.complete){s=g.transition(c,s,{type:'CHOOSE',choice:2});s=g.transition(c,s,{type:'ADVANCE'})}assert.equal(s.answers.length,version===1?3:4)}
});

test('v3 matrix is deterministic and prioritizes critical trust over competing risks',()=>{
 const g=boot();assert.equal(g.GRAPH_VERSION,3);
 const answers=[{choice:2,delta:[0,-1,-1]},{choice:1,delta:[0,-1,0]}];
 const v=g.stateMatrix(answers);assert.equal(v.trust,-2);assert.equal(v.evidence,-1);
 assert.equal(g.selectFocus(answers).rule,'TRUST_CRITICAL');
 assert.equal(g.nodeFor(g.scenarios[0],answers,2,3).rule,'TRUST_CRITICAL');
 const r=g.nodeFor(g.scenarios[0],answers,3,3);assert.match(r.id,/repair:trust/);
 assert.equal(g.selectFocus([]).rule,'TRUST_WEAK');
});
test('v3 scenario advice uses bounded local history, prioritizes weak skill',()=>{
 const g=boot();assert.equal(g.scenarioAdvice([]).id,'unknown');
 const a=g.scenarioAdvice([{id:'salary',scores:[6,-2,6]},{id:'cafe',scores:[5,-1,4]}]);
 assert.equal(a.focus,'trust');assert.equal(a.observations,2);
 assert.ok(g.scenarios.some(s=>s.id===a.id));
 assert.equal(g.scenarioAdvice([{id:'unknown',scores:[0,5,5]}]).focus,'clarity');
});
test('v3 transitions preserve version 2 and support remediation after round three',()=>{
 const g=boot(),c=g.scenarios[0];for(const version of [2,3]){let s={id:c.id,graphVersion:version,round:0,answers:[],draft:'',complete:false};let safety=0;while(!s.complete){assert.ok(++safety<6);const n=g.nodeFor(c,s.answers,s.round,version);assert.ok(n);s=g.transition(c,s,{type:'CHOOSE',choice:2});assert.equal(s.answers.at(-1).nodeId,n.id);s=g.transition(c,s,{type:'ADVANCE'})}assert.equal(s.answers.length,4)}
});
