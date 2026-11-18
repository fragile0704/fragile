export type Blend = 'source-over' | 'multiply' | 'screen' | 'overlay'
export type Tool =
  | 'brush'
  | 'eraser'
  | 'pick'
  | 'fill'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'select'
  | 'lasso'
  | 'move'
  | 'hand'
  | 'zoom'
export type Preset = 'ink' | 'soft' | 'pencil' | 'air' | 'eraser'
export interface Point {
  x: number
  y: number
  p: number
}
export interface Brush {
  preset: Preset
  size: number
  opacity: number
  hardness: number
  spacing: number
  smoothing: number
  pressureSize: boolean
  pressureOpacity: boolean
}
export interface Layer {
  id: string
  name: string
  pixels: HTMLCanvasElement
  visible: boolean
  locked: boolean
  alphaLock: boolean
  clipped: boolean
  opacity: number
  blend: Blend
}
export interface Painting {
  name: string
  width: number
  height: number
  layers: Layer[]
  active: string
}
export type Selection = { points: Point[]; path: Path2D } | null
export const blendNames: Record<Blend, string> = {
  'source-over': '正常',
  multiply: '正片叠底',
  screen: '滤色',
  overlay: '叠加',
}
export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))
export function surface(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
export const context = (c: HTMLCanvasElement) => c.getContext('2d')!
export function copyPixels(c: HTMLCanvasElement) {
  const copy = surface(c.width, c.height)
  context(copy).drawImage(c, 0, 0)
  return copy
}
export const layerId = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
export function makeLayer(w: number, h: number, name: string): Layer {
  return {
    id: layerId(),
    name,
    pixels: surface(w, h),
    visible: true,
    locked: false,
    alphaLock: false,
    clipped: false,
    opacity: 1,
    blend: 'source-over',
  }
}
export function blank(
  w: number,
  h: number,
  name: string,
  transparent = true,
): Painting {
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w > 4096 ||
    h > 4096
  )
    throw Error('画布边长须为 1–4096 像素')
  const layer = makeLayer(w, h, '图层 1')
  if (!transparent) {
    const ctx = context(layer.pixels)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  return {
    width: w,
    height: h,
    name: name.trim() || '未命名作品',
    layers: [layer],
    active: layer.id,
  }
}
export function roomForLayer(doc: Painting) {
  if (
    doc.layers.length >= 64 ||
    (doc.layers.length + 1) * doc.width * doc.height > 64 * 1024 * 1024
  )
    throw Error('已达到此画布的图层内存上限')
}
