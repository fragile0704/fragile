import {
  blank,
  blendNames,
  context,
  makeLayer,
  layerId,
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
// Inspect the fixed-size PNG header before the browser allocates a decoder.
function verifyPng(png: string, width: number, height: number) {
  const prefix = 'data:image/png;base64,'
  if (!png.startsWith(prefix)) throw Error('仅支持嵌入式 PNG 图层')
  const bytes = Uint8Array.from(
    atob(png.slice(prefix.length, prefix.length + 32)),
    (ch) => ch.charCodeAt(0),
  )
  const header = new DataView(bytes.buffer)
  if (
    bytes.length !== 24 ||
    header.getUint32(0) !== 0x89504e47 ||
    header.getUint32(4) !== 0x0d0a1a0a ||
    header.getUint32(8) !== 13 ||
    header.getUint32(12) !== 0x49484452 ||
    header.getUint32(16) !== width ||
    header.getUint32(20) !== height
  )
    throw Error('PNG 图层头或像素尺寸与工程不一致')
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
  if (
    f.layers.length > 64 ||
    f.width * f.height * f.layers.length > 64 * 1024 * 1024
  )
    throw Error('工程超过图层内存上限')
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
    verifyPng(l.png, f.width, f.height)
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
    let blocked = false
    const req = indexedDB.open('atelier-workspace', 2)
    req.onblocked = () => {
      blocked = true
      reject(Error('请先关闭其他 Atelier 标签页，再重新打开'))
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('projects'))
        req.result.createObjectStore('projects')
      const heads = req.result.createObjectStore('save-head', {
        keyPath: 'revision',
      })
      heads.createIndex('slot', 'slot', { unique: true })
      heads.add({ slot: 'current', revision: 'initial' })
    }
    req.onsuccess = () => {
      if (blocked) {
        req.result.close()
        return
      }
      connection = req.result
      connection.onversionchange = () => {
        readOnlyReason = '存储版本已更新，请导出工程并重新打开'
        req.result.close()
      }

      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  }))
}
let readOnlyReason = '读取本地工程失败，请导出工程'
let revision: string | undefined
const session = layerId()
export function localSaveIssue() {
  return readOnlyReason
}
let durable: Painting | undefined
let writer = 0
let pendingWrite = false
function storeProject(db: IDBDatabase, data: ReturnType<typeof projectRecord>) {
  return new Promise<void>((ok, no) => {
    if (readOnlyReason) {
      no(Error(readOnlyReason))
      return
    }
    const expected = revision!
    const next = session + '/' + writer
    const tx = db.transaction(['projects', 'save-head'], 'readwrite', {
      durability: 'strict',
    })
    // The unique slot makes replacing a stale revision fail atomically. All
    // requests can be queued synchronously, including during pagehide.
    const heads = tx.objectStore('save-head')
    try {
      heads.delete(expected)
      heads.add({ slot: 'current', revision: next })
      tx.objectStore('projects').put(data, 'current')
      tx.commit?.()
    } catch (error) {
      tx.abort()
      no(error)
      return
    }
    revision = next
    tx.oncomplete = () => ok()
    tx.onabort = () => {
      if (revision === next) revision = expected
      if (tx.error?.name === 'ConstraintError')
        readOnlyReason = '其他标签页已保存，请导出本页工程'
      no(Error(readOnlyReason || '本地写入失败'))
    }
  })
}
export async function saveLocal(doc: Painting) {
  if (readOnlyReason) throw Error(readOnlyReason)
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
  if (readOnlyReason || !connection || (durable === doc && !pendingWrite))
    return
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
  const db = await database()
  const data = await new Promise<unknown>((ok, no) => {
    const tx = db.transaction(['projects', 'save-head']),
      store = tx.objectStore('projects')
    const current = store.get('current'),
      head = tx.objectStore('save-head').index('slot').get('current')
    tx.oncomplete = () => {
      if (typeof head.result?.revision !== 'string') {
        no(Error('无法读取本地保存版本'))
        return
      }
      revision = head.result.revision
      ok(current.result)
    }
    tx.onabort = () => no(tx.error)
    tx.onerror = () => no(tx.error)
  })
  durable = data === undefined ? undefined : await unpack(data)
  readOnlyReason = ''
  return durable ?? null
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name.replace(
    /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
    '_',
  )
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
