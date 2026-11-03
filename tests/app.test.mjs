import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
const learning = readFileSync(new URL('../learning.js', import.meta.url), 'utf8');
const learningCSS = readFileSync(new URL('../learning.css', import.meta.url), 'utf8');
const dataMatch = inlineScripts[0]?.match(/const DATA = (\[[\s\S]*?\n\]);\nfor \(const s of DATA\)/);

function dataset() {
  assert.ok(dataMatch, 'bank of questions exists');
  return runInNewContext('(' + dataMatch[1] + ')');
}

test('the app has a valid document shell', () => {
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<title>Manual QA Interview Lab/);
  assert.match(html, /id="workspace"/);
  assert.match(html, /id="sectionList"/);
});

test('embedded JavaScript parses', () => {
  assert.equal(inlineScripts.length, 1);
  assert.doesNotThrow(() => new Script(inlineScripts[0], { filename: 'index.html:inline.js' }));
});

test('the training bank contains 12 sections, 48 cases and 24 quiz questions', () => {
  const sections = dataset();
  assert.equal(sections.length, 12);
  assert.equal(sections.reduce((sum, s) => sum + s.cards.length, 0), 48);
  assert.equal(sections.reduce((sum, s) => sum + s.quiz.length, 0), 24);
  assert.equal(new Set(sections.map(s => s.id)).size, 12);
});

test('open questions have valid levels, prompts and criteria', () => {
  for (const s of dataset()) {
    assert.ok(s.title.length > 2);
    for (const [level, prompt, hint, answer, rubric] of s.cards) {
      assert.ok(['Junior', 'Middle', 'Senior'].includes(level));
      assert.ok(prompt.length > 15);
      assert.ok(hint.length > 10);
      assert.ok(answer.length > 50);
      assert.ok(Array.isArray(rubric) && rubric.length >= 2);
    }
  }
});

test('multiple-choice questions have exactly one valid answer', () => {
  for (const s of dataset()) {
    for (const [prompt, choices, correct, explanation] of s.quiz) {
      assert.ok(prompt.length > 10);
      assert.equal(choices.length, 4);
      assert.equal(new Set(choices).size, 4);
      assert.ok(choices.every(x => x.trim().length > 0));
      assert.ok(Number.isInteger(correct) && correct >= 0 && correct < choices.length);
      assert.ok(explanation.length > 20);
    }
  }
});

test('offline-first: only bundled scripts and local assets', () => {
  assert.match(html, /<script src="learning\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="learning\.css">/);
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:\/\//i);
  assert.match(html, /localStorage/);
});

test('learning module parses and provides an accessible daily entry point', () => {
  assert.doesNotThrow(() => new Script(learning, { filename: 'learning.js' }));
  assert.match(html, /data-mode="daily"/);
  assert.match(html, /id="learningHome"/);
  assert.match(learningCSS, /prefers-reduced-motion/);
  assert.match(learning, /Быстрая схема по теме/);
});

test('microlearning queue chooses three different topics and a defined review date', () => {
  const raw=dataset();
  const cards=raw.flatMap(s=>s.cards.map((c,i)=>({id:s.id+'-'+(i+1),section:s.id,q:c[1],level:c[0],answer:c[3],hint:c[2],points:c[4]})));
  const quizzes=raw.flatMap(s=>s.quiz.map((q,i)=>({id:s.id+'-quiz-'+(i+1),section:s.id,q:q[0],choices:q[1],correct:q[2],explain:q[3]})));
  const els={};
  const fakeDoc={
    getElementById(id){return els[id]||(els[id]={innerHTML:'',onclick:null});},
    querySelectorAll(){return []}
  };
  const context={
    document:fakeDoc,window:{},DATA:raw,allCards:cards,allQuiz:quizzes,
    saved:{grades:{},quizzes:{attempts:0,right:0,wrong:0},interviews:0},
    state:{mode:'cards'}, save(){},render(){},renderCards(){},
    renderTest(){},renderProgress(){},advanceInterview(){},bindGrade(){},
    toast(){},shuffle:a=>a.slice(),esc:s=>String(s)
  };
  runInNewContext(learning,context);
  const tools=context.window.QALearning;
  assert.ok(tools);
  const picked=tools.selectThreeCards();
  assert.equal(picked.length,3);
  assert.equal(new Set(picked.map(c=>c.section)).size,3);
  assert.equal(tools.dueDate({dueAt:123,grade:2,ts:11}),123);
  assert.equal(tools.dueDate({grade:0,ts:11}),0);
  assert.equal(tools.studyStreak(),0);
});
