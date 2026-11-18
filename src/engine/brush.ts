import { include, type Bounds } from './bounds'
import {
  clamp,
  context,
  surface,
  type Brush,
  type Point,
  type Preset,
} from './types'
export const presetNames: Record<Preset, string> = {
  ink: '墨线笔',
  soft: '柔边画笔',
  pencil: '石墨铅笔',
  air: '细雾喷枪',
  eraser: '橡皮擦',
}
export const presetSettings: Record<Preset, Partial<Brush>> = {
  ink: { size: 18, hardness: 100, spacing: 12 },
  soft: { size: 52, hardness: 32, spacing: 12 },
  pencil: { size: 7, hardness: 85, spacing: 9 },
  air: { size: 82, hardness: 0, spacing: 15 },
  eraser: { size: 35, hardness: 90, spacing: 12 },
}
export const defaultBrush: Brush = {
  preset: 'ink',
  size: 18,
  opacity: 100,
  hardness: 100,
  spacing: 12,
  smoothing: 24,
  pressureSize: true,
  pressureOpacity: false,
}
export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
export class Stroke {
  private damage?: Bounds
  private last: Point
  private remaining = 0
  private tip = surface(160, 160)
  private rand = seeded(191)
  constructor(
    private ctx: CanvasRenderingContext2D,
    private brush: Brush,
    color: string,
    start: Point,
  ) {
    const tip = context(this.tip)
    const { preset, hardness } = brush
    tip.fillStyle = color
    if (preset === 'pencil' || preset === 'air') {
      const count = preset === 'pencil' ? 5800 : 3400
      for (let i = 0; i < count; i++) {
        const a = this.rand() * Math.PI * 2,
          r = Math.sqrt(this.rand()),
          rad = r * 78
        tip.globalAlpha =
          preset === 'air'
            ? 0.17 * Math.pow(1 - r, 1.8 - hardness / 100)
            : 0.85 * (1 - r * (1 - hardness / 100))
        tip.fillRect(
          80 + Math.cos(a) * rad,
          80 + Math.sin(a) * rad,
          preset === 'air' ? 2 : 1.7,
          preset === 'air' ? 2 : 1.7,
        )
      }
    } else {
      if (hardness < 100) {
        const grad = tip.createRadialGradient(
          80,
          80,
          (78 * hardness) / 100,
          80,
          80,
          79,
        )
        grad.addColorStop(0, color)
        grad.addColorStop(1, color + '00')
        tip.fillStyle = grad
      }
      tip.beginPath()
      tip.arc(80, 80, 79, 0, Math.PI * 2)
      tip.fill()
    }
    this.last = start
    this.stamp(start)
  }
  private size(p: number) {
    return Math.max(
      0.65,
      this.brush.size * (this.brush.pressureSize ? Math.max(0.08, p) : 1),
    )
  }
  takeDamage() {
    const area = this.damage
    this.damage = undefined
    return area
  }
  private stamp(pt: Point) {
    const size = this.size(pt.p)
    const pressure = this.brush.pressureOpacity ? Math.max(0.025, pt.p) : 1
    const flow =
      this.brush.preset === 'soft'
        ? 0.42
        : this.brush.preset === 'pencil'
          ? 0.65
          : 1
    this.ctx.globalAlpha =
      (1 - Math.pow(1 - pressure, Math.max(0.06, this.brush.spacing / 100))) *
      flow
    this.ctx.drawImage(this.tip, pt.x - size / 2, pt.y - size / 2, size, size)
    const pad = size / 2 + 2
    this.damage = include(
      this.damage,
      Math.floor(pt.x - pad),
      Math.floor(pt.y - pad),
      Math.ceil(pt.x + pad),
      Math.ceil(pt.y + pad),
    )
    this.remaining = Math.max(
      0.42,
      size * clamp(this.brush.spacing / 100, 0.025, 0.85),
    )
  }
  to(target: Point, finish = false) {
    const f = finish ? 1 : 1 - this.brush.smoothing / 132,
      a = this.last
    const b = {
      x: a.x + (target.x - a.x) * f,
      y: a.y + (target.y - a.y) * f,
      p: target.p,
    }
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    let d = this.remaining
    while (d <= len && len > 0) {
      const t = d / len
      this.stamp({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: a.p + (b.p - a.p) * t,
      })
      d += this.remaining
    }
    this.remaining = d - len
    this.last = b
  }
}
