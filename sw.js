// Service worker: deixa o app abrir rápido e instalável. Os dados sempre vêm do Supabase (online).
const VERSAO = 'ninho-v2';
const ARQUIVOS = ['./','index.html','styles.css','app.js','install.js','config.js','manifest.webmanifest',
  'icons/brasao.png','icons/icon-192.png','icons/icon-512.png','icons/favicon.png','icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase e fontes: direto na rede
  // Rede primeiro (pega atualizações), cache se estiver sem internet
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
