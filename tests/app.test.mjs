import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
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

test('offline-first: no third-party script imports or network-dependent assets', () => {
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*\bhref\s*=\s*["']https?:/i);
  assert.match(html, /localStorage/);
});
