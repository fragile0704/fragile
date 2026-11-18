import { clipTo, type Bounds } from './bounds'
import { context, surface, type Painting, type Layer } from './types'

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  source = layer.pixels,
) {
  ctx.globalAlpha = layer.opacity
  ctx.globalCompositeOperation = layer.blend
  ctx.drawImage(source, 0, 0)
}

// Composite a run of clipped layers inside the base's alpha, then apply its
// opacity and blend mode once. This preserves the alpha of anti-aliased edges.
export function composite(
  doc: Painting,
  target = surface(doc.width, doc.height),
  scratch?: HTMLCanvasElement,
  dirty?: Bounds,
) {
  const ctx = context(target),
    { width, height, layers } = doc
  const left = Math.max(0, dirty?.left ?? 0),
    top = Math.max(0, dirty?.top ?? 0)
  const w = Math.min(width, dirty?.right ?? width) - left,
    h = Math.min(height, dirty?.bottom ?? height) - top
  if (w <= 0 || h <= 0) return target
  ctx.save()
  if (dirty) clipTo(ctx, dirty)
  ctx.clearRect(left, top, w, h)
  for (let i = 0; i < layers.length; i++) {
    const base = layers[i]
    if (base.clipped || !base.visible || !base.opacity) continue
    if (!layers[i + 1]?.clipped) {
      drawLayer(ctx, base)
      continue
    }
    scratch ??= surface(width, height)
    const group = context(scratch)
    group.save()
    if (dirty) clipTo(group, dirty)
    group.clearRect(left, top, w, h)
    group.drawImage(base.pixels, 0, 0)
    const clipped: Layer[] = []
    while (layers[i + 1]?.clipped) {
      const child = layers[++i]
      if (child.visible && child.opacity) clipped.push(child)
    }
    if (clipped.some((child) => child.blend !== 'source-over')) {
      // Canvas blend modes expect a backdrop. Unassociate alpha before
      // blending, then restore the base mask once for the entire group.
      const data = group.getImageData(left, top, w, h)
      for (let a = 3; a < data.data.length; a += 4) data.data[a] = 255
      group.putImageData(data, left, top)
      for (const child of clipped) drawLayer(group, child)
      group.globalAlpha = 1
      group.globalCompositeOperation = 'destination-in'
      group.drawImage(base.pixels, 0, 0)
    } else {
      group.globalCompositeOperation = 'source-atop'
      for (const child of clipped) {
        group.globalAlpha = child.opacity
        group.drawImage(child.pixels, 0, 0)
      }
    }
    group.restore()
    drawLayer(ctx, base, scratch)
  }
  ctx.restore()
  return target
}
