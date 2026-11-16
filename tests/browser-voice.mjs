import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const origin='http://127.0.0.1:8000';
const context=await browser.newContext({permissions:['microphone']});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const wait=async(fn)=>page.waitForFunction(fn,undefined,{timeout:15000});
try{
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  await page.locator('#startVoicePractice').click();
  await page.locator('.voice-recorder').waitFor();
  assert.match(await page.locator('#workspace').innerText(),/Банк: 102/);
  assert.equal(await page.locator('#voiceModel').isVisible(),true);
  assert.match(await page.locator('#voiceGuideTitle').innerText(),/Прочитай и запиши/);
  await page.locator('#voiceTraining').selectOption('interview');
  await page.locator('#voiceReveal').click();
  assert.equal(await page.locator('#voiceModel').isVisible(),true);
  // Test the local-voice selection and UI contract, not actual speaker output.
  await page.evaluate(()=>{
    window.__spoken=null;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices:()=>[{localService:false,lang:'ru-RU'},{localService:true,lang:'ru-RU'}],
      speak:u=>{window.__spoken={lang:u.lang,rate:u.rate,text:u.text,local:u.voice.localService};u.onend?.()},
      cancel(){}
    }});
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
  });
  await page.locator('#voiceSpeechRate').selectOption('0.75');
  await page.locator('#voiceSpeak').click();
  const spoken=await page.evaluate(()=>window.__spoken);
  assert.equal(spoken.local,true);assert.equal(spoken.rate,.75);assert.match(spoken.lang,/^ru/);
  async function record(count){
    await page.locator('#voiceStart').click();
    await wait(()=>document.querySelector('.voice-recorder')?.dataset.phase==='recording');
    await page.waitForTimeout(1100);
    await page.locator('#voiceStop').click();
    await wait(()=>document.querySelector('.voice-recorder')?.dataset.phase==='idle'&&document.querySelector('#voiceAttemptCount')?.textContent.includes('Попыток: '+window.__expected+' из'));
    assert.equal(await page.locator('#voiceAttempts option').count(),count);
  }
  await page.evaluate(()=>window.__expected=1);await record(1);
  await page.evaluate(()=>window.__expected=2);await record(2);
  await page.locator('#voicePlaybackRate').selectOption('1.5');
  assert.equal(await page.locator('#voiceAudio').evaluate(a=>a.playbackRate),1.5);
  await page.locator('#voiceAttempts').selectOption({index:1});
  await page.locator('#voiceAudio').evaluate(a=>a.play());
  await wait(()=>document.querySelector('#voiceAudio').currentTime>0);
  await page.locator('#voiceAudio').evaluate(a=>a.pause());
  await page.locator('#voiceDelete').click();
  await wait(()=>document.querySelector('#voiceAttempts')?.options.length===1);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#startVoicePractice').click();
  await wait(()=>document.querySelector('#voiceAttempts')?.options.length===1);
  await page.locator('#voiceTraining').selectOption('interview');
  await page.locator('#voiceLanguage').selectOption('en');
  assert.match(await page.locator('.voice-session .learning-prompt').innerText(),/[A-Za-z]/);
  await page.locator('[data-grade="2"]').click();
  assert.match(await page.locator('#workspace').innerText(),/Самооценено: 1/);
  await page.locator('.tab[data-mode="cards"]').click();
  await page.locator('#startVoicePractice').waitFor({state:'visible'});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await wait(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#startVoicePractice').click();
  await page.locator('.voice-recorder').waitFor();
  await wait(()=>document.querySelector('#voiceAttempts')?.options.length===1);
  assert.deepEqual(errors,[]);
  console.log('PASS: Chromium fake-microphone recording, history, playback, delete, reload, language, local TTS contract, offline shell');
  // Layout verification at mobile viewport (still desktop Chromium).
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  console.log('PASS: mobile-width overflow check');
  await page.locator('[data-mobile-mode="play"]').click();
  await page.locator('#playQuest').waitFor();
  await page.locator('[data-game="Memory Match"]').click();
  const terms=await page.locator('[data-term]').count();
  for(let i=0;i<terms;i++){await page.locator('[data-term="'+i+'"]').click();await page.locator('[data-definition="'+i+'"]').click()}
  await page.locator('#checkMatch').click();
  assert.match(await page.locator('.play-feedback').innerText(),/Верно/);
  await page.locator('#playHome').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mobile-mode="play"]').click();
  await page.locator('#playResume').click();
  assert.match(await page.locator('.play-feedback').innerText(),/Верно/);
  await page.locator('#playNext').click();
  await page.locator('#playHome').click();
  // Test Case Builder includes both choices and sequences; exercise all tasks.
  page.once('dialog',d=>d.dismiss());
  await page.locator('[data-game="Test Case Builder"]').click();
  await page.locator('#playResume').waitFor();
  page.once('dialog',d=>d.accept());
  await page.locator('[data-game="Test Case Builder"]').click();
  for(let n=0;n<3;n++){
    if(await page.locator('[data-step]').count()){const steps=await page.locator('[data-step]').count();for(let i=0;i<steps;i++)await page.locator('[data-step="'+i+'"]').click();await page.locator('#checkSequence').click()}
    else await page.locator('[data-choice="0"]').click();
    assert.match(await page.locator('.play-feedback').innerText(),/Верно/);
    await page.locator('#playNext').click();
  }
  assert.match(await page.locator('.play-panel').innerText(),/3 из 3 верно/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: offline mobile games, match, sequence, choice and session restore');
  await page.locator('.tab[data-mode="cards"]').click();
  await page.locator('#startVisualPractice').click();
  await page.locator('[data-visual="sql"]').click();
  assert.equal(await page.locator('.vis-figure').isVisible(),true);
  await page.locator('#visualRecall').click();
  assert.equal(await page.locator('.vis-figure').count(),0);
  await page.locator('[data-visual-answer="0"]').click();
  assert.match(await page.locator('.visual-feedback').innerText(),/Верно/);
  assert.equal(await page.locator('.vis-figure').isVisible(),true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#startVisualPractice').click();
  assert.match(await page.locator('[data-visual="sql"]').innerText(),/Последний ответ: верно/);
  await page.locator('[data-visual="boundary"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: offline visual lesson, hidden-diagram recall, feedback, saved result and mobile layout');
  await page.locator('.tab[data-mode="voice"]').click();
  assert.match(await page.locator('#voiceGuideTitle').innerText(),/Прочитай и запиши/);
  assert.equal(await page.locator('#voiceModel').isVisible(),true);
  assert.equal(await page.locator('.voice-grade').isVisible(),false);
  await page.locator('#voiceConfidence').selectOption('3');
  await page.locator('#voiceGuideNext').click();
  assert.match(await page.locator('#voiceGuideTitle').innerText(),/Послушай себя/);
  assert.equal(await page.locator('#voiceGuideNext').isEnabled(),false);
  await page.locator('#voiceObservation').fill('Первый дубль: понятное начало');
  await page.locator('#voiceListened').check();
  await page.locator('#voiceGuideNext').click();
  assert.match(await page.locator('#voiceGuideTitle').innerText(),/Улучшенный дубль/);
  await page.locator('#voiceGuideNext').click();
  assert.equal(await page.locator('#voiceModel').isVisible(),false);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#startVoicePractice').click();
  assert.match(await page.locator('#voiceGuideTitle').innerText(),/Ответ без текста/);
  assert.equal(await page.locator('#voiceModel').isVisible(),false);
  await page.locator('#voiceGuideNext').click();
  assert.equal(await page.locator('#voiceModel').isVisible(),true);
  assert.match(await page.locator('#voicePriorNote').innerText(),/понятное начало/);
  assert.match(await page.locator('#voiceConfidenceCompare').innerText(),/3 из 5/);
  await page.locator('#voiceConfidence').selectOption('4');
  await page.locator('#voiceListened').check();
  assert.equal(await page.locator('.voice-grade').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: guided speech-first workflow, review gate, resume and optional confidence self-report');
  await page.locator('#voiceSection').selectOption('Продажи и переговоры · SELF LAB');
  await page.locator('.action-method summary').click();
  assert.match(await page.locator('.action-method summary').innerText(),/Грант Кардон/);
  await page.locator('#voiceActionPlan').fill('Если клиент сомневается, уточню задачу.');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#startVoicePractice').click();
  await page.locator('#voiceSection').selectOption('Продажи и переговоры · SELF LAB');
  await page.locator('.action-method summary').click();
  assert.equal(await page.locator('#voiceActionPlan').inputValue(),'Если клиент сомневается, уточню задачу.');
  assert.deepEqual(errors,[]);
  console.log('PASS: action lab filter, source label and offline if-then plan persistence');
}finally{await browser.close()}
