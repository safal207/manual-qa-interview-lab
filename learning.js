/* Manual QA Interview Lab: bite-sized practice, retrieval and spaced review. */
(function () {
  'use strict';
  if (!document.getElementById('learningHome') || typeof DATA === 'undefined') return;
  const DAY = 86400000;
  const FLOW = {
    theory:   {steps:['Требования','Проверки','Риски','Вывод'],note:'QA отвечает не только за поиск дефектов, но и за снижение рисков качества.'},
    design:   {steps:['Раздели входы','Найди границы','Составь тесты'],note:'Проверяй классы, границы и переходы вместо случайных наборов.'},
    bugs:     {steps:['Новый','В работе','Исправлен','Ретест','Закрыт'],note:'Если исправление не подтверждено, дефект можно переоткрыть.'},
    process:  {steps:['Требования','План','Тест-кейсы','Выполнение','Отчёт'],note:'STLC — процесс тестирования внутри разработки продукта (SDLC).'},
    web:      {steps:['Действие UI','Network','Ответ API','Рендер'],note:'Время ответа API и время обновления UI — разные величины.'},
    api:      {steps:['Клиент','HTTP-запрос','API','HTTP-ответ'],note:'Проверяй статус, контракт, данные и негативные сценарии.'},
    sql:      {steps:['Таблицы','JOIN','WHERE','Результат'],note:'Отдельно проверяй NULL, дубли и отсутствие связанных записей.'},
    auth:     {steps:['Кто ты?','Какие права?','Ресурс','Доступ/403'],note:'Authentication и authorization — разные этапы проверки.'},
    mobile:   {steps:['Устройство','Сеть/офлайн','Состояние','Синхронизация'],note:'Смена сети и жизненного цикла приложения часто выявляет ошибки.'},
    integration:{steps:['Событие','Доставка','Обработка','Подтверждение'],note:'Повторы, задержки и порядок событий — ключевые риски интеграций.'},
    release:  {steps:['Изменения','Smoke','Риски','Go / No-go'],note:'Зелёный CI отражает только включённые в него проверки.'},
    scenarios:{steps:['Уточни задачу','Проверь риск','Собери факты','Предложи решение'],note:'На интервью важнее аргументированный процесс, чем длинный список проверок.'}
  };
  saved.reviewHistory = Array.isArray(saved.reviewHistory) ? saved.reviewHistory : [];
  saved.activityDays = saved.activityDays && typeof saved.activityDays === 'object' ? saved.activityDays : {};
  saved.lessons = Number.isInteger(saved.lessons) && saved.lessons >= 0 ? saved.lessons : 0;
  saved.quizMisses = saved.quizMisses && typeof saved.quizMisses === 'object' ? saved.quizMisses : {};
  const daily = {active:false, cards:[], index:0, answer:'', hinted:false, revealed:false, quiz:null, picked:null, finished:false, completed:false, correct:0};
  const localDay = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); };
  const dueDate = (r) => Number.isFinite(r && r.dueAt) ? r.dueAt : (!r ? Infinity : (r.grade < 2 ? 0 : (r.ts || 0) + DAY));
  const dueCards = () => allCards.filter(c => saved.grades[c.id] && dueDate(saved.grades[c.id]) <= Date.now());
  const missingCards = () => allCards.filter(c => !saved.grades[c.id]);
  const safeInt = n => Number.isFinite(n) ? n : 0;
  function studyStreak() {
    const days = new Set(Object.keys(saved.activityDays).filter(k => saved.activityDays[k] > 0));
    let today = new Date(); today.setHours(12,0,0,0);
    if (!days.has(localDay(today))) today.setDate(today.getDate()-1);
    let streak = 0;
    while (days.has(localDay(today))) { streak++; today.setDate(today.getDate()-1); }
    return streak;
  }
  function markReview(c, grade) {
    const prior = saved.grades[c.id] || {};
    const previousCorrect = grade === 2 ? Math.max(0, safeInt(prior.streak)) : 0;
    const streak = grade === 2 ? previousCorrect + 1 : 0;
    const delay = grade === 0 ? 20*60*1000 : grade === 1 ? DAY : [DAY,3*DAY,7*DAY,14*DAY,30*DAY][Math.min(streak-1,4)];
    const now = Date.now();
    saved.grades[c.id] = {grade:grade, ts:now, dueAt:now+delay, streak:streak, reviews:safeInt(prior.reviews)+1};
    saved.reviewHistory.push({id:c.id, grade:grade, ts:now});
    if (saved.reviewHistory.length > 400) saved.reviewHistory = saved.reviewHistory.slice(-400);
    save();
  }
  function recordQuizChoice(q, picked) {
    if (picked === q.correct) delete saved.quizMisses[q.id];
    else saved.quizMisses[q.id] = {ts:Date.now(), section:q.section};
    save();
  }
  function selectThreeCards() {
    const now = Date.now();
    const sorted = [...allCards].sort((a,b) => {
      const rank = c => !saved.grades[c.id] ? 1 : dueDate(saved.grades[c.id]) <= now ? 0 : 2;
      const ra = rank(a), rb = rank(b);
      return ra-rb || (ra===0 ? dueDate(saved.grades[a.id])-dueDate(saved.grades[b.id]) : 0) || a.id.localeCompare(b.id);
    });
    const chosen=[], sections=new Set();
    for (const c of sorted) if (chosen.length < 3 && !sections.has(c.section)) {chosen.push(c);sections.add(c.section);}
    for (const c of sorted) if (chosen.length < 3 && !chosen.some(x=>x.id===c.id)) chosen.push(c);
    return chosen;
  }
  function renderFlow(id) {
    const info=FLOW[id];
    if(!info)return '';
    return '<div class="learning-focus" role="group" aria-label="Краткая схема по теме"><div class="learning-focus-title">Схема за 20 секунд</div><div class="learning-flow">'+info.steps.map((s,i) => (i?'<span class="learning-arrow" aria-hidden="true">→</span>':'')+'<span class="learning-step">'+esc(s)+'</span>').join('')+'</div><div class="learning-note">'+esc(info.note)+'</div></div>';
  }
  function activityDots() {
    let out='';
    for(let i=6;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const active=!!saved.activityDays[localDay(d)];out+='<span class="learning-pill" title="'+esc(localDay(d))+'">'+(active?'● ':'○ ')+esc(d.toLocaleDateString('ru-RU',{weekday:'short'}))+'</span>';}
    return out;
  }
  function updateWelcome() {
    const el=document.getElementById('learningHome');if(!el)return;
    const due=dueCards().length, unseen=missingCards().length, streak=studyStreak();
    const ready=due+unseen;
    el.innerHTML='<section class="learning-launch"><div class="learning-kicker">Тренировка дня · 5–7 минут</div><h2>Один маленький шаг к сильному интервью</h2><p>Три коротких QA-кейса и один проверяемый вопрос. Сначала вспоминаешь сам, затем сверяешься с объяснением. На этом занятие заканчивается — без бесконечной ленты.</p><div class="learning-actions"><button class="btn primary" id="beginDaily">'+(daily.active&&!daily.finished?'Продолжить мини-урок':'Начать мини-урок →')+'</button><button class="btn ghost" id="openWrong" '+(Object.keys(saved.quizMisses).length?'':'disabled')+'>Ошибки тестов ('+Object.keys(saved.quizMisses).length+')</button></div><div class="learning-meta"><span>К повторению: '+due+'</span><span>Новых: '+unseen+'</span><span>Сессий: '+saved.lessons+'</span></div></section>'+
      '<aside class="learning-side"><div class="learning-kicker">Привычка без гонки</div><h2>'+streak+' '+(streak===1?'день':'дней')+' подряд</h2><p>Считаем только завершённые уроки. Пропуск не обнуляет знания; вернуться можно в любой день.</p><div class="learning-pills" aria-label="Активность за последние семь дней">'+activityDots()+'</div><div class="learning-meta">Дни практики: '+Object.keys(saved.activityDays).filter(k=>saved.activityDays[k]>0).length+' · Без рейтингов и штрафов</div></aside>';
    document.getElementById('beginDaily').onclick=()=>{state.mode='daily';if(!daily.active || daily.finished)startDaily();else render();};
    document.getElementById('openWrong').onclick=beginMistakes;
  }
  function startDaily() {
    daily.cards=selectThreeCards();daily.index=0;daily.answer='';daily.hinted=false;daily.revealed=false;
    daily.quiz=allQuiz.find(q=>q.section===daily.cards[0]?.section) || allQuiz[0];
    daily.picked=null;daily.finished=false;daily.completed=false;daily.correct=0;daily.active=true;
    state.mode='daily';render();
  }
  function nextStep() { daily.index++;daily.answer='';daily.hinted=false;daily.revealed=false;render(); }
  function lessonFinish() {
    if (!daily.completed) {
      const day=localDay();
      saved.activityDays[day]=safeInt(saved.activityDays[day])+1;
      saved.lessons++;
      save();
      daily.completed=true;
    }
    daily.finished=true;daily.active=false;render();
  }
  function renderDaily() {
    const w=document.getElementById('workspace');
    if(!daily.active && !daily.finished){
      w.innerHTML='<div class="learning-panel center"><div class="learning-kicker">Новый формат</div><h2>Микроурок: 3 кейса + 1 тест</h2><p>Не надо выделять час. Начни с одного кейса. Подсказка по желанию, ответ — по чек-листу, следующий вопрос подберётся с учётом повторений.</p><div class="learning-learningpath"><div class="learning-path-step current"><strong>1</strong>Вспомнить и объяснить</div><div class="learning-path-step"><strong>2</strong>Проверить себя по критериям</div><div class="learning-path-step"><strong>3</strong>Ответить на мини-тест</div></div><button class="btn primary" id="dailyStart">Начать 5–7 минут →</button></div>';
      document.getElementById('dailyStart').onclick=startDaily;return;
    }
    if(daily.finished){
      const due=dueCards().length;
      w.innerHTML='<div class="learning-panel learning-finish"><div class="learning-kicker">Занятие завершено</div><div class="big-score">✓</div><h2>Сегодня ты потренировал объяснение и проверку решений</h2><p>Три открытых кейса, один тестовый вопрос и интервалы повторения сохранены в этом браузере.</p><div class="learning-mini-outcome"><div><strong>3</strong><span>QA-кейса</span></div><div><strong>'+daily.correct+'/1</strong><span>Мини-тест</span></div><div><strong>'+due+'</strong><span>К повторению</span></div></div><div class="learning-actions"><button class="btn primary" id="seeProgress">Мой прогресс</button><button class="btn ghost" id="nextDaily">Ещё урок</button></div><p class="learning-empty">Можно закончить на этом: короткая регулярная практика лучше бесконечного скроллинга.</p></div>';
      document.getElementById('seeProgress').onclick=()=>{state.mode='progress';render();};
      document.getElementById('nextDaily').onclick=startDaily;return;
    }
    if (daily.index < daily.cards.length) {
      const c=daily.cards[daily.index], r=saved.grades[c.id], due=r && dueDate(r)<=Date.now();
      w.innerHTML='<div class="learning-panel"><div class="learning-top"><span class="learning-tag">Мини-урок · шаг '+(daily.index+1)+' из 4</span><span class="counter">≈ 5–7 минут на весь урок</span></div><div class="progress-track"><div class="progress-fill" style="width:'+((daily.index)/4*100)+'%"></div></div><div class="learning-pills"><span class="learning-pill">'+esc(sectionName(c.section))+'</span><span class="learning-pill">'+esc(c.level)+'</span><span class="learning-pill">'+(due?'Плановое повторение':r?'Закрепление':'Новая тема')+'</span></div>'+
        renderFlow(c.section)+'<h2 class="learning-prompt">'+esc(c.q)+'</h2><p class="learning-sub">Скажи ответ вслух или запиши 2–4 тезиса. Затем сравни с примером и оцени по критериям.</p><textarea id="dailyAnswer" class="learning-textarea" placeholder="Мой ответ: что проверю, почему, какие риски…">'+esc(daily.answer)+'</textarea><div class="learning-actions" style="margin-top:13px"><button class="btn ghost" id="dailyHint">'+(daily.hinted?'Скрыть подсказку':'Нужна подсказка?')+'</button><button class="btn primary" id="dailyReveal">'+(daily.revealed?'Скрыть разбор':'Показать разбор →')+'</button></div>'+
        (daily.hinted?'<p class="learning-alert">'+esc(c.hint)+'</p>':'')+
        (daily.revealed?'<div class="learning-feedback"><strong>Как мог бы ответить уверенный кандидат</strong><p>'+esc(c.answer)+'</p><strong>Критерии сильного ответа</strong>'+c.points.map(p=>'<div class="point">✓ '+esc(p)+'</div>').join('')+'</div><p class="learning-grade-note">Оцени смысл, а не совпадение слов. Самооценка — не автоматическая оценка навыка.</p><div class="learning-rate"><button class="btn bad" data-daily-grade="0">Не ответил</button><button class="btn warn" data-daily-grade="1">Частично</button><button class="btn good" data-daily-grade="2">Объяснил уверенно</button></div>':'')+'</div>';
      document.getElementById('dailyAnswer').oninput=e=>{daily.answer=e.target.value;};
      document.getElementById('dailyHint').onclick=()=>{daily.hinted=!daily.hinted;renderDaily();};
      document.getElementById('dailyReveal').onclick=()=>{daily.revealed=!daily.revealed;renderDaily();};
      w.querySelectorAll('[data-daily-grade]').forEach(b=>b.onclick=()=>{markReview(c,Number(b.dataset.dailyGrade));daily.correct += 0;nextStep();});
      return;
    }
    const q=daily.quiz,picked=daily.picked,answered=picked!==null;
    w.innerHTML='<div class="learning-panel"><div class="learning-top"><span class="learning-tag">Закрепление · шаг 4 из 4</span><span class="counter">Финиш</span></div><div class="progress-track"><div class="progress-fill" style="width:75%"></div></div><div class="learning-pills"><span class="learning-pill">'+esc(sectionName(q.section))+'</span><span class="learning-pill">Один правильный ответ</span></div><h2 class="learning-prompt">'+esc(q.q)+'</h2><div class="choice-grid">'+q.choices.map((o,i)=>'<button class="choice '+(answered?(i===q.correct?'correct':i===picked?'incorrect':''):'')+'" data-daily-choice="'+i+'" '+(answered?'disabled':'')+'><span class="choice-letter">'+('ABCD'[i])+'</span><span>'+esc(o)+'</span></button>').join('')+'</div>'+ (answered?'<div class="learning-feedback">'+(picked===q.correct?'<strong>Верно.</strong> ':'<strong>Есть что повторить.</strong> ')+esc(q.explain)+'</div><div class="learning-actions" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" id="finishDaily">Завершить урок →</button></div>':'')+'</div>';
    if(!answered){w.querySelectorAll('[data-daily-choice]').forEach(b=>b.onclick=()=>{
      if(daily.picked!==null)return;
      daily.picked=Number(b.dataset.dailyChoice);
      const good=daily.picked===q.correct;daily.correct=Number(good);
      saved.quizzes.attempts++;saved.quizzes.right+=Number(good);saved.quizzes.wrong+=Number(!good);
      recordQuizChoice(q,daily.picked);render();
    });} else document.getElementById('finishDaily').onclick=lessonFinish;
  }
  function beginMistakes() {
    const wrong=allQuiz.filter(q=>saved.quizMisses[q.id]);
    if(!wrong.length){toast('Пока нет ошибок для повторения');return;}
    state.mode='test';state.testQuestions=shuffle(wrong).slice(0,12);state.testIdx=0;state.testPicked=null;
    state.testRight=0;state.testTotal=0;state.testFinished=false;render();
  }
  const oldCards=renderCards;
  renderCards=function() {
    oldCards();
    const cards=filterCards(),c=cards[state.cardIdx];
    if(!c)return;
    const w=document.getElementById('workspace'),h=w.querySelector('.card-title');
    if(h) h.insertAdjacentHTML('beforebegin','<details class="learning-details"><summary>Быстрая схема по теме</summary>'+renderFlow(c.section)+'</details><div class="learning-selfprompt">Механика: сначала вспомни → ответь своими словами → сравни с критериями → отметь уровень.</div>');
  };
  bindGrade=function(c) {
    document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{
      const grade=Number(b.dataset.grade);markReview(c,grade);
      toast(grade===2?'Отлично: повторение запланировано':'Вернёмся к этому вопросу позже');
      const list=filterCards(),pos=list.findIndex(x=>x.id===c.id);
      state.cardIdx=Math.max(0,Math.min(list.length-1,state.cardIdx+(pos>=0?1:0)));
      state.revealed=false;state.hinted=false;state.cardAnswer='';render();
    });
  };
  const oldTest=renderTest;
  renderTest=function() {
    oldTest();
    if(state.testQuestions.length && !state.testFinished && state.testPicked===null) {
      const q=state.testQuestions[state.testIdx];
      document.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>recordQuizChoice(q,Number(b.dataset.choice)),{capture:true,once:true}));
    }
  };
  const oldAdvance=advanceInterview;
  advanceInterview=function() {
    const c=state.interviewQuestions[state.interviewIdx];
    const r=c && saved.grades[c.id];
    if(c && r && !Number.isFinite(r.dueAt)) markReview(c,Number(r.grade));
    oldAdvance();
  };
  const oldProgress=renderProgress;
  renderProgress=function() {
    oldProgress();
    const mistakes=Object.keys(saved.quizMisses).length;
    const awards=[
      ['Первый шаг',saved.lessons>=1],
      ['5 дней практики',Object.keys(saved.activityDays).filter(k=>saved.activityDays[k]>0).length>=5],
      ['Работа над ошибками',saved.reviewHistory.filter(x=>x.grade<2).length>=3],
      ['Пробное интервью',saved.interviews>=1]
    ];
    const w=document.getElementById('workspace');
    const panel=document.createElement('div');panel.className='learning-focus';
    panel.innerHTML='<div class="learning-focus-title">Моя учебная привычка — подтверждённые действия</div><div class="learning-mini-outcome"><div><strong>'+saved.lessons+'</strong><span>Мини-уроков</span></div><div><strong>'+studyStreak()+'</strong><span>Дней подряд</span></div><div><strong>'+dueCards().length+'</strong><span>Пора повторить</span></div></div><div class="learning-pills">'+awards.map(a=>'<span class="learning-pill">'+(a[1]?'✓ ':'○ ')+esc(a[0])+'</span>').join('')+'</div><div class="learning-actions"><button class="btn primary" id="practiceDaily">Начать мини-урок</button><button class="btn ghost" id="repeatMisses" '+(mistakes?'':'disabled')+'>Ошибки тестов ('+mistakes+')</button></div><p class="learning-empty">Интервалы повторения — подсказка для практики, не научно откалиброванный прогноз памяти. Данные хранятся локально.</p>';
    w.appendChild(panel);
    document.getElementById('practiceDaily').onclick=()=>{state.mode='daily';if(!daily.active||daily.finished)startDaily();else render();};
    document.getElementById('repeatMisses').onclick=beginMistakes;
    document.getElementById('resetData').onclick=()=>{
      if(confirm('Удалить весь локальный прогресс, историю повторений и дни практики?')) {
        saved={grades:{},quizzes:{attempts:0,right:0,wrong:0},interviews:0,reviewHistory:[],activityDays:{},lessons:0,quizMisses:{}};
        daily.active=false;daily.finished=false;save();toast('Локальный прогресс очищен');render();
      }
    };
  };
  const coreRender=render;
  render=function(){coreRender();if(state.mode==='daily')renderDaily();updateWelcome();};
  document.querySelectorAll('.tab').forEach(t=>{if(t.dataset.mode==='daily')t.onclick=()=>{state.mode='daily';render();};});
  render();
  window.QALearning={localDay:localDay,dueDate:dueDate,selectThreeCards:selectThreeCards,studyStreak:studyStreak};
})();
