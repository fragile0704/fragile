import { readdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const assets = (await readdir('dist/assets')).sort().map(name => 'assets/' + name)
const files = ['index.html', 'atelier.svg', ...assets]
const hash = createHash('sha256')
for (const file of files) hash.update(await readFile('dist/' + file))

await writeFile('dist/sw.js', `
const scope = self.registration.scope
const prefix = 'atelier-app:' + scope + ':'
const cache = prefix + '${hash.digest('hex').slice(0, 14)}'
const urls = ${JSON.stringify(files)}.map(file => new URL(file, scope).href)
self.addEventListener('install', event => event.waitUntil(
  caches.open(cache).then(store => store.addAll(urls)).then(() => self.skipWaiting())
))
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cache)
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
))
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return
  const key = request.mode === 'navigate' ? urls[0] : request.url
  if (urls.includes(key)) event.respondWith(
    caches.open(cache).then(async store => (await store.match(key)) ?? fetch(request))
  )
})
`)
