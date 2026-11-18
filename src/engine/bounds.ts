export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}
export function include(
  bounds: Bounds | undefined,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Bounds {
  if (!bounds) return { left, top, right, bottom }
  bounds.left = Math.min(bounds.left, left)
  bounds.top = Math.min(bounds.top, top)
  bounds.right = Math.max(bounds.right, right)
  bounds.bottom = Math.max(bounds.bottom, bottom)
  return bounds
}
export function clipTo(ctx: CanvasRenderingContext2D, area: Bounds) {
  ctx.beginPath()
  ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top)
  ctx.clip()
}
