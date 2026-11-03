import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../coach.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../coach.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const simulator=readFileSync(new URL('../simulator.js',import.meta.url),'utf8');

const scenarios=[
 {id:'payments',icon:'01',title:'Двойное списание после таймаута',level:'Middle',teaser:'Два списания',context:'После таймаута интерфейс показывает два платежа.'},
 {id:'auth',icon:'02',title:'Ошибка OAuth PWA',level:'Middle',teaser:'После logout ошибка state.',context:'PWA отличается от Chrome.'},
 {id:'websocket',icon:'03',title:'WebSocket и устаревшие котировки',level:'Senior',teaser:'Stale quotes.',context:'Socket подключён, но данные устарели.'},
 {id:'database',icon:'04',title:'Расхождение SQL-отчёта',level:'Middle',teaser:'928 против 861.',context:'JOIN теряет заказы.'}
];

function fixture(){
  const elements=new Map();
  const workspace={innerHTML:'',querySelectorAll(){return [];}};
  const get=id=>{
    if(id==='workspace')return workspace;
    if(!elements.has(id))elements.set(id,{value:'',disabled:false,onclick:null,oninput:null,onkeydown:null,textContent:'',classList:{toggle(){}}});
    return elements.get(id);
  };
  const saved={},state={mode:'cards'};
  let writes=0, renders=0;
  const ctx={
    document:{getElementById:get},window:{QASimulator:{cases:scenarios}},
    saved,state,save(){writes++;},
    esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    render(){renders++;}
  };
  runInNewContext(src,ctx);
  return {api:ctx.window.QATechLead,ctx,workspace,get,writes:()=>writes,renders:()=>renders};
}

test('standalone adaptive dialogue parses and is bundled in the page',()=>{
  assert.doesNotThrow(()=>new Script(src,{filename:'coach.js'}));
  assert.match(html,/data-mode="coach"/);
  assert.match(html,/<script src="coach\.js"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="coach\.css">/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(simulator,/data-sim-coach/);
});

test('every QA scenario offers distinct prompts and topic recognition',()=>{
  const {api}=fixture();
  assert.deepEqual(Object.keys(api.config).sort(),scenarios.map(s=>s.id).sort());
  for(const s of scenarios){
    const c=api.config[s.id];
    assert.ok(c.opening.length>60);
    assert.equal(c.topics.length,5);
    assert.equal(new Set(c.topics.map(p=>p.id)).size,5);
    assert.ok(c.topics.every(p=>p.question.length>80));
    assert.equal(c.checklist.length,4);
    assert.ok(c.closing.length>40);
  }
  assert.ok(api.detect('payments','Проверю идемпотентность и retry').includes('idempotency'));
  assert.ok(api.detect('auth','Проверю cookie и SameSite').includes('cookies'));
  assert.ok(api.detect('websocket','Сравню sequence delta со snapshot').includes('sequence'));
  assert.ok(api.detect('database','Проверю LEFT JOIN и DISTINCT').includes('joins'));
});

test('the same opening generates meaningfully different follow-ups from different text',()=>{
  const {api}=fixture();
  api.start('payments');
  const a=api.submit('Проверю идемпотентность, retry и ключ для повторной оплаты заказа');
  assert.equal(a.ok,true);
  assert.match(a.next,/ключом|ключе/i);
  assert.match(a.next,/запрос/);
  assert.equal(api.storage().active.used[0],'idempotency');

  api.start('payments');
  const b=api.submit('Сначала соберу логи, request ID и trace в сервисах');
  assert.equal(b.ok,true);
  assert.notEqual(a.next,b.next);
  assert.match(b.next,/логи|идентификатор|связать/i);
  assert.equal(api.storage().active.used[0],'evidence');
});

test('four actual text responses end at review, never at invented automatic grade',()=>{
  const {api,ctx,writes}=fixture();
  api.start('auth');
  const messages=[
    'Сравню Android PWA и вкладку Chrome после logout, без токенов в логе.',
    'Проверю SameSite и cookies, локальное хранилище и редирект.',
    'Воспроизведу гонку очистки состояния во время logout и нового входа.',
    'Согласую регрессию, повторный логин на Android и риски безопасности перед выпуском.'
  ];
  messages.forEach((m,i)=>{
    const result=api.submit(m);
    assert.equal(result.ok,true);
    assert.equal(result.turns,i+1);
  });
  const active=api.storage().active;
  assert.equal(active.phase,'review');
  assert.equal(active.rating,null);
  assert.equal(active.messages.length,8);
  assert.equal(active.messages.filter(m=>m.role==='candidate').length,4);
  assert.equal(active.messages.filter(m=>m.role==='lead').length,4);
  assert.equal(api.finish(2),true);
  assert.equal(api.storage().history.length,1);
  assert.equal(api.storage().history[0].rating,2);
  assert.equal(api.storage().history[0].caseId,'auth');
  assert.ok(writes()>0);
  assert.equal(ctx.state.mode,'coach');
});

test('draft, incomplete state and completed history remain available on return',()=>{
  const {api,get,workspace}=fixture();
  api.start('websocket');
  api.draft('Сверю timestamps');
  assert.equal(api.storage().active.draft,'Сверю timestamps');
  get('tlBack').onclick();
  assert.ok(api.storage().active);
  assert.match(workspace.innerHTML,/Сохранён незавершённый разговор/);
  get('tlResume').onclick();
  assert.match(workspace.innerHTML,/Сверю timestamps/);
  assert.equal(api.storage().active.turns,0);
});

test('user-provided text is safely escaped and never sent to a remote model',()=>{
  const {api,workspace}=fixture();
  api.start('database');
  const input='<img src=x onerror=alert(1)> Проверю LEFT JOIN и SQL';
  assert.equal(api.submit(input).ok,true);
  assert.ok(workspace.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!workspace.innerHTML.includes('<img src=x onerror=alert(1)>'));
  assert.doesNotMatch(src,/\bfetch\(|XMLHttpRequest|WebSocket\(|OPENAI_API_KEY/);
});

test('short answers are not silently accepted and closing prompt reflects the last-mentioned topic',()=>{
  const {api}=fixture();
  api.start('database');
  assert.equal(api.submit('ок').ok,false);
  assert.equal(api.storage().active.turns,0);
  const a=api.submit('Сначала сверю метрики, статусы заказов и правила подсчёта');
  assert.equal(a.ok,true);
  api.submit('Проверю SQL JOIN и COUNT DISTINCT по заказам');
  const third=api.submit('Проверю timezone и репликацию в нужный день');
  assert.equal(third.ok,true);
  assert.match(third.next,/таймзон|время|реплик|период|упомянул/i);
  assert.match(third.next,/Какие|Что покажешь/i);
});
