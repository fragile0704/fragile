import {
  blank,
  blendNames,
  context,
  makeLayer,
  roomForLayer,
  surface,
  type Blend,
  type Layer,
  type Painting,
} from './types'
import { composite } from './layers'
export const blobOf = (canvas: HTMLCanvasElement, type = 'image/png') =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('图像编码失败'))),
      type,
      0.95,
    ),
  )
const cachedPng = new WeakMap<HTMLCanvasElement, string>()
const encodings = new WeakMap<HTMLCanvasElement, Promise<string>>()
function encode(pixels: HTMLCanvasElement) {
  const cached = cachedPng.get(pixels)
  if (cached) return Promise.resolve(cached)
  let result = encodings.get(pixels)
  if (!result) {
    result = blobOf(pixels).then(
      (blob) =>
        new Promise<string>((ok, no) => {
          const reader = new FileReader()
          reader.onload = () => ok(String(reader.result))
          reader.onerror = no
          reader.readAsDataURL(blob)
        }),
    )
    encodings.set(pixels, result)
    result.then(
      (png) => cachedPng.set(pixels, png),
      () => encodings.delete(pixels),
    )
  }
  return result
}
type StoredLayer = Omit<Layer, 'pixels'> & { png: string }
function projectRecord(doc: Painting, layers: StoredLayer[]) {
  return {
    format: 'atelier-paint',
    version: 1,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    active: doc.active,
    layers,
  }
}
export async function pack(doc: Painting) {
  const layers = await Promise.all(
    doc.layers.map(async ({ pixels, ...meta }) => ({
      ...meta,
      png: await encode(pixels),
    })),
  )
  return projectRecord(doc, layers)
}
export async function unpack(input: unknown): Promise<Painting> {
  if (!input || typeof input !== 'object') throw Error('无效的 Atelier 工程')
  const f = input as Awaited<ReturnType<typeof pack>>
  if (
    f.format !== 'atelier-paint' ||
    f.version !== 1 ||
    typeof f.name !== 'string' ||
    !Array.isArray(f.layers) ||
    !f.layers.length
  )
    throw Error('无法识别工程格式或版本')
  const doc = blank(f.width, f.height, f.name)
  doc.layers = []
  for (const l of f.layers) {
    roomForLayer(doc)
    if (
      !l ||
      typeof l.id !== 'string' ||
      !l.id ||
      doc.layers.some((x) => x.id === l.id) ||
      typeof l.name !== 'string' ||
      !Object.hasOwn(blendNames, l.blend) ||
      !Number.isFinite(l.opacity) ||
      l.opacity < 0 ||
      l.opacity > 1 ||
      typeof l.png !== 'string' ||
      !l.png.startsWith('data:image/png;base64,')
    )
      throw Error('工程的图层数据无效')
    const image = new Image()
    image.src = l.png
    await image.decode()
    if (image.naturalWidth !== doc.width || image.naturalHeight !== doc.height)
      throw Error('图层尺寸与画布不匹配')
    const layer = makeLayer(doc.width, doc.height, l.name)
    context(layer.pixels).drawImage(image, 0, 0)
    cachedPng.set(layer.pixels, l.png)
    doc.layers.push({
      ...layer,
      id: l.id,
      visible: l.visible !== false,
      locked: !!l.locked,
      alphaLock: !!l.alphaLock,
      clipped: !!l.clipped,
      opacity: l.opacity,
      blend: l.blend as Blend,
    })
  }
  doc.active = doc.layers.some((l) => l.id === f.active)
    ? f.active
    : doc.layers.at(-1)!.id
  return doc
}
let connection: IDBDatabase | undefined
let dbPromise: Promise<IDBDatabase> | undefined
function database() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('atelier-workspace', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('projects')
    req.onsuccess = () => {
      connection = req.result
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  }))
}
let preserveOnNextSave = false
let durable: Painting | undefined
let writer = 0
let pendingWrite = false
function storeProject(db: IDBDatabase, data: ReturnType<typeof projectRecord>) {
  return new Promise<void>((ok, no) => {
    const tx = db.transaction('projects', 'readwrite')
    const store = tx.objectStore('projects')
    if (preserveOnNextSave) {
      const previous = store.get('current')
      previous.onsuccess = () => {
        if (previous.result !== undefined)
          store.put(previous.result, 'recovery')
        store.put(data, 'current')
        tx.commit?.()
      }
    } else {
      store.put(data, 'current')
      tx.commit?.()
    }
    tx.oncomplete = () => {
      preserveOnNextSave = false
      ok()
    }
    tx.onerror = () => no(tx.error)
    tx.onabort = () => no(tx.error)
  })
}
export async function saveLocal(doc: Painting) {
  if (durable === doc && !pendingWrite) return
  const ticket = ++writer
  pendingWrite = true
  try {
    const data = await pack(doc),
      db = await database()
    if (ticket !== writer) return
    await storeProject(db, data)
    if (ticket === writer) durable = doc
  } finally {
    if (ticket === writer) pendingWrite = false
  }
}
// A page can disappear before an asynchronous PNG encode finishes. Queue and
// commit the current record during pagehide, reusing previously encoded layers.
export function flushOnExit(doc: Painting) {
  if (!connection || (durable === doc && !pendingWrite)) return
  const layers = doc.layers.map(({ pixels, ...meta }) => ({
    ...meta,
    png: cachedPng.get(pixels) ?? pixels.toDataURL('image/png'),
  }))
  const ticket = ++writer
  pendingWrite = true
  void storeProject(connection, projectRecord(doc, layers)).then(
    () => {
      if (ticket === writer) {
        durable = doc
        pendingWrite = false
      }
    },
    () => {
      if (ticket === writer) pendingWrite = false
    },
  )
}
export async function restore() {
  const db = await database(),
    data = await new Promise<unknown>((ok, no) => {
      const req = db
        .transaction('projects')
        .objectStore('projects')
        .get('current')
      req.onsuccess = () => ok(req.result)
      req.onerror = () => no(req.error)
    })
  try {
    if (!data) return null
    durable = await unpack(data)
    return durable
  } catch (err) {
    preserveOnNextSave = true
    throw err
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export async function exportProject(doc: Painting) {
  download(
    new Blob([JSON.stringify(await pack(doc))], { type: 'application/json' }),
    doc.name + '.atelier',
  )
}
export async function exportImage(doc: Painting, type: 'png' | 'jpeg') {
  let canvas = composite(doc)
  if (type === 'jpeg') {
    const flat = surface(doc.width, doc.height),
      ctx = context(flat)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, doc.width, doc.height)
    ctx.drawImage(canvas, 0, 0)
    canvas = flat
  }
  download(
    await blobOf(canvas, 'image/' + type),
    doc.name + (type === 'jpeg' ? '.jpg' : '.png'),
  )
}
