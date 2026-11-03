import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const learning=readFileSync(new URL('../learning.js',import.meta.url),'utf8');
const found=html.match(/const DATA = (\[[\s\S]*?\n\]);\nfor \(const s of DATA\)/);
assert.ok(found,'training bank must exist');
const data=runInNewContext('('+found[1]+')');
const cards=data.flatMap(s=>s.cards.map((c,i)=>({id:s.id+'-'+(i+1),section:s.id,level:c[0],q:c[1],hint:c[2],answer:c[3],points:c[4]})));
const quizzes=data.flatMap(s=>s.quiz.map((q,i)=>({id:s.id+'-quiz-'+(i+1),section:s.id,q:q[0],choices:q[1],correct:q[2],explain:q[3]})));

function boot() {
  const elements={};
  let gradeButtons=[], quizButtons=[];
  function get(id) {
    if (!elements[id]) elements[id]={innerHTML:'',onclick:null,oninput:null};
    return elements[id];
  }
  const workspace=get('workspace');
  workspace.querySelectorAll=(selector)=>{
    if (selector==='[data-daily-grade]') {
      gradeButtons=[0,1,2].map(i=>({dataset:{dailyGrade:String(i)},onclick:null}));
      return gradeButtons;
    }
    if(selector==='[data-daily-choice]'){
      quizButtons=[0,1,2,3].map(i=>({dataset:{dailyChoice:String(i)},onclick:null}));
      return quizButtons;
    }
    return [];
  };
  const saved={grades:{},quizzes:{attempts:0,right:0,wrong:0},interviews:0};
  const state={mode:'cards'};
  const ctx={
    document:{getElementById:get,querySelectorAll:()=>[]},window:{},
    DATA:data,allCards:cards,allQuiz:quizzes,saved,state,
    esc:x=>String(x),sectionName:id=>data.find(s=>s.id===id)?.title||'Все разделы',save(){},toast(){},shuffle:a=>[...a],
    render(){},renderCards(){},renderProgress(){},renderTest(){},advanceInterview(){},bindGrade(){}
  };
  runInNewContext(learning,ctx);
  return {elements,workspace,saved,state,ctx,get,grade:()=>gradeButtons,quiz:()=>quizButtons};
}

test('a complete micro-lesson records exactly three reviews, one quiz and one completed day',()=>{
  const app=boot();
  app.get('beginDaily').onclick();
  assert.equal(app.state.mode,'daily');
  for (const grade of [0,1,2]) {
    assert.match(app.workspace.innerHTML,/Мини-урок/);
    app.get('dailyReveal').onclick();
    assert.match(app.workspace.innerHTML,/Критерии сильного ответа/);
    const choice=app.grade()[grade];
    assert.equal(typeof choice.onclick,'function');
    choice.onclick();
  }
  assert.match(app.workspace.innerHTML,/Закрепление/);
  assert.equal(app.quiz().length,4);
  app.quiz()[0].onclick();
  assert.equal(app.saved.quizzes.attempts,1);
  assert.equal(typeof app.get('finishDaily').onclick,'function');
  app.get('finishDaily').onclick();
  assert.match(app.workspace.innerHTML,/Занятие завершено/);
  assert.equal(app.saved.lessons,1);
  assert.equal(Object.keys(app.saved.activityDays).length,1);
  assert.equal(app.saved.reviewHistory.length,3);
  assert.equal(Object.keys(app.saved.grades).length,3);
  assert.equal(app.saved.reviewHistory.reduce((a,r)=>a+r.grade,0),3);
  assert.equal(app.ctx.window.QALearning.studyStreak(),1);
});

test('review scheduling depends on actual self-ratings and is in the future',()=>{
  const app=boot();
  app.get('beginDaily').onclick();
  for(const grade of [0,1,2]){
    app.get('dailyReveal').onclick();
    app.grade()[grade].onclick();
  }
  const history=app.saved.reviewHistory;
  assert.equal(history.length,3);
  for(const rec of history) {
    const item=app.saved.grades[rec.id];
    assert.ok(item.dueAt>item.ts);
    assert.equal(item.reviews,1);
  }
  const delay=history.map(r=>app.saved.grades[r.id].dueAt-app.saved.grades[r.id].ts);
  assert.equal(delay[0],20*60*1000);
  assert.equal(delay[1],24*60*60*1000);
  assert.equal(delay[2],24*60*60*1000);
});
