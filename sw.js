/* 뜨개 노트 서비스 워커: 앱과 PDF 뷰어를 기기에 저장해 인터넷 없이도 열리게 해요.
   앱 파일을 고치면 아래 VERSION 숫자를 올려 주세요. */
const VERSION = 'v4';
const APP = 'knit-app-' + VERSION;
const CDN = 'knit-cdn-v1';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const CDN_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(APP)).addAll(APP_FILES);
    /* PDF.js는 실패해도 설치는 계속 (다음에 열 때 다시 저장) */
    const c = await caches.open(CDN);
    await Promise.all(CDN_FILES.map(u => c.add(new Request(u, {mode: 'cors'})).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()) if(k.startsWith('knit-app-') && k !== APP) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 앱 화면(index.html): 인터넷이 되면 최신 버전, 안 되면 저장본 */
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const res = await fetch(req);
        (await caches.open(APP)).put('./index.html', res.clone());
        return res;
      }catch(err){
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  /* PDF.js·글꼴 등 외부 파일: 저장본 먼저, 없으면 받아서 저장 */
  if(url.origin !== location.origin){
    if(!/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|hangeul\.pstatic\.net/.test(url.host)) return;
    e.respondWith((async () => {
      const hit = await caches.match(req); if(hit) return hit;
      try{
        const res = await fetch(req);
        if(res.ok || res.type === 'opaque') (await caches.open(CDN)).put(req, res.clone());
        return res;
      }catch(err){ return hit || Response.error(); }
    })());
    return;
  }

  /* 같은 사이트의 나머지 파일(아이콘 등): 저장본 먼저 */
  e.respondWith((async () => (await caches.match(req)) || fetch(req))());
});
