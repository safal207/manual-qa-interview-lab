import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../simulator.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../simulator.css',import.meta.url),'utf8');

function fixture(){
  let writes=0;
  const workspace={innerHTML:'',querySelectorAll(){return [];}};
  const dom={
    getElementById(id){return id==='workspace'?workspace:null;},
    querySelectorAll(){return [];}
  };
  const context={
    document:dom,window:{},state:{mode:'cards'},
    saved:{simulator:{history:{},active:null}},
    save(){writes++;},
    esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),
    render(){}
  };
  runInNewContext(js,context);
  return {api:context.window.QASimulator,ctx:context,workspace,writes:()=>writes};
}

test('simulator module and styles parse and are linked from the HTML document',()=>{
  assert.doesNotThrow(()=>new Script(js,{filename:'simulator.js'}));
  assert.match(html,/data-mode="simulator"/);
  assert.match(html,/<script src="simulator\.js"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="simulator\.css">/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/prefers-reduced-motion/);
});

test('four complete scenarios include choices, consequences, evidence and evaluation criteria',()=>{
  const {api}=fixture();
  assert.equal(api.cases.length,4);
  assert.equal(new Set(api.cases.map(c=>c.id)).size,4);
  for(const c of api.cases){
    assert.ok(c.context.length>100);
    assert.equal(c.phases.length,3);
    assert.ok(c.model.length>=4);
    assert.ok(c.title.length>10);
    for(const phase of c.phases){
      assert.equal(phase.options.length,4);
      assert.ok(phase.question.length>20);
      for(const opt of phase.options){
        assert.ok(opt.label.length>20);
        assert.ok(opt.outcome.length>30);
        assert.ok(opt.evidence.length>25);
        assert.equal(opt.score.length,3);
        assert.ok(opt.score.every(n=>Number.isInteger(n)&&n>=0&&n<=2));
      }
    }
  }
});

test('safe evidence-based payment path gets deterministic transparent score',()=>{
  const {api,ctx,workspace,writes}=fixture();
  api.launch('payments');
  assert.equal(ctx.state.mode,'simulator');
  assert.match(workspace.innerHTML,/Двойное списание/);
  for(let step=0;step<3;step++){
    assert.equal(api.choose(0),true);
    assert.equal(api.choose(3),false,'cannot rewrite locked choice');
    assert.match(workspace.innerHTML,/Последствие выбора/);
    assert.equal(api.advance(),true);
  }
  assert.equal(api.store().active.phase,'defense');
  assert.match(workspace.innerHTML,/Техлид задаёт вопрос/);
  assert.equal(api.finalize(2),false,'rubric must be opened before self-rating');
  api.store().active.defense='Сверю PSP и ledger, приостановлю рискованный путь оплаты.';
  api.store().active.rubric=true;
  assert.equal(api.finalize(2),true);
  const result=api.store().history.payments;
  assert.equal(result.complete,true);
  assert.equal(result.total,18);
  assert.equal(result.percent,100);
  assert.equal(result.defense,'Сверю PSP и ledger, приостановлю рискованный путь оплаты.');
  assert.equal(result.selfRating,2);
  assert.ok(writes()>0);
  assert.match(workspace.innerHTML,/Разбор принятых решений/);
});

test('unsafe path scores lower and the previous result remains when another case starts',()=>{
  const {api}=fixture();
  for(const id of api.cases.map(c=>c.id)){
    api.launch(id);
    for(let i=0;i<3;i++) {assert.equal(api.choose(1),true);assert.equal(api.advance(),true);}
    api.store().active.rubric=true;
    assert.equal(api.finalize(0),true);
  }
  const all=api.store().history;
  assert.equal(Object.keys(all).length,4);
  assert.ok(all.payments.percent<100);
  assert.ok(all.auth.percent<100);
  assert.ok(all.websocket.percent<100);
  assert.ok(all.database.percent<100);
  assert.equal(api.calculate('unknown',[]),null);
});

test('incomplete investigation remains in local state when navigating away and back',()=>{
  const {api,ctx}=fixture();
  api.launch('websocket');
  api.choose(0);
  api.advance();
  assert.equal(api.store().active.step,1);
  ctx.state.mode='cards';
  ctx.render();
  ctx.state.mode='simulator';
  ctx.render();
  assert.equal(api.store().active.step,1);
  assert.equal(api.store().active.choices.length,1);
});
