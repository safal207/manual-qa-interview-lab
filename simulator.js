/* QA Simulator — scenario-based practice with transparent, rule-based feedback. */
(function () {
  'use strict';
  if (!document.getElementById('workspace') || typeof state === 'undefined' || typeof save !== 'function') return;

  const CASES = [
    {
      id:'payments', icon:'01', level:'Middle / Senior', minutes:'7–10 мин', title:'Двойное списание после таймаута',
      domain:'Платежи · API · критические риски',
      teaser:'Покупатель сообщает, что платёж за один заказ прошёл дважды. В клиенте виден таймаут.',
      context:'В 11:42 клиент получил 504 при оплате заказа O-204. После повторной попытки в интерфейсе показаны две операции. Подтверждения от платёжного шлюза пока нет. У тебя нет права выполнять реальные платежи в production.',
      focus:'Отличить повтор записи в UI от двух фактических списаний; проверить идемпотентность и безопасно эскалировать.',
      model:['Уточнить идентификаторы заказа, операций и время, не запрашивая платёжные секреты','Сопоставить клиентский запрос, API, платёжный шлюз и состояние ledger','Проверить поведение после таймаута и повторной отправки с одинаковым ключом идемпотентности','Оценить фактический ущерб, масштаб и необходимость ограничения оплаты','Сообщить владельцу платежей, какие факты подтверждены и какие ещё неизвестны'],
      phases:[
        {
          label:'Триаж', question:'Что сделаешь первым, чтобы не навредить пользователям?',
          mentor:'Отдели симптом в приложении от фактического движения денег. Учитывай ограничения production.',
          options:[
            {label:'Соберу ID заказа, время, статусы операций и обезличенные подтверждения',outcome:'Ты зафиксировал воспроизводимый инцидент без дополнительных транзакций и без раскрытия карточных данных.',evidence:'Есть order ID, временная метка и два UI-представления; списание ещё не доказано.',score:[2,2,2]},
            {label:'Сразу объявлю, что деньги списались дважды и всё приложение надо остановить',outcome:'Команда получила громкий сигнал, но без проверки статуса транзакций остановка всего сервиса может быть неоправданной.',evidence:'Критичность заявлена, финансовые операции не сверены.',score:[0,1,1]},
            {label:'Повторю реальный платёж в production, чтобы убедиться',outcome:'Тест создал риск дополнительного списания и исказил сведения об инциденте.',evidence:'Создана потенциально опасная новая транзакция.',score:[0,0,0]},
            {label:'Запрошу read-only сверку шлюза и ledger по заказу',outcome:'Появился надёжный путь проверить, действительно ли подтверждены два списания, без записи в боевые системы.',evidence:'Ожидается read-only сверка PSP и внутренних записей.',score:[2,2,1]}
          ]
        },
        {
          label:'Расследование', question:'Заказ получил 504. Как проверить причину возможного дубля?',
          mentor:'HTTP 504 не гарантирует, что операция на сервере отменена.',
          options:[
            {label:'Сверю retry, request ID, idempotency key, операции PSP и статусы заказа',outcome:'Обнаружена важная гипотеза: повторный запрос мог пройти с новым ключом после того, как первый завершился.',evidence:'Проверены ключи идемпотентности, цепочка запросов и результаты PSP.',score:[2,2,2]},
            {label:'Буду считать, что 504 означает отмену платежа',outcome:'504 говорит о проблеме получения ответа через шлюз; исход внутренней операции остаётся неизвестным.',evidence:'Серверный исход операции остался непроверенным.',score:[0,0,0]},
            {label:'Проверю только SQL-таблицу заказов',outcome:'Это выявит внутренние дубли, но не покажет, сколько денежных операций фактически подтверждено на стороне PSP.',evidence:'Сведения о заказах есть, PSP и попытки оплаты не сверены.',score:[1,1,0]},
            {label:'Повторю отрицательный сценарий на sandbox с контролем повторных запросов',outcome:'Безопасный сценарий воспроизведения найден; для вывода об уже произошедших списаниях всё ещё нужна сверка боевых записей.',evidence:'Есть воспроизведение в sandbox; продовые транзакции не доказаны.',score:[2,2,1]}
          ]
        },
        {
          label:'Решение', question:'Что рекомендуешь команде до выхода исправления?',
          mentor:'Действия зависят от подтверждённого масштаба, возможного ущерба и путей ограничения риска.',
          options:[
            {label:'Эскалировать платёжной команде; ограничить рискованный путь; проверить операции и компенсации',outcome:'Решение учитывает защиту клиентов, проверку финансового эффекта, наблюдение и восстановление без догадок.',evidence:'Подготовлены критерии ограничения, сверки и последующей регрессии.',score:[2,2,2]},
            {label:'Закрыть инцидент: воспроизводится редко',outcome:'Частота не отменяет финансовую критичность. Риск повторных списаний остаётся без контроля.',evidence:'Отсутствует согласованное решение по финансовому риску.',score:[0,0,0]},
            {label:'Сразу выкатить изменение retry без дополнительных проверок',outcome:'Спешный фикс способен затронуть успешные платежи, повторы и обработку незавершённых операций.',evidence:'Нужны тесты на таймауты, подтверждения и идемпотентность.',score:[1,0,1]},
            {label:'Отключить весь продукт, не сверяя фактов и без согласования',outcome:'Защита пользователей важна, но столь широкий шаг без оценки масштаба и ответственного решения может навредить сервису.',evidence:'Нет границ воздействия и согласованного плана действий.',score:[0,1,0]}
          ]
        }
      ]
    },
    {
      id:'auth',icon:'02',level:'Middle',minutes:'6–9 мин',title:'OAuth ломается в установленной PWA',
      domain:'Android · PWA · OAuth',
      teaser:'На Android после выхода из приложения повторный вход иногда заканчивается ошибкой state.',
      context:'После logout в установленной Android PWA повторный вход через OAuth иногда возвращает 400 oauth_state_mismatch. В обычной вкладке Chrome и на desktop ошибка не повторяется. Токены и коды доступа в отчёты не добавляем.',
      focus:'Локализовать различие контекстов, проверить redirect/state/cookies и предложить безопасную стратегию релиза.',
      model:['Отдельно воспроизвести PWA, обычную вкладку и desktop при одинаковых условиях','Записать последовательность redirect и время создания/возврата state','Проверить cookie attributes, scope, очистку storage и гонки после logout','Изучить OAuth-параметры без публикации токенов, code, state или секретов','Подтвердить fix и негативные сценарии PWA на реальных Android-устройствах'],
      phases:[
        {
          label:'Воспроизведение',question:'Как составишь первый план проверки?',
          mentor:'Отличие проявляется только в одном контексте приложения, это помогает сузить причину.',
          options:[
            {label:'Сравню PWA и Chrome: шаги logout/login, storage, redirect, версию Android',outcome:'Получена матрица контекстов, позволяющая локализовать проблему без подмены исходных условий.',evidence:'Зафиксированы условия воспроизведения и различия между PWA и браузером.',score:[2,2,2]},
            {label:'Сброшу все данные на телефоне пользователя',outcome:'Симптом может исчезнуть, но доказательства будут уничтожены, а причина останется неизвестной.',evidence:'Исходное состояние storage утрачено.',score:[0,0,0]},
            {label:'Сделаю вывод, что виноват провайдер OAuth',outcome:'Пока нет подтверждения, на какой стороне нарушена связка state с исходной сессией.',evidence:'Причина названа без достаточных фактов.',score:[0,1,0]},
            {label:'Проверю только успешный логин после холодного запуска',outcome:'Такой тест полезен, но пропускает критический сценарий именно после logout и повторного входа.',evidence:'Повторная авторизация после выхода не охвачена.',score:[1,1,0]}
          ]
        },
        {
          label:'Сбор сигналов',question:'На callback виден state mismatch. Что исследовать дальше?',
          mentor:'Проверяй жизненный цикл state и доступность связанного состояния в момент возврата.',
          options:[
            {label:'Сопоставлю создание state, redirect и cookie scope/flags в разных контекстах',outcome:'Сужен круг причин: состояние после logout, контекст cookies и возврат из внешнего браузера.',evidence:'Есть последовательность state от начала OAuth до callback.',score:[2,2,2]},
            {label:'Отключу проверку state, чтобы восстановить вход',outcome:'Это устраняет важную защиту OAuth и создаёт риск атаки на привязку запроса авторизации.',evidence:'Защита state отключена — неприемлемый workaround.',score:[0,0,0]},
            {label:'Поставлю SameSite=None для всех cookies без анализа контекстов',outcome:'Массовое изменение политики cookies может создать риски. Нужны конкретные требования сценария и флаги Secure.',evidence:'Гипотеза о cookie задана, но параметры и необходимость не подтверждены.',score:[1,0,0]},
            {label:'Сниму обезличенные HAR/Network и проверю очистку storage при logout',outcome:'Сохранены сравнительные сетевые наблюдения, помогшие проверить гонки и потерю сессионного контекста.',evidence:'Получена безопасная последовательность запросов и storage-изменений.',score:[2,2,1]}
          ]
        },
        {
          label:'Релизное решение',question:'Как сообщить о проблеме и оценить выпуск?',
          mentor:'Ситуация касается повторной авторизации; важны степень блокировки и доступность обходного сценария.',
          options:[
            {label:'Оформлю воспроизводимый баг; оценю масштаб, workaround и блокер для Android PWA',outcome:'Команда получила основанную на фактах оценку рисков и конкретный набор проверок перед релизом.',evidence:'Есть шаги, expected/actual, среда, частота и release risk.',score:[2,2,2]},
            {label:'Закрою баг, потому что на desktop всё работает',outcome:'Сломанный отдельный путь пользовательского входа остаётся критичным для части аудитории.',evidence:'Android PWA остаётся непроверенной зоной релиза.',score:[0,0,0]},
            {label:'Добавлю временный обход и документирую его без тестирования',outcome:'Обход может снизить неудобство, но без проверки рискует нарушить обработку state или сессий.',evidence:'Отсутствуют проверки безопасности и повторного входа.',score:[1,0,1]},
            {label:'Проверю fix только один раз на собственном телефоне',outcome:'Один успешный запуск не подтверждает устойчивость intermittent дефекта в разных контекстах.',evidence:'Недостаточно регрессии и повторных циклов logout/login.',score:[1,1,0]}
          ]
        }
      ]
    },
    {
      id:'websocket',icon:'03',level:'Senior',minutes:'7–10 мин',title:'WebSocket открыт, а котировки устарели',
      domain:'Realtime · WebSocket · брокер',
      teaser:'Соединение выглядит живым, но экран терминала показывает старые цены.',
      context:'В терминале WebSocket подключён, ping/pong успешный. Через несколько минут bid/ask на экране перестаёт обновляться на 6–9 секунд. HTTP healthcheck остаётся 200; активные подписки не показывают ошибок.',
      focus:'Отличить живое соединение от актуальности данных, проверить потери событий и стратегию resync.',
      model:['Замерить возраст данных и задержки по всей цепочке producer→broker→WS→UI','Сопоставить sequence ID, snapshot и delta, а не только статус соединения','Проверить reconnection, backpressure, подписку и восстановление после gap','Доказать расхождение отображения относительно авторитетного источника','Обозначить риск stale quotes для пользовательского решения и контролируемый release gate'],
      phases:[
        {
          label:'Наблюдение',question:'Как доказать, что проблема в свежести данных, а не только в UI?',
          mentor:'Зелёный WebSocket и heartbeat сами по себе ничего не говорят об актуальности сообщений.',
          options:[
            {label:'Сверю timestamps, sequence ID и bid/ask между source, WS и UI',outcome:'Получена временная цепочка, указывающая на реальную задержку данных.',evidence:'Сопоставлены источник, доставка и экран по времени и последовательности.',score:[2,2,2]},
            {label:'Ограничусь проверкой HTTP /health = 200',outcome:'Healthcheck подтверждает доступность endpoint, но не качество доставки realtime updates.',evidence:'Нет измерений свежести котировок.',score:[0,1,0]},
            {label:'Переоткрою страницу и сниму баг, если цены ожили',outcome:'Перезагрузка может скрыть дефект и не обнаруживает потерю или задержку событий.',evidence:'Зафиксирован временный обход, причина не установлена.',score:[1,1,0]},
            {label:'Сразу увеличу число подписок в production для проверки нагрузки',outcome:'Дополнительная нагрузка может усилить деградацию. Сначала нужны текущие метрики и безопасный стенд.',evidence:'Нагрузка увеличена до установления причины.',score:[0,0,0]}
          ]
        },
        {
          label:'Изоляция',question:'У WS-потребителя пропадает часть delta. Что проверишь?',
          mentor:'Подписка и сообщения могут быть успешными, пока непрерывность состояния нарушена.',
          options:[
            {label:'Проверю gap в sequence, snapshot recovery, отписку/подписку и backpressure',outcome:'Выделен наиболее опасный путь: пропущенный delta не компенсирован новым snapshot.',evidence:'Собраны признаки sequence gap и отсутствия resync.',score:[2,2,2]},
            {label:'Увеличу таймаут ping до 5 минут',outcome:'Heartbeat может перестать сигнализировать о проблемах ещё дольше, а gap данных не исчезнет.',evidence:'Контроль соединения ослаблен, состояние данных не восстановлено.',score:[0,0,0]},
            {label:'Сравню задержку publish→broker→consumer и очередь сообщений',outcome:'Сопоставление лагов по сегментам поможет локализовать bottleneck или отставание потребителя.',evidence:'Появился след задержки по этапам передачи.',score:[2,2,1]},
            {label:'Проверю только наличие новых записей в логах UI',outcome:'UI-логи могут показывать работу приложения без доказательства непрерывности событий.',evidence:'Потери на брокере и клиенте не исключены.',score:[1,1,0]}
          ]
        },
        {
          label:'Риск и выпуск',question:'Что рекомендуешь до релиза терминала?',
          mentor:'Подумай, как пользователь интерпретирует старую котировку при принятии финансового решения.',
          options:[
            {label:'Ввести stale-indicator, порог свежести, resync и gate на p95/p99 задержку',outcome:'Решение управляет пользовательским риском и делает деградацию измеримой.',evidence:'Сформулированы метрики свежести, восстановление и понятный сигнал UI.',score:[2,2,2]},
            {label:'Считать, что всё готово: соединение стабильно',outcome:'Наличие сокета недостаточно; неверные данные могут быть опаснее явной недоступности.',evidence:'Критерий качества данных отсутствует.',score:[0,0,0]},
            {label:'Скрыть проблемы за частым обновлением страницы',outcome:'Перезагрузка может замаскировать дефект, увеличить нагрузку и ухудшить пользовательский опыт.',evidence:'Корневая причина не исправлена.',score:[0,1,0]},
            {label:'Сделать регрессию восстановления после разрыва без проверки stale-состояния',outcome:'Проверка reconnect полезна, но отдельный риск устаревших сообщений остаётся.',evidence:'Проверен reconnect, но SLA свежести не согласован.',score:[1,1,1]}
          ]
        }
      ]
    },
    {
      id:'database',icon:'04',level:'Middle',minutes:'6–9 мин',title:'Отчёт заказов расходится с базой',
      domain:'SQL · интеграции · аналитика',
      teaser:'В админке 928 заказов за день, в SQL-выборке — 861. Релиз уже завтра.',
      context:'Продуктовая команда обнаружила: dashboard показывает 928 заказов за вчера, а ручной SQL-запрос с JOIN вернул 861. SQL выполняется на read-only реплике. Требования к «числу заказов» пока не согласованы.',
      focus:'Проверить определение метрики, зернистость, JOIN, фильтры и согласованность данных до принятия решения.',
      model:['Согласовать «что считается заказом»: созданные, оплаченные, отменённые, тестовые','Проверить временные зоны, границы дня, источник данных и задержку репликации','Сравнить COUNT(*) и COUNT(DISTINCT order_id), INNER/LEFT JOIN и WHERE фильтры','Проверить отсутствующие связи, дубли и NULL','Оформить reconciliation, оценить риск и не подменять ошибку SQL продуктовым дефектом'],
      phases:[
        {
          label:'Определение',question:'С чего начнёшь, если две цифры расходятся?',
          mentor:'Сравнение двух чисел бесполезно, если они относятся к разным сущностям или периодам.',
          options:[
            {label:'Уточню определение заказа, период, timezone, фильтры и источник dashboard',outcome:'Согласованы условия сравнения — теперь расхождение можно воспроизвести и объяснить.',evidence:'Сформулированы бизнес-правила метрики и один временной диапазон.',score:[2,2,2]},
            {label:'Сразу оформлю P0: dashboard неверен',outcome:'Неизвестно, одинаково ли обе стороны считают заказы. Критичность пока не обоснована.',evidence:'Метрика ещё не определена.',score:[0,1,0]},
            {label:'Поменяю число в отчёте вручную на 861',outcome:'Подгонка результата скрывает причину расхождения и ухудшает доверие к аналитике.',evidence:'Источник истины не установлен.',score:[0,0,0]},
            {label:'Повторю тот же запрос и сохраню скриншот',outcome:'Есть подтверждение воспроизводимости числа, но причины расхождения пока неизвестны.',evidence:'Результат запроса сохранён, условия сравнения не согласованы.',score:[1,1,0]}
          ]
        },
        {
          label:'SQL-диагностика',question:'INNER JOIN по payments отбрасывает часть заказов. Как это проверить?',
          mentor:'Не каждый заказ обязан иметь платёж; важно понимать, какую популяцию считает запрос.',
          options:[
            {label:'Сравню LEFT/INNER JOIN, NULL-связи, дубли, COUNT(DISTINCT) и фильтры',outcome:'Найдены заказы без payment и возможное размножение строк в 1:N связях.',evidence:'Проверены влияние JOIN, NULL и гранулярности на итоговую цифру.',score:[2,2,2]},
            {label:'Добавлю LIMIT 928, чтобы число совпало',outcome:'LIMIT ограничивает строки, но не исправляет семантику подсчёта.',evidence:'Источник расхождения остался невыясненным.',score:[0,0,0]},
            {label:'Изменю INNER JOIN на LEFT JOIN без проверки дополнительных условий',outcome:'Популяция увеличится, но WHERE по payment после JOIN может опять исключить NULL.',evidence:'Потенциальный эффект LEFT JOIN не проверен.',score:[1,1,0]},
            {label:'Проверю EXPLAIN и индекс без сравнения исходных строк',outcome:'План исполнения полезен для производительности, но не объясняет семантическую разницу количеств.',evidence:'Производительность проверена, логика выборки — нет.',score:[1,1,0]}
          ]
        },
        {
          label:'Релиз и коммуникация',question:'Отчёт участвует в расчёте бонусов. Как действовать?',
          mentor:'Ошибки отчётности важны, когда от них зависят денежные решения.',
          options:[
            {label:'Подготовлю reconciliation по правилам метрики и согласую блокировку бонусного расчёта',outcome:'Снижена вероятность неверных выплат; команда получила конкретные критерии корректности.',evidence:'Есть сверка заказов, root-cause гипотезы и решение по risk gate.',score:[2,2,2]},
            {label:'Оставлю как есть: цифры близкие',outcome:'Разница 67 заказов может существенно повлиять на выплаты и доверие к данным.',evidence:'Расхождение без анализа принято как допустимое.',score:[0,0,0]},
            {label:'Сменю SQL и сразу отдам цифру бухгалтерии',outcome:'Исправление запроса без проверки бизнес-правил может привести к новому некорректному расчёту.',evidence:'Не выполнена бизнес-валидация новой метрики.',score:[1,0,1]},
            {label:'Отправлю сообщение «SQL неверный», без примеров строк',outcome:'Предположение не подтверждено минимальным доказательством, разработчикам трудно локализовать проблему.',evidence:'Нет воспроизводимого набора идентификаторов и сравнения.',score:[0,1,0]}
          ]
        }
      ]
    }
  ];
  const DIMENSIONS=['Доказательства','Безопасность','Коммуникация'];
  const MAX_DIM=CASES[0].phases.length*2;
  function store() {
    if (!saved.simulator || typeof saved.simulator !== 'object') saved.simulator={history:{},active:null};
    if (!saved.simulator.history || typeof saved.simulator.history!=='object') saved.simulator.history={};
    return saved.simulator;
  }
  const getCase = id => CASES.find(s=>s.id===id);
  const maxScore = c => c.phases.length*3*2;
  function calculate(caseId, choices) {
    const c=getCase(caseId);
    if(!c) return null;
    const sums=[0,0,0],details=[];
    for(let i=0;i<c.phases.length;i++) {
      const n=choices && choices[i] && choices[i].option;
      if(!Number.isInteger(n)||!c.phases[i].options[n]) continue;
      const option=c.phases[i].options[n];
      option.score.forEach((x,j)=>{sums[j]+=x;});
      details.push({phase:c.phases[i].label,choice:option.label,score:[...option.score],outcome:option.outcome,evidence:option.evidence});
    }
    return {dimensions:sums,percent:Math.round(100*sums.reduce((a,b)=>a+b,0)/maxScore(c)),max:maxScore(c),total:sums.reduce((a,b)=>a+b,0),complete:details.length===c.phases.length,details};
  }
  const escape = s => esc(s);
  function setActive(active) {store().active=active;save();}
  function launch(id) {
    if(!getCase(id))return;
    setActive({id,step:0,choices:[],phase:'play',defense:'',selfRating:null,rubric:false,startedAt:Date.now()});
    state.mode='simulator';render();
  }
  function choose(index) {
    const a=store().active,c=a&&getCase(a.id);
    if(!c||a.phase!=='play'||a.choices[a.step])return false;
    const opt=c.phases[a.step]?.options[index];
    if(!opt)return false;
    a.choices[a.step]={option:index};
    save();render();return true;
  }
  function advance() {
    const a=store().active,c=a&&getCase(a.id);
    if(!c||!a.choices[a.step]||a.phase!=='play')return false;
    if(a.step===c.phases.length-1) a.phase='defense';else a.step++;
    save();render();return true;
  }
  function finalize(rating) {
    const a=store().active,c=a&&getCase(a.id);
    if(!c||a.phase!=='defense'||!a.rubric||![0,1,2].includes(rating))return false;
    a.selfRating=rating;a.phase='done';
    const result=calculate(a.id,a.choices);
    store().history[a.id]={...result,selfRating:rating,defense:a.defense||'',date:Date.now(),completedAt:new Date().toISOString()};
    save();render();return true;
  }
  function setDefense(v) {const a=store().active;if(!a||a.phase!=='defense')return;a.defense=v.slice(0,2400);save();}
  function bar(current,max){return '<div class="sim-track" role="progressbar" aria-valuenow="'+current+'" aria-valuemin="0" aria-valuemax="'+max+'"><div style="width:'+(current/max*100)+'%"></div></div>';}
  function map(c,step){
    const items=[...c.phases.map(p=>p.label),'Защита решения'];
    return '<div class="sim-route" aria-label="Этапы расследования">'+items.map((x,i)=>'<span class="sim-route-item '+(i<step?'past':i===step?'current':'')+'">'+(i+1)+'. '+escape(x)+'</span>').join('<span class="sim-route-arrow" aria-hidden="true">→</span>')+'</div>';
  }
  function evidenceBoard(c,a) {
    const findings=a.choices.map((ch,i)=>ch&&c.phases[i].options[ch.option]?.evidence).filter(Boolean);
    return '<aside class="sim-evidence"><h3>Доска доказательств</h3>'+(findings.length?findings.map((x,i)=>'<div class="sim-finding"><span>'+String(i+1).padStart(2,'0')+'</span><p>'+escape(x)+'</p></div>').join(''):'<p class="sim-muted">Пока нет данных — начни расследование.</p>')+'</aside>';
  }
  function catalog() {
    const h=store().history;
    const active=store().active;
    return '<div class="sim-intro"><div><div class="sim-kicker">Тренажёр расследований</div><h2>Думай как QA, а не угадывай ответ</h2><p>Выбирай действия, собирай доказательства и защищай release-решение. Каждый сценарий — 3 решения и короткая защита. Никаких случайных баллов или бесконечной ленты.</p></div><div class="sim-intro-label"><strong>'+Object.keys(h).length+' / '+CASES.length+'</strong><span>пройдено</span></div></div>'+
      (active&&active.phase!=='done'?'<div class="sim-resume"><div><strong>Незавершённое расследование</strong><p>'+escape(getCase(active.id)?.title||'')+' · шаг '+(active.phase==='defense'?4:active.step+1)+' из 4</p></div><button class="btn primary" id="simResume">Продолжить →</button></div>':'')+
      '<div class="sim-list">'+CASES.map(c=>{const x=h[c.id];return '<article class="sim-card"><div class="sim-case-meta"><span class="sim-num">'+c.icon+'</span><span>'+escape(c.level)+'</span><span>'+escape(c.minutes)+'</span></div><h3>'+escape(c.title)+'</h3><p>'+escape(c.teaser)+'</p><div class="sim-subject">'+escape(c.domain)+'</div><div class="sim-card-foot"><span>'+(x?'Пройдено · '+x.percent+'% по решениям':'Не начато')+'</span><button class="btn '+(x?'ghost':'primary')+'" data-sim-launch="'+escape(c.id)+'">'+(x?'Ещё попытка ↻':'Начать →')+'</button></div></article>'}).join('')+'</div>'+
      '<p class="sim-caption">Проценты отражают только выбор действий по заранее заданным критериям. Свободный ответ оцениваешь самостоятельно; это не экзаменационная аттестация.</p>';
  }
  function play(c,a) {
    const phase=c.phases[a.step], selected=a.choices[a.step];
    const outcome=selected&&phase.options[selected.option];
    return '<div class="sim-frame"><div class="sim-heading"><button class="sim-back" id="simBack">← Все кейсы</button><span>'+escape(c.level)+' · '+escape(c.minutes)+'</span></div>'+
    '<h2>'+escape(c.title)+'</h2>'+map(c,a.step)+bar(a.step+(selected?1:0),c.phases.length+1)+
    '<div class="sim-layout"><div><div class="sim-context"><strong>Дано</strong><p>'+escape(c.context)+'</p></div><div class="sim-kicker">Этап '+(a.step+1)+' / '+c.phases.length+' · '+escape(phase.label)+'</div><h3 class="sim-question">'+escape(phase.question)+'</h3>'+
    '<div class="sim-options">'+phase.options.map((o,i)=>'<button class="sim-option '+(selected?i===selected.option?'selected':'muted':'')+'" data-sim-option="'+i+'" '+(selected?'disabled':'')+'><span class="sim-letter">'+String.fromCharCode(65+i)+'</span><span>'+escape(o.label)+'</span></button>').join('')+'</div>'+
    (outcome?'<div class="sim-result"><div class="sim-kicker">Последствие выбора</div><p>'+escape(outcome.outcome)+'</p><div class="sim-insight"><strong>Новая запись:</strong> '+escape(outcome.evidence)+'</div></div><div class="sim-next"><button class="btn primary" id="simNext">'+(a.step===c.phases.length-1?'Перейти к защите →':'Следующий этап →')+'</button></div>':'<details class="sim-hint"><summary>На что обратить внимание?</summary><p>'+escape(phase.mentor)+'</p></details>')+
    '</div>'+evidenceBoard(c,a)+'</div></div>';
  }
  function defense(c,a) {
    const report=calculate(c.id,a.choices);
    return '<div class="sim-frame"><div class="sim-heading"><button id="simBack" class="sim-back">← Все кейсы</button><span>Финальный этап · Защита решения</span></div><h2>'+escape(c.title)+'</h2>'+map(c,c.phases.length)+bar(c.phases.length,c.phases.length+1)+
    '<div class="sim-layout"><div><div class="sim-kicker">Техлид задаёт вопрос</div><h3 class="sim-question">Какое решение ты предлагаешь, на основании каких доказательств и какой риск останется?</h3>'+
    '<p class="sim-muted">Скажи вслух, как на интервью, затем запиши 3–5 тезисов. Введённый текст сохраняется только в браузере и автоматически не оценивается.</p>'+
    '<label class="sim-label" for="simDefense">Моя аргументация</label><textarea id="simDefense" rows="6" maxlength="2400" placeholder="Сначала уточню..., затем проверю..., критерий релиза..., остаточный риск...">'+escape(a.defense||'')+'</textarea>'+
    '<button class="btn ghost" id="simRubric">'+(a.rubric?'Скрыть ориентиры':'Открыть критерии сильного ответа')+'</button>'+
    (a.rubric?'<div class="sim-rubric"><h4>Чек-лист техлида</h4>'+c.model.map(x=>'<div class="sim-check"><span>✓</span>'+escape(x)+'</div>').join('')+'<p>Это образец аргументации, а не обязательный набор слов.</p><h4>Как оцениваешь свой свободный ответ?</h4><div class="sim-rating"><button class="btn ghost" data-sim-rating="0">Пока не объяснил</button><button class="btn ghost" data-sim-rating="1">Нужна доработка</button><button class="btn primary" data-sim-rating="2">Обосновал уверенно</button></div></div>':'')+
    '</div>'+evidenceBoard(c,a)+'</div><div class="sim-caption">Выбрано '+report.details.length+' из '+c.phases.length+' действий. Решения можно разобрать на следующем экране.</div></div>';
  }
  function debrief(c,a) {
    const r=store().history[a.id]||calculate(c.id,a.choices);
    const interpretations=['Хорошая основа для работы над ошибками','Есть сильные решения и точки роста','Большинство решений опирается на проверяемые факты'][r.percent<40?0:r.percent<80?1:2];
    return '<div class="sim-frame sim-debrief"><div class="sim-heading"><button class="sim-back" id="simBack">← Все кейсы</button><span>Разбор завершён</span></div><div class="sim-kicker">Итог практического сценария</div><h2>'+escape(c.title)+'</h2><p>'+escape(interpretations)+'</p><div class="sim-score"><strong>'+r.percent+'%</strong><span>Качество выбранных действий по заданной рубрике · '+r.total+' из '+r.max+' баллов</span></div>'+
    '<div class="sim-dimensions">'+r.dimensions.map((v,i)=>'<div><div class="sim-dim-head"><span>'+DIMENSIONS[i]+'</span><strong>'+v+'/'+MAX_DIM+'</strong></div>'+bar(v,MAX_DIM)+'</div>').join('')+'</div>'+
    '<h3 class="sim-subheading">Разбор принятых решений</h3><div class="sim-timeline">'+r.details.map((d,i)=>'<div class="sim-timeline-item"><strong>'+String(i+1)+'. '+escape(d.phase)+'</strong><p>'+escape(d.choice)+'</p><div class="sim-muted">'+escape(d.outcome)+'</div></div>').join('')+'</div>'+
    '<div class="sim-coach"><h3>Что проверил бы техлид</h3>'+c.model.map(s=>'<div class="sim-check"><span>✓</span>'+escape(s)+'</div>').join('')+'</div>'+
    '<div class="sim-self"><strong>Самооценка защиты: '+['ещё не объяснил','частично','уверенно'][a.selfRating]+'</strong><p>'+escape((a.defense||'').trim()||'Аргументация письменно не добавлена; можно попробовать в следующей попытке.')+'</p></div>'+
    '<div class="sim-cta"><button class="btn primary" id="simRetry">Попробовать другой путь</button><button class="btn ghost" id="simBack2">Выбрать другой кейс</button></div><p class="sim-caption">Это учебная модель. Баллы не являются автоматической оценкой вашей квалификации, а данные хранятся на устройстве.</p></div>';
  }
  function renderSim() {
    const w=document.getElementById('workspace');
    if(state.mode!=='simulator') return;
    const a=store().active;
    const c=a&&getCase(a.id);
    w.innerHTML=!c?catalog():a.phase==='play'?play(c,a):a.phase==='defense'?defense(c,a):debrief(c,a);
    w.querySelectorAll('[data-sim-launch]').forEach(el=>el.onclick=()=>launch(el.dataset.simLaunch));
    if(document.getElementById('simResume'))document.getElementById('simResume').onclick=()=>{state.mode='simulator';render();};
    if(document.getElementById('simBack'))document.getElementById('simBack').onclick=()=>{store().active=null;save();render();};
    w.querySelectorAll('[data-sim-option]').forEach(el=>el.onclick=()=>choose(Number(el.dataset.simOption)));
    if(document.getElementById('simNext'))document.getElementById('simNext').onclick=advance;
    if(document.getElementById('simDefense'))document.getElementById('simDefense').oninput=e=>setDefense(e.target.value);
    if(document.getElementById('simRubric'))document.getElementById('simRubric').onclick=()=>{store().active.rubric=!store().active.rubric;save();render();};
    w.querySelectorAll('[data-sim-rating]').forEach(el=>el.onclick=()=>finalize(Number(el.dataset.simRating)));
    if(document.getElementById('simRetry'))document.getElementById('simRetry').onclick=()=>launch(c.id);
    if(document.getElementById('simBack2'))document.getElementById('simBack2').onclick=()=>{store().active=null;save();render();};
  }
  const previousRender=render;
  render=function() {
    previousRender();
    const simulator=state.mode==='simulator';
    const controls=document.getElementById('controls');
    if(controls)controls.classList.toggle('hidden',simulator || state.mode==='progress');
    const home=document.getElementById('learningHome');
    if(home){home.classList.toggle('sim-home-hidden',simulator);const side=home.querySelector('.learning-side');if(side){side.insertAdjacentHTML('beforeend','<div class="sim-home-cta"><span>Практика как на работе</span><p>Четыре расследования с решениями и защитой перед техлидом.</p><button class="btn ghost" id="simOpen">QA Simulator →</button></div>');document.getElementById('simOpen').onclick=()=>{state.mode='simulator';store().active=null;render();};}}
    if(simulator)renderSim();
  };
  store();
  render();
  window.QASimulator={cases:CASES,calculate,launch,choose,advance,finalize,store,getCase};
})();