import { readdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const assets = (await readdir('dist/assets')).map((f) => '/assets/' + f)
const files = ['/', '/index.html', '/atelier.svg', ...assets]
const hash = createHash('sha256')
for (const f of files.slice(1)) hash.update(await readFile('dist' + f))
const cache = 'atelier-app-' + hash.digest('hex').slice(0, 14)
await writeFile(
  'dist/sw.js',
  `const cache=${JSON.stringify(cache)},files=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(cache).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('atelier-app-')&&k!==cache).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin)return;
if(e.request.mode==='navigate'||files.includes(url.pathname))e.respondWith(caches.open(cache).then(async c=>(await c.match(e.request.mode==='navigate'?'/index.html':url.pathname))??fetch(e.request)));});`,
)
