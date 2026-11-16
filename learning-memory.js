/* Learning Event Memory v1. Ordered local observations, not a psychological profile.
 * Bounded retention, explicit deletion, no remote I/O, no audio or free text.
 */
(function(){
'use strict';
const KEY='qa-learning-events-v1',LIMIT=1200,DAY=86400000;
const lane={play:'objective',visual:'objective',voice:'self',arena:'scenario'};
function valid(e){return !!e&&typeof e.id==='string'&&e.id.length>0&&e.id.length<=150&&typeof e.item==='string'&&e.item.length>0&&e.item.length<=150&&Object.hasOwn(lane,e.source)&&Number.isSafeInteger(e.seq)&&e.seq>0&&Number.isSafeInteger(e.at)&&e.at>=0&&(e.source==='voice'?[0,1,2].includes(e.value):e.source==='arena'?Array.isArray(e.value)&&e.value.length===3&&e.value.every(n=>Number.isInteger(n)&&n>=-4&&n<=8):typeof e.value==='boolean')}
function clean(raw){const seen=new Set(),seqs=new Set();return (Array.isArray(raw)?raw:[]).filter(valid).sort((a,b)=>a.seq-b.seq).filter(e=>{if(seen.has(e.id)||seqs.has(e.seq))return false;seen.add(e.id);seqs.add(e.seq);return true}).slice(-LIMIT).map(e=>({id:e.id,item:e.item,source:e.source,seq:e.seq,at:e.at,value:Array.isArray(e.value)?[...e.value]:e.value}))}
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');const events=clean(raw?.events);const last=events.at(-1)?.seq||0;return {events,next:Math.max(last+1,Number.isSafeInteger(raw?.next)&&raw.next>0?raw.next:1)}}catch{return {events:[],next:1}}}
let warning='';
function append(input){try{const s=load();const e={id:String(s.next)+':'+String(input.source)+':'+String(input.item),item:input.item,source:input.source,seq:s.next,at:input.at??Date.now(),value:input.value};if(!valid(e))return false;const events=[...s.events,e].slice(-LIMIT);localStorage.setItem(KEY,JSON.stringify({events,next:s.next+1}));warning='';return true}catch{warning='Не удалось записать событие обучения.';return false}}
function erase(source){try{const s=load();if(source&&!Object.hasOwn(lane,source))return false;localStorage.setItem(KEY,JSON.stringify({events:source?s.events.filter(e=>e.source!==source):[],next:s.next}));warning='';return true}catch{warning='Не удалось очистить историю.';return false}}
function positive(e){return e.source==='voice'?e.value===2:e.source==='arena'?e.value.every(n=>n>1):e.value===true}
function project(raw){const buckets=new Map();for(const e of clean(raw)){const k=e.source+':'+e.item;const list=buckets.get(k)||[];list.push(e);buckets.set(k,list)}return [...buckets].map(([key,events])=>{let failureRun=0,successRun=0,failures=0,recoveries=0,delayed=0;let prior=null,lastFailure=null;for(const e of events){if(positive(e)){successRun++;failureRun=0;if(prior&&!positive(prior))recoveries++;if(lastFailure&&e.at-lastFailure.at>=DAY){delayed++;lastFailure=null}}else{failureRun++;successRun=0;failures++;lastFailure=e}prior=e}
 const last=events.at(-1);return {key,source:last.source,item:last.item,lane:lane[last.source],attempts:events.length,failures,failureRun,successRun,recoveries,delayed,lastAt:last.at,lastValue:last.value,lastPositive:positive(last),pattern:failureRun>=2?'REPEATED_DIFFICULTY':failureRun===1?'RECENT_DIFFICULTY':recoveries&&successRun?'RECOVERED':successRun>=2?'REPEATED_SUCCESS':'OBSERVED'} }).sort((a,b)=>b.lastAt-a.lastAt||a.key.localeCompare(b.key))}
function boost(row){if(!row)return 0;return row.failureRun>=2?25:0}
function status(){return {events:load().events.length,warning}}
window.QALearningMemory=Object.freeze({append,erase,read:()=>load().events,project,boost,status,clean});
})();