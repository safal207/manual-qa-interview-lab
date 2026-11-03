/* QA Interview Lab: adaptive, fully local tech-lead dialogue.
   Important: keyword-based routing is not AI scoring or semantic evaluation. */
(function () {
  'use strict';
  if (!window.QASimulator || !document.getElementById('workspace')) return;

  const ROUNDS = 4;
  const CASES = window.QASimulator.cases;
  const CONFIG = {
    payments: {
      opening: 'Клиент жалуется на двойное списание после HTTP 504. Какие первые три действия предпримешь и чего точно не станешь делать в production?',
      topics: [
        {id:'idempotency', label:'повторы / идемпотентность', pattern:/идемпотент|idempoten|retry|ретра|повтор(н|н[а-я]* запрос|ы|ит)|ключ(а|ей)? повтор/iu,
          question:'Ты упомянул повторную попытку или идемпотентность. Как проверишь, что оба запроса относятся к одному логическому платежу, и что должно произойти при повторе с тем же ключом?'},
        {id:'psp', label:'подтверждение списаний', pattern:/psp|шлюз|бан[кч]|ledger|реестр|списан|транзакц|ден(ьг|ег)|плат[её]ж[а-я]* статус/iu,
          question:'Ты предлагаешь сверять платёжные операции. Какие идентификаторы и статусы сопоставишь у API, PSP и в ledger, чтобы не принять две записи UI за два фактических списания?'},
        {id:'timeout', label:'таймаут и HTTP', pattern:/504|timeout|тайм.?аут|http|gateway|ответ сервера|статус.?код/iu,
          question:'Ты говоришь о таймауте. Почему 504 не доказывает откат операции, и какой безопасный способ восстановить её реальный исход?'},
        {id:'evidence',label:'логи и идентификаторы',pattern:/лог|trace|трейс|request.?id|correlat|коррел|метрик|идентификатор|времен[иа]|order.?id/iu,
          question:'Ты начал с логов или идентификаторов. Как связать один пользовательский заказ с несколькими запросами и денежными операциями, не собирая платёжные секреты?'},
        {id:'release',label:'ограничение риска',pattern:/релиз|roll.?back|откат|блокир|останов|feature.?flag|фича.?флаг|рис[кк]|инцидент|эскалир/iu,
          question:'Ты затронул ограничение риска. При каких проверенных сигналах предложишь временно ограничить путь оплаты, а когда достаточно мониторинга и адресного исправления?'}
      ],
      clarify:'Какую одну read-only проверку ты сделаешь прямо сейчас, чтобы отличить UI-дубль от двух денежных операций?',
      second:'Представь: PSP подтвердил одну операцию, а UI показывает две. Какой следующий тест и какой источник данных изменят твою гипотезу?',
      closing:'Подведи итог для техлида: что известно точно, что пока гипотеза и какой конкретный критерий позволит безопасно продолжить платежи?',
      checklist:['Отделять UI-симптом от подтверждённого финансового события','Сопоставлять order ID, request ID, PSP и ledger','Проверять идемпотентность без повторных реальных платежей','Обосновывать ограничение риска и остаточную неопределённость']
    },
    auth: {
      opening:'На Android PWA после logout иногда возникает oauth_state_mismatch. В Chrome-вкладке проблема не воспроизводится. Как локализуешь её без раскрытия токенов?',
      topics:[
        {id:'state',label:'state / callback',pattern:/oauth|state|callback|redirect|редирект|pkce|code.?verifier/iu,
          question:'Ты упомянул OAuth state или callback. Как проверишь связь state до редиректа и после возвращения в PWA, не записывая секретные значения в баг-репорт?'},
        {id:'cookies',label:'cookie / storage',pattern:/cook|кук|samesite|secure|httponly|storage|localstorage|sessionstorage|сессионн/iu,
          question:'Ты предложил проверить cookie или storage. Какие параметры и области видимости сравнишь у PWA и обычной вкладки, особенно после logout?'},
        {id:'contexts',label:'контексты запуска',pattern:/pwa|android|chrome|браузер|standalone|webview|контекст|девайс|устройств/iu,
          question:'Ты сравниваешь среды. Как построишь минимальную матрицу условий, чтобы отличить проблему установленной PWA от версии Android или случайного сбоя сети?'},
        {id:'race',label:'гонка / повторный вход',pattern:/race|гонк|врем[яе]|после выхода|logout|повторн|асинхрон|очистк|кэш|cache/iu,
          question:'Ты говоришь о времени и повторном входе. Какие события logout → очистка состояния → запуск OAuth нужно упорядочить, чтобы проверить race condition?'},
        {id:'security',label:'безопасность входа',pattern:/безопас|защит|csrf|угроз|атак|отключ.*провер|снять.*state|логирован|секрет|токен/iu,
          question:'Ты затронул безопасность. Почему отключение проверки state нельзя считать корректным исправлением, и как проверить fix без ослабления защиты?'}
      ],
      clarify:'Какую пару окружений и какой один артефакт Network ты сравнишь, чтобы сделать проблему воспроизводимой?',
      second:'Пусть ошибка появляется только на втором входе после logout. Какой последовательностью запросов проверишь потерю state или гонку очистки?',
      closing:'Какие результаты обязательной регрессии на Android PWA убедят тебя, что повторный вход можно безопасно выпускать?',
      checklist:['Сравнить установленную PWA и обычную вкладку при одинаковых условиях','Проверить state, redirect, cookies и очистку состояния после logout','Не раскрывать коды, токены и значения state в отчётах','Сохранить OAuth-защиты и проверить повторные циклы входа']
    },
    websocket: {
      opening:'WebSocket отвечает на ping/pong, но котировки на экране отстают на 6–9 секунд. Как доказать, что данные устарели и где возникает задержка?',
      topics:[
        {id:'timestamps',label:'время / свежесть',pattern:/timestamp|врем[яе]|времен[и]|latenc|задерж|fresh|свеж|stale|возраст данн|p95|p99/iu,
          question:'Ты упомянул задержку или свежесть. Какие временные метки возьмёшь у источника, брокера, WS и UI, чтобы отделить network lag от запоздалого рендера?'},
        {id:'sequence',label:'sequence / snapshot',pattern:/sequenc|последоват|snapshot|снапшот|delta|дельт|gap|пропущ|потер[юя]|resync|рассинхрон/iu,
          question:'Ты затронул sequence или delta. Как воспроизведёшь пропуск сообщения и проверишь, что snapshot восстанавливает непротиворечивое состояние?'},
        {id:'broker',label:'очереди / брокер',pattern:/broker|брокер|redis|kafka|очеред|backpressure|producer|consumer|паблиш|подписк/iu,
          question:'Ты говоришь о брокере или подписках. Какое измерение на publish → broker → consumer поможет понять, на каком участке копится отставание?'},
        {id:'connection',label:'сокет / heartbeat',pattern:/websocket|ws\b|ping|pong|heartbeat|соединени|disconnect|reconnect|переподключ/iu,
          question:'Ты проверяешь соединение. Почему успешный heartbeat ничего не говорит о полноте данных, и как обнаружить silent stale при живом WS?'},
        {id:'release',label:'риски торговли',pattern:/терминал|рис[кк]|релиз|запрет|предупрежд|показ|вывод|огранич|котировк|пользоват/iu,
          question:'Ты затронул риск для пользователя. Как должен вести себя UI, если последняя котировка старше допустимого порога, и как задать release gate?'}
      ],
      clarify:'Какую пару источников и какую конкретную метрику ты сопоставишь для доказательства задержки?',
      second:'Представь, что потеряна одна delta, но соединение живое. Как поймёшь, что локальный стакан уже нельзя считать корректным?',
      closing:'Какие измеримые пороги свежести, восстановления и пользовательского предупреждения предложишь для Go/No-go?',
      checklist:['Проверять актуальность сообщений независимо от статуса соединения','Сверять timestamps и sequence ID по всей цепочке','Тестировать gap, snapshot recovery, backpressure и повторную подписку','Определять stale-индикатор, SLA свежести и release gate']
    },
    database: {
      opening:'Dashboard показывает 928 заказов, SQL-запрос с JOIN возвращает 861. Расчёт влияет на бонусы. Как начнёшь расследование?',
      topics:[
        {id:'metric',label:'семантика метрики',pattern:/метрик|определени|бизнес|статус|заказ.*счит|оплачен|отмен|тестов[ыа]|услови|правил/iu,
          question:'Ты упомянул бизнес-правила. Какие статусы и типы заказов войдут в метрику, и кто подтвердит единое определение для SQL и dashboard?'},
        {id:'joins',label:'JOIN / связи',pattern:/join|джойн|связ|left|inner|foreign|1:n|один.?ко.?мног|дубликат|distinct/iu,
          question:'Ты начал с JOIN. Как LEFT и INNER JOIN меняют количество строк, и где COUNT(DISTINCT order_id) поможет найти размножение записей?'},
        {id:'time',label:'период / реплика',pattern:/time.?zone|timezone|utc|сут[кк]|д(ень|ня)|вчера|границ|период|реплик|lag|задерж/iu,
          question:'Ты упомянул время или реплику. Как убедишься, что обе системы считают один и тот же интервал, учитывая timezone и replication lag?'},
        {id:'null',label:'NULL / фильтры',pattern:/null|where|filter|фильтр|отсутств|без оплаты|payment|пуст|дебаг|выборк/iu,
          question:'Ты затронул фильтрацию. Что произойдёт с LEFT JOIN, если условие WHERE требует поле из payments, и как найдёшь заказы без соответствующей записи?'},
        {id:'release',label:'риск выплат',pattern:/бонус|деньг|выплат|релиз|риск|go.?no.?go|блок|остан|reconcil|сверк/iu,
          question:'Ты затронул денежный эффект. Какие данные нужно сверить и с кем согласовать критерий остановки расчёта, чтобы не выплатить неверные бонусы?'}
      ],
      clarify:'Сформулируй одно проверяемое предположение о расхождении и SQL-выборку, которой его опровергнешь.',
      second:'Представь: часть заказов не имеет платежа. Как отличишь ошибку INNER JOIN от корректного исключения неоплаченных заказов?',
      closing:'Что покажешь продакту и бухгалтерии перед релизом: какие данные подтверждены, а где требуется согласовать бизнес-правило?',
      checklist:['Уточнить зернистость и определение метрики заказа','Сравнить INNER/LEFT JOIN, NULL и COUNT(DISTINCT)','Выравнять временные интервалы, таймзоны и источники данных','Оценить влияние расхождения на бонусный расчёт и согласовать выпуск']
    }
  };

  const MAX_LENGTH=1800;
  const clean = value => String(value||'').replace(/\r\n?/g,'\n').trim().slice(0,MAX_LENGTH);
  const escape = value => esc(String(value));
  const now = () => new Date().toISOString();
  function storage() {
    if(!saved.coach || typeof saved.coach!=='object')saved.coach={active:null,history:[]};
    if(!Array.isArray(saved.coach.history))saved.coach.history=[];
    if(saved.coach.active && !CONFIG[saved.coach.active.caseId])saved.coach.active=null;
    return saved.coach;
  }
  function asCase(id){return CASES.find(c=>c.id===id);}
  function profile(id){return CONFIG[id];}
  function detect(id,input) {
    const c=profile(id), text=clean(input).toLowerCase();
    if(!c) return [];
    return c.topics.filter(t=>t.pattern.test(text)).map(t=>t.id);
  }
  function leadMessage(text,kind,subject) {return {role:'lead',text,kind,subject:subject||null,time:now()};}
  function userMessage(text,topics) {return {role:'candidate',text,topics,time:now()};}
  function initial(id) {
    return {caseId:id,phase:'chat',turns:0,used:[],messages:[leadMessage(profile(id).opening,'opening')],draft:'',rating:null,started:now(),completed:null};
  }
  function start(id) {
    if(!profile(id))return false;
    storage().active=initial(id);
    save();
    state.mode='coach';
    render();
    return true;
  }
  function followup(session,answer) {
    const config=profile(session.caseId);
    const topics=detect(session.caseId,answer);
    const round=session.turns;
    // The closing follow-up must be grounded in a recently mentioned topic.
    if(round>=3){
      const lastTopic=config.topics.find(t=>topics.includes(t.id));
      const contextual=lastTopic?(' Ты упомянул «'+lastTopic.label+'». Включи это в обоснование.'):'';
      return {id:'closing',text:config.closing+contextual,kind:'closing',topics};
    }
    if(clean(answer).length<28 && !session.used.includes('clarify')){
      return {id:'clarify',text:'Мне пока не хватает конкретных действий. '+config.clarify,kind:'clarify',topics};
    }
    const match=config.topics.find(t=>topics.includes(t.id) && !session.used.includes(t.id));
    if(match) return {id:match.id,text:match.question,kind:'topic',topics};
    if(round===2 && !session.used.includes('second')) return {id:'second',text:config.second,kind:'second',topics};
    if(!session.used.includes('clarify')) return {id:'clarify',text:config.clarify,kind:'clarify',topics};
    return {id:'second',text:config.second,kind:'second',topics};
  }
  function submit(text) {
    const a=storage().active;
    if(!a || a.phase!=='chat' || a.turns>=ROUNDS)return {ok:false,reason:'inactive'};
    const response=clean(text===undefined?a.draft:text);
    if(response.length<8)return {ok:false,reason:'short'};
    const topics=detect(a.caseId,response);
    a.messages.push(userMessage(response,topics));
    a.turns+=1;a.draft='';
    if(a.turns===ROUNDS){
      a.phase='review';
    }else{
      const follow=followup(a,response);
      a.used.push(follow.id);
      a.messages.push(leadMessage(follow.text,follow.kind,follow.id));
    }
    save();render();
    return {ok:true,turns:a.turns,phase:a.phase,next:a.messages[a.messages.length-1].role==='lead'?a.messages[a.messages.length-1].text:null};
  }
  function draft(value) {
    const a=storage().active;
    if(!a||a.phase!=='chat')return;
    a.draft=String(value||'').slice(0,MAX_LENGTH);
    save();
  }
  function finish(rating) {
    const a=storage().active;
    if(!a||a.phase!=='review'||![0,1,2].includes(rating))return false;
    a.rating=rating;a.phase='done';a.completed=now();
    const copy=JSON.parse(JSON.stringify(a));
    storage().history.unshift(copy);
    storage().history=storage().history.slice(0,10);
    save();render();return true;
  }
  function resume(){const a=storage().active;if(!a)return false;state.mode='coach';render();return true;}
  function discard() {
    // Only the active draft is discarded; completed local practice is retained.
    storage().active=null;save();render();
  }
  function transcript(a) {
    const c=asCase(a.caseId);
    const out=['QA Interview Lab — разговор с техлидом', 'Кейс: '+c.title,
      'Начато: '+a.started,'Завершено: '+(a.completed||'не завершено'),''];
    a.messages.forEach(m=>{out.push((m.role==='lead'?'Техлид':'Кандидат')+': '+m.text);out.push('');});
    if(a.rating!==null)out.push('Самооценка: '+['Нужно больше практики','Частично','Уверенно'][a.rating]);
    out.push('Режим: локальная маршрутизация вопросов по словам в ответе, без AI-проверки смысла.');
    return out.join('\n');
  }
  function download(text,filename) {
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const uri=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=uri;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(uri),1000);
  }
  function exportActive() {
    const a=storage().active;
    if(!a)return false;
    download(transcript(a),'qa-techlead-'+a.caseId+'.txt');return true;
  }
  function allMentioned(a) {
    const p=profile(a.caseId), tags=new Set();
    a.messages.filter(m=>m.role==='candidate').forEach(m=>detect(a.caseId,m.text).forEach(x=>tags.add(x)));
    return p.topics.map(x=>({id:x.id,label:x.label,mentioned:tags.has(x.id)}));
  }
  function jumpCatalog() {storage().active=null;save();state.mode='coach';render();}
  const steps = a => '<div class="tl-steps" aria-label="Ход собеседования">' +
    [1,2,3,4].map(i=>'<span class="'+(a.turns>=i?'done':a.turns===i-1?'current':'')+'">'+i+'</span>').join('')+'</div>';
  function cards() {
    const s=storage(),completed=new Set(s.history.map(h=>h.caseId));
    return '<section class="tl-intro"><div><div class="tl-eyebrow">Новая практика · 6–9 минут</div><h2>Диалог с техлидом</h2><p>Отвечай своими словами. Следующий вопрос меняется в зависимости от тем, которые ты упомянул. В конце — чек-лист сильного ответа и самооценка. Без бесконечных сообщений.</p></div><div class="tl-progress">'+completed.size+' / '+CASES.length+'<small>кейсов пройдено</small></div></section>'+
      (s.active&&s.active.phase!=='done'?'<div class="tl-continue"><div><strong>Сохранён незавершённый разговор</strong><p>'+escape(asCase(s.active.caseId).title)+' · '+s.active.turns+' из '+ROUNDS+' ответов</p></div><button class="btn primary" id="tlResume">Продолжить →</button></div>':'')+
      '<div class="tl-catalog">'+CASES.map(c=>'<article class="tl-case"><div class="tl-case-meta"><span>'+c.icon+'</span><span>'+escape(c.level)+'</span></div><h3>'+escape(c.title)+'</h3><p>'+escape(c.teaser)+'</p><div class="tl-case-foot"><span>'+(completed.has(c.id)?'Есть завершённая практика':'Новый диалог')+'</span><button class="btn '+(completed.has(c.id)?'ghost':'primary')+'" data-tl-start="'+escape(c.id)+'">'+(completed.has(c.id)?'Пройти ещё раз':'Начать разговор')+'</button></div></article>').join('')+'</div>'+
      '<p class="tl-disclaimer">Реплики выбирает локальное правило по тематическим словам, а не языковая модель. Отсутствие или наличие ключевого слова не доказывает уровень знаний. История остаётся в этом браузере.</p>';
  }
  function messagesHtml(messages) {
    return '<div class="tl-thread" role="log" aria-live="polite" aria-label="Ход диалога">'+messages.map(m=>
      '<div class="tl-message '+(m.role==='candidate'?'tl-me':'tl-lead')+'"><div class="tl-avatar">'+(m.role==='candidate'?'QA':'TL')+'</div><div class="tl-bubble"><div class="tl-message-role">'+(m.role==='candidate'?'Ты, кандидат':'Техлид')+'</div><div class="tl-message-text">'+escape(m.text)+'</div></div></div>'
    ).join('')+'</div>';
  }
  function chat(a) {
    const c=asCase(a.caseId);
    return '<section class="tl-shell"><div class="tl-header"><button class="tl-back" id="tlBack">← Все кейсы</button><span>Раунд '+(a.turns+1)+' / '+ROUNDS+'</span></div>'+
      '<h2>'+escape(c.title)+'</h2>'+steps(a)+'<details class="tl-context"><summary>Условия задачи (можно свернуть)</summary><p>'+escape(c.context)+'</p></details>'+
      messagesHtml(a.messages)+
      '<div class="tl-compose"><label for="tlAnswer">Твой ответ — что проверишь, почему и какой результат ожидаешь?</label><textarea id="tlAnswer" maxlength="'+MAX_LENGTH+'" rows="4" placeholder="Например: сначала зафиксирую факт..., затем сверю...">'+escape(a.draft)+'</textarea>'+
      '<div class="tl-compose-foot"><span id="tlLength">'+a.draft.length+' / '+MAX_LENGTH+' символов · Ctrl+Enter — отправить</span><button class="btn primary" id="tlSend" '+(clean(a.draft).length<8?'disabled':'')+'>Ответить →</button></div>'+
      '<p class="tl-hint">После отправки ответ фиксируется. Это тренировка аргументации, а не автоматический разбор свободного текста.</p></div></section>';
  }
  function review(a) {
    const c=asCase(a.caseId),topics=allMentioned(a), mentioned=topics.filter(x=>x.mentioned),missing=topics.filter(x=>!x.mentioned);
    return '<section class="tl-shell"><div class="tl-header"><button class="tl-back" id="tlBack">← Все кейсы</button><span>Все '+ROUNDS+' раунда пройдены</span></div><div class="tl-eyebrow">Рефлексия после интервью</div><h2>'+escape(c.title)+'</h2>'+
      '<p class="tl-caption">Чек-лист — ориентир для самостоятельного разбора. Система определяет только упоминание слов, но не правильность рассуждений.</p>'+
      '<div class="tl-checklist"><h3>Критерии ответа Middle / Senior</h3>'+profile(a.caseId).checklist.map(x=>'<div class="tl-check"><span>✓</span>'+escape(x)+'</div>').join('')+'</div>'+
      '<div class="tl-topic-grid"><div><h3>Темы, которые встречались в ответах</h3>'+(mentioned.length?mentioned.map(x=>'<span class="tl-topic">'+escape(x.label)+'</span>').join(''):'<p>Не обнаружены по словарю. Это не означает, что мыслей не было.</p>')+'</div><div><h3>Темы для дополнительной проверки</h3>'+(missing.length?missing.map(x=>'<span class="tl-topic muted">'+escape(x.label)+'</span>').join(''):'<p>Все темы были упомянуты. Уточни качество объяснения по чек-листу.</p>')+'</div></div>'+
      '<h3 class="tl-self-title">Насколько уверенно ты защитил решение?</h3><p class="tl-caption">Поставь себе оценку после сравнения ответов с критериями, затем сохраним результат.</p><div class="tl-rate"><button class="btn ghost" data-tl-rate="0">Нужна практика</button><button class="btn ghost" data-tl-rate="1">Частично</button><button class="btn primary" data-tl-rate="2">Уверенно</button></div>'+
      '<details class="tl-record"><summary>Посмотреть историю диалога</summary>'+messagesHtml(a.messages)+'</details></section>';
  }
  function done(a) {
    const c=asCase(a.caseId);
    return '<section class="tl-shell tl-done"><div class="tl-eyebrow">Диалог завершён</div><div class="tl-done-symbol">✓</div><h2>Ты завершил разговор с техлидом</h2><p>Кейс «'+escape(c.title)+'»: '+a.turns+' текстовых ответов, несколько уточняющих вопросов и самостоятельная оценка.</p>'+
      '<div class="tl-finish-stats"><div><strong>'+a.turns+' / '+ROUNDS+'</strong><span>ответов</span></div><div><strong>'+['Повторить','Частично','Уверенно'][a.rating]+'</strong><span>самооценка</span></div></div>'+
      '<div class="tl-done-actions"><button class="btn primary" id="tlAgain">Повторить кейс</button><button class="btn ghost" id="tlExport">Скачать диалог TXT</button><button class="btn ghost" id="tlBack">Другие кейсы</button></div>'+
      '<details class="tl-record"><summary>Посмотреть полный диалог</summary>'+messagesHtml(a.messages)+'</details>'+
      '<p class="tl-disclaimer">Самооценка не является автоматической проверкой ответа. История сохраняется локально; экспорт остаётся под твоим контролем.</p></section>';
  }
  function renderCoach(){
    if(state.mode!=='coach')return;
    const a=storage().active;
    const w=document.getElementById('workspace');
    w.innerHTML=!a?cards():a.phase==='chat'?chat(a):a.phase==='review'?review(a):done(a);
    w.querySelectorAll('[data-tl-start]').forEach(b=>b.onclick=()=>{if(a&&a.phase==='chat'&&!window.confirm('Начать новый диалог? Текущий незавершённый разговор будет заменён.'))return;start(b.dataset.tlStart);});
    const resumeBtn=document.getElementById('tlResume');
    if(resumeBtn)resumeBtn.onclick=resume;
    w.querySelectorAll('[data-tl-rate]').forEach(b=>b.onclick=()=>finish(Number(b.dataset.tlRate)));
    const back=document.getElementById('tlBack');
    if(back)back.onclick=jumpCatalog;
    const again=document.getElementById('tlAgain');
    if(again)again.onclick=()=>start(a.caseId);
    const exportButton=document.getElementById('tlExport');
    if(exportButton)exportButton.onclick=exportActive;
    const textarea=document.getElementById('tlAnswer');
    if(textarea){
      textarea.oninput=()=>{draft(textarea.value);document.getElementById('tlLength').textContent=textarea.value.length+' / '+MAX_LENGTH+' символов · Ctrl+Enter — отправить';document.getElementById('tlSend').disabled=clean(textarea.value).length<8;};
      textarea.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send.click();}};
    }
    const send=document.getElementById('tlSend');
    if(send)send.onclick=()=>submit(textarea.value);
  }
  const previousRender=render;
  render=function(){
    previousRender();
    const isCoach=state.mode==='coach';
    const controls=document.getElementById('controls');
    if(controls)controls.classList.toggle('hidden',isCoach||state.mode==='simulator'||state.mode==='progress');
    const home=document.getElementById('learningHome');
    if(home)home.classList.toggle('sim-home-hidden',isCoach||state.mode==='simulator');
    if(isCoach)renderCoach();
  };
  storage();
  render();
  window.QATechLead={config:CONFIG,detect,followup,start,submit,draft,finish,resume,storage,exportActive,allMentioned,transcript};
})();