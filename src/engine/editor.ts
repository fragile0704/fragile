import { clipTo, include, type Bounds } from './bounds'
import { History } from './history'
import { composite } from './layers'
import { Stroke } from './brush'
import { flood } from './fill'
import {
  context,
  copyPixels,
  layerId,
  makeLayer,
  roomForLayer,
  surface,
  type Brush,
  type Layer,
  type Painting,
  type Point,
  type Selection,
  type Tool,
} from './types'

export function polygon(points: Point[]): Selection {
  if (points.length < 3) return null
  const path = new Path2D()
  path.moveTo(points[0].x, points[0].y)
  for (const p of points.slice(1)) path.lineTo(p.x, p.y)
  path.closePath()
  return { points, path }
}
interface Gesture {
  before: Painting
  layer: Layer
  ink: HTMLCanvasElement
  tool: Tool
  start: Point
  end: Point
  brush: Brush
  color: string
  stroke?: Stroke
  moved?: HTMLCanvasElement
}
export class Editor {
  history = new History()
  selection: Selection = null
  private gesture?: Gesture
  private listeners = new Set<() => void>()
  private painters = new Set<(area?: Bounds) => void>()
  private damage?: Bounds
  private frame = 0
  version = 0
  revision = 0
  constructor(public doc: Painting) {}
  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
  subscribePaint = (cb: (area?: Bounds) => void) => {
    this.painters.add(cb)
    return () => {
      this.painters.delete(cb)
    }
  }
  getVersion = () => this.version
  get active() {
    return this.doc.layers.find((l) => l.id === this.doc.active)!
  }
  get busy() {
    return !!this.gesture
  }
  repaint = (area?: Bounds) => {
    if (this.frame) {
      if (!area) this.damage = undefined
      else if (this.damage)
        include(this.damage, area.left, area.top, area.right, area.bottom)
      return
    }
    this.damage = area
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      const dirty = this.damage
      this.damage = undefined
      this.renderGesture(dirty)
      this.painters.forEach((cb) => cb(dirty))
    })
  }
  private notify(changed: boolean) {
    this.version++
    if (changed) this.revision++
    this.listeners.forEach((cb) => cb())
    this.repaint()
  }
  install(doc: Painting) {
    this.gesture = undefined
    this.doc = doc
    this.history = new History()
    this.selection = null
    this.notify(true)
  }
  change(doc: Painting, label: string) {
    if (this.busy) return
    this.history.add(this.doc, label)
    this.doc = doc
    this.notify(true)
  }
  select(id: string) {
    if (
      this.busy ||
      !this.doc.layers.some((l) => l.id === id) ||
      id === this.doc.active
    )
      return
    this.doc = { ...this.doc, active: id }
    this.notify(true)
  }
  update(
    id: string,
    patch: Partial<Omit<Layer, 'pixels' | 'id'>>,
    label = '修改图层',
  ) {
    this.change(
      {
        ...this.doc,
        layers: this.doc.layers.map((l) =>
          l.id === id ? { ...l, ...patch } : l,
        ),
      },
      label,
    )
  }
  add(duplicate = false) {
    roomForLayer(this.doc)
    const old = this.active,
      l = duplicate
        ? {
            ...old,
            id: layerId(),
            pixels: copyPixels(old.pixels),
            name: old.name + ' 副本',
          }
        : makeLayer(
            this.doc.width,
            this.doc.height,
            '图层 ' + (this.doc.layers.length + 1),
          )
    const layers = [...this.doc.layers]
    layers.splice(layers.indexOf(old) + 1, 0, l)
    this.change(
      { ...this.doc, layers, active: l.id },
      duplicate ? '复制图层' : '新建图层',
    )
  }
  remove() {
    if (this.doc.layers.length < 2 || this.active.locked) return
    const i = this.doc.layers.indexOf(this.active),
      layers = this.doc.layers.filter((l) => l.id !== this.doc.active)
    this.change(
      { ...this.doc, layers, active: layers[Math.max(0, i - 1)].id },
      '删除图层',
    )
  }
  reorder(id: string, to: number) {
    const layers = [...this.doc.layers],
      i = layers.findIndex((l) => l.id === id)
    if (i < 0 || to < 0 || to >= layers.length || i === to) return
    const [layer] = layers.splice(i, 1)
    layers.splice(to, 0, layer)
    this.change({ ...this.doc, layers }, '调整图层顺序')
  }
  merge() {
    const layers = [...this.doc.layers],
      i = layers.indexOf(this.active)
    if (i < 1 || this.active.locked || layers[i - 1].locked) return
    const lower = layers[i - 1],
      upper = layers[i]
    // Sibling clipping layers share the same mask beneath the pair. Keep
    // that mask live after merging instead of treating the lower sibling as it.
    const siblings = lower.clipped && upper.clipped
    let lowerPixels = lower.pixels
    if (lower.clipped && !upper.clipped) {
      lowerPixels = copyPixels(lower.pixels)
      const mask = layers
        .slice(0, i - 1)
        .reverse()
        .find((layer) => !layer.clipped)
      const ctx = context(lowerPixels)
      if (mask?.visible) {
        ctx.globalCompositeOperation = 'destination-in'
        ctx.globalAlpha = mask.opacity
        ctx.drawImage(mask.pixels, 0, 0)
      } else ctx.clearRect(0, 0, this.doc.width, this.doc.height)
    }
    const pixels = composite({
      ...this.doc,
      layers: [
        { ...lower, pixels: lowerPixels, clipped: false, blend: 'source-over' },
        { ...upper, clipped: upper.clipped && !siblings },
      ],
    })
    const merged = {
      ...lower,
      clipped: siblings,
      pixels,
      opacity: 1,
      visible: lower.visible || upper.visible,
    }
    layers.splice(i - 1, 2, merged)
    this.change({ ...this.doc, layers, active: merged.id }, '向下合并')
  }
  undo() {
    if (this.busy) {
      this.cancel()
      return
    }
    const doc = this.history.undo(this.doc)
    if (doc) {
      this.doc = doc
      this.selection = null
      this.notify(true)
    }
  }
  redo() {
    if (this.busy) return
    const doc = this.history.redo(this.doc)
    if (doc) {
      this.doc = doc
      this.selection = null
      this.notify(true)
    }
  }
  setSelection(s: Selection) {
    this.selection = s
    this.repaint()
  }
  start(
    tool: Tool,
    start: Point,
    brush: Brush,
    color: string,
    tolerance: number,
    grow: boolean,
    sampleAll: boolean,
  ) {
    if (
      this.busy ||
      this.active.locked ||
      !this.active.visible ||
      ((tool === 'eraser' || tool === 'move') && this.active.alphaLock)
    )
      return false
    const { width: w, height: h } = this.doc,
      layer = this.active
    const ink = surface(w, h),
      g: Gesture = {
        before: this.doc,
        layer,
        ink,
        tool,
        start,
        end: start,
        brush: { ...brush },
        color,
      }
    const target = { ...layer, pixels: copyPixels(layer.pixels) }
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.map((l) => (l === layer ? target : l)),
    }
    this.gesture = g
    if (tool === 'brush' || tool === 'eraser')
      g.stroke = new Stroke(context(ink), brush, color, start)
    if (tool === 'fill')
      flood(
        ink,
        sampleAll ? composite(g.before) : layer.pixels,
        start,
        color,
        tolerance,
        grow,
      )
    if (tool === 'move') {
      const ctx = context(ink)
      ctx.save()
      if (this.selection) ctx.clip(this.selection.path)
      ctx.drawImage(layer.pixels, 0, 0)
      ctx.restore()
      if (this.selection) {
        g.moved = surface(w, h)
        const rest = context(g.moved)
        rest.drawImage(layer.pixels, 0, 0)
        rest.globalCompositeOperation = 'destination-out'
        rest.fill(this.selection.path)
      }
    }
    this.repaint(g.stroke?.takeDamage())
    return true
  }
  drag(p: Point, finish = false) {
    const g = this.gesture
    if (!g) return
    g.end = p
    if (!g.stroke) {
      this.repaint()
      return
    }
    g.stroke.to(p, finish)
    const dirty = g.stroke.takeDamage()
    if (dirty) this.repaint(dirty)
  }
  private renderGesture(dirty?: Bounds) {
    const g = this.gesture
    if (!g) return
    const { width: w, height: h } = this.doc,
      ctx = context(this.active.pixels),
      { tool, brush, start, end } = g
    ctx.save()
    if (dirty) clipTo(ctx, dirty)
    ctx.clearRect(0, 0, w, h)
    if (tool === 'move') {
      if (g.moved) ctx.drawImage(g.moved, 0, 0)
      ctx.drawImage(
        g.ink,
        Math.round(end.x - start.x),
        Math.round(end.y - start.y),
      )
      ctx.restore()
      return
    }
    ctx.drawImage(g.layer.pixels, 0, 0)
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      const ink = context(g.ink)
      ink.clearRect(0, 0, w, h)
      ink.strokeStyle = g.color
      ink.lineWidth = brush.size
      ink.lineCap = 'round'
      ink.lineJoin = 'round'
      ink.beginPath()
      const dx = end.x - start.x,
        dy = end.y - start.y
      if (tool === 'line') {
        ink.moveTo(start.x, start.y)
        ink.lineTo(end.x, end.y)
      }
      if (tool === 'rect') ink.rect(start.x, start.y, dx, dy)
      if (tool === 'ellipse')
        ink.ellipse(
          start.x + dx / 2,
          start.y + dy / 2,
          Math.abs(dx / 2),
          Math.abs(dy / 2),
          0,
          0,
          2 * Math.PI,
        )
      ink.stroke()
    }
    ctx.save()
    if (this.selection) ctx.clip(this.selection.path)
    ctx.globalAlpha = brush.opacity / 100
    ctx.globalCompositeOperation =
      tool === 'eraser'
        ? 'destination-out'
        : g.layer.alphaLock
          ? 'source-atop'
          : 'source-over'
    ctx.drawImage(g.ink, 0, 0)
    ctx.restore()
    ctx.restore()
  }
  finish() {
    const g = this.gesture
    if (!g) return
    this.renderGesture()
    if (g.tool === 'move' && this.selection)
      this.selection = polygon(
        this.selection.points.map((p) => ({
          ...p,
          x: p.x + Math.round(g.end.x - g.start.x),
          y: p.y + Math.round(g.end.y - g.start.y),
        })),
      )
    this.gesture = undefined
    this.history.add(g.before, g.tool === 'eraser' ? '擦除' : '绘制')
    this.notify(true)
  }
  cancel() {
    if (this.gesture) {
      this.doc = this.gesture.before
      this.gesture = undefined
      this.repaint()
    }
  }
  get committed() {
    return this.gesture?.before ?? this.doc
  }
}
