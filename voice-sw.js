/* Bump the cache version whenever any precached app asset changes. */
const CACHE='manual-qa-lab-voice-v7';
const ASSETS=['./','./index.html','./learning.css','./simulator.css','./coach.css','./learning.js','./simulator.js','./coach.js','./voice.js','./play.js','./play.css','./visual.js','./visual.css','./speech.css','./manifest.webmanifest','./voice-icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('manual-qa-lab-voice-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url),scope=new URL(self.registration.scope);
 if(req.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
 const isAppNavigation=req.mode==='navigate'&&(u.pathname===scope.pathname||u.pathname===scope.pathname+'index.html');
 const known=ASSETS.some(a=>new URL(a,scope).href===u.href);
 if(!isAppNavigation&&!known)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
   const cached=await cache.match(isAppNavigation?new URL('./index.html',scope).href:req);
   return cached||fetch(req);
 }));
});